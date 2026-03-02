import type { LayoutNode } from "../layout/types.js";
import type { RenderNode } from "../element/reconciler.js";
import type { KeyEvent } from "../input/keyboard.js";
import type { FocusGroupOptions } from "../element/types.js";
import { signal } from "../reactive/signal.js";
import type { ReadSignal, WriteSignal } from "../reactive/signal.js";

// ---------------------------------------------------------------------------
// Focus Management — tree-based with composable focus groups
//
// The focus tree mirrors the layout tree's focusable subset. Each
// focusable element (tabIndex >= 0) becomes a FocusEntry, and elements
// with focusGroup/focusTrap props become FocusGroups that contain their
// own child entries.
//
// Navigation model:
//   - Tab/Shift+Tab: advance through entries in tree order at root level,
//     or cycle within a group if tabCycles is true. Groups with
//     tabCycles=false are exited on Tab, advancing to the next sibling.
//   - Arrow keys: navigate within the active focus group (vertical or
//     horizontal, configurable per group).
//   - Escape: exit the active group (unless exitKey is false = trap).
//
// Groups track lastFocusedIndex to restore position when re-entering
// via forward Tab. Backward entry (Shift+Tab) always starts at the
// last child — the asymmetry avoids confusing jumps when tabbing back.
//
// Focus identity is tracked by RenderNode reference (stable across
// layout recomputation), not LayoutNode (recreated each frame).
// ---------------------------------------------------------------------------

/** Resolved options for a focus group (all fields required) */
export interface ResolvedFocusGroupOptions {
  navigationKeys: "vertical" | "horizontal" | string[];
  autoActivate: boolean;
  exitKey: string | false;
  tabCycles: boolean;
  wrap: boolean;
}

/** A focusable entry in the focus tree */
export interface FocusEntry {
  node: RenderNode;
  tabIndex: number;
  parent: FocusGroup | null;
}

/** A focus group — a container whose children are navigated by arrow keys */
export interface FocusGroup extends FocusEntry {
  children: FocusEntry[];
  options: ResolvedFocusGroupOptions;
  lastFocusedIndex: number;
}

export interface FocusManager {
  /** Signal containing the currently focused render node (null if none) */
  focused: WriteSignal<RenderNode | null>;
  /** Signal containing the currently active focus group (null if at root level) */
  activeGroup: ReadSignal<RenderNode | null>;
  /** Move focus to the next focusable element */
  focusNext(): void;
  /** Move focus to the previous focusable element */
  focusPrev(): void;
  /** Focus a specific node */
  focus(node: RenderNode): void;
  /** Remove focus */
  blur(): void;
  /** Rebuild the focusable list from the layout tree */
  updateFocusableList(root: LayoutNode): void;
  /** Handle Tab/Shift+Tab. Returns true if consumed. */
  handleKey(event: KeyEvent): boolean;
  /** Handle group navigation/exit keys (fallback after dispatch). Returns true if consumed. */
  handleGroupKey(event: KeyEvent): boolean;
  /** Enter a focus group */
  enterGroup(node: RenderNode): void;
  /** Exit the current focus group */
  exitGroup(): void;
}

const DEFAULT_OPTIONS: ResolvedFocusGroupOptions = {
  navigationKeys: "vertical",
  autoActivate: true,
  exitKey: "escape",
  tabCycles: false,
  wrap: true,
};

function resolveGroupOptions(opts: true | FocusGroupOptions): ResolvedFocusGroupOptions {
  if (opts === true) return { ...DEFAULT_OPTIONS };
  return {
    navigationKeys: opts.navigationKeys ?? DEFAULT_OPTIONS.navigationKeys,
    autoActivate: opts.autoActivate ?? DEFAULT_OPTIONS.autoActivate,
    exitKey: opts.exitKey !== undefined ? opts.exitKey : DEFAULT_OPTIONS.exitKey,
    tabCycles: opts.tabCycles ?? DEFAULT_OPTIONS.tabCycles,
    wrap: opts.wrap ?? DEFAULT_OPTIONS.wrap,
  };
}

function isFocusGroup(entry: FocusEntry): entry is FocusGroup {
  return "children" in entry;
}

/**
 * Create a focus manager that tracks focus by stable RenderNode identity.
 * RenderNodes persist across frames (unlike LayoutNodes which are recreated).
 */
export function createFocusManager(): FocusManager {
  const focused = signal<RenderNode | null>(null);
  const activeGroupSignal = signal<RenderNode | null>(null);

  // Focus tree data
  let rootEntries: FocusEntry[] = [];
  let allFocusableNodes: RenderNode[] = [];
  let nodeToEntry = new Map<RenderNode, FocusEntry>();
  let activeGroupStack: FocusGroup[] = [];

  function updateActiveGroupSignal(): void {
    const top = activeGroupStack.length > 0 ? activeGroupStack[activeGroupStack.length - 1] : null;
    activeGroupSignal.value = top?.node ?? null;
  }

  // -------------------------------------------------------------------------
  // Focus tree construction
  // -------------------------------------------------------------------------

  function updateFocusableList(root: LayoutNode): void {
    // Save lastFocusedIndex from current groups before rebuild
    const savedIndices = new Map<RenderNode, number>();
    for (const [node, entry] of nodeToEntry) {
      if (isFocusGroup(entry)) {
        savedIndices.set(node, entry.lastFocusedIndex);
      }
    }

    rootEntries = [];
    allFocusableNodes = [];
    nodeToEntry = new Map();

    buildFocusTree(root, null, rootEntries);

    // Restore lastFocusedIndex on rebuilt groups
    for (const [node, entry] of nodeToEntry) {
      if (isFocusGroup(entry)) {
        const saved = savedIndices.get(node);
        if (saved !== undefined) entry.lastFocusedIndex = saved;
      }
    }

    // Restore group stack (matching by RenderNode identity)
    rebuildGroupStack();

    // Auto-capture: if a trap group exists (exitKey: false), capture focus into it
    const trap = findDeepestTrap(rootEntries);
    if (trap) {
      const current = focused.peek();
      const trapLeaves = collectLeaves(trap);
      if (trapLeaves.length > 0 && (!current || !trapLeaves.includes(current))) {
        const autoFocused = trapLeaves.find(n => n.props.autoFocus);
        activateGroupChain(trap);
        doFocus(autoFocused ?? trapLeaves[0]);
        return;
      }
    }

    // Handle autoFocus (no trap active)
    if (focused.peek() === null && allFocusableNodes.length > 0) {
      const autoFocused = allFocusableNodes.find(n => n.props.autoFocus);
      if (autoFocused) {
        focusWithGroupActivation(autoFocused);
      }
    }

    // If currently focused node is no longer in the tree, restore focus
    const current = focused.peek();
    if (current && !allFocusableNodes.includes(current)) {
      const autoFocused = allFocusableNodes.find(n => n.props.autoFocus);
      if (autoFocused) {
        focusWithGroupActivation(autoFocused);
      } else if (allFocusableNodes.length > 0) {
        focusWithGroupActivation(allFocusableNodes[0]);
      } else {
        blur();
      }
    }
  }

  function buildFocusTree(
    layoutNode: LayoutNode,
    parentGroup: FocusGroup | null,
    siblings: FocusEntry[],
  ): void {
    const rn = layoutNode.renderNode;
    const props = rn.props;
    const focusGroupProp = props.focusGroup;
    const focusTrapProp = props.focusTrap;

    // Determine if this node is a focus group
    // focusTrap translates to focusGroup with specific options
    let groupOpts: ResolvedFocusGroupOptions | null = null;
    if (focusGroupProp) {
      groupOpts = resolveGroupOptions(focusGroupProp);
    } else if (focusTrapProp) {
      groupOpts = resolveGroupOptions({ exitKey: false, tabCycles: true });
    }

    if (groupOpts) {
      const group: FocusGroup = {
        node: rn,
        tabIndex: props.tabIndex ?? 0,
        parent: parentGroup,
        children: [],
        options: groupOpts,
        lastFocusedIndex: 0,
      };
      nodeToEntry.set(rn, group);

      // Recurse into children to build the group's child list
      for (const child of layoutNode.children) {
        buildFocusTree(child, group, group.children);
      }

      // Only add to parent level if group has focusable content
      if (group.children.length > 0) {
        siblings.push(group);
        collectLeafNodesInto(group, allFocusableNodes);
      }
      return;
    }

    // Regular focusable node
    const tabIndex = props.tabIndex;
    if (tabIndex !== undefined && tabIndex >= 0) {
      const entry: FocusEntry = {
        node: rn,
        tabIndex,
        parent: parentGroup,
      };
      siblings.push(entry);
      nodeToEntry.set(rn, entry);
      allFocusableNodes.push(rn);
    }

    // Continue traversal for non-group, non-focusable nodes
    for (const child of layoutNode.children) {
      buildFocusTree(child, parentGroup, siblings);
    }
  }

  function collectLeafNodesInto(group: FocusGroup, result: RenderNode[]): void {
    for (const child of group.children) {
      if (isFocusGroup(child)) {
        collectLeafNodesInto(child, result);
      } else {
        result.push(child.node);
      }
    }
  }

  /** Collect all leaf RenderNodes inside a group */
  function collectLeaves(group: FocusGroup): RenderNode[] {
    const result: RenderNode[] = [];
    collectLeafNodesInto(group, result);
    return result;
  }

  /** Find the deepest group with exitKey: false (focus trap) */
  function findDeepestTrap(entries: FocusEntry[]): FocusGroup | null {
    let result: FocusGroup | null = null;
    for (const entry of entries) {
      if (isFocusGroup(entry)) {
        if (entry.options.exitKey === false) result = entry;
        const inner = findDeepestTrap(entry.children);
        if (inner) result = inner;
      }
    }
    return result;
  }

  /** Activate the full group chain leading to a group */
  function activateGroupChain(group: FocusGroup): void {
    const chain: FocusGroup[] = [];
    let g: FocusGroup | null = group;
    while (g) {
      chain.unshift(g);
      g = g.parent;
    }
    activeGroupStack = chain;
    updateActiveGroupSignal();
  }

  // -------------------------------------------------------------------------
  // Group stack management
  // -------------------------------------------------------------------------

  function rebuildGroupStack(): void {
    const newStack: FocusGroup[] = [];
    for (const oldGroup of activeGroupStack) {
      const entry = nodeToEntry.get(oldGroup.node);
      if (entry && isFocusGroup(entry)) {
        newStack.push(entry);
      } else {
        break; // chain is broken
      }
    }
    activeGroupStack = newStack;
    updateActiveGroupSignal();
  }

  function getActiveLevel(): FocusEntry[] {
    if (activeGroupStack.length > 0) {
      return activeGroupStack[activeGroupStack.length - 1].children;
    }
    return rootEntries;
  }

  // -------------------------------------------------------------------------
  // Sort by tabIndex (only used within focus groups)
  // -------------------------------------------------------------------------

  function sortByTabIndex(entries: FocusEntry[]): FocusEntry[] {
    if (entries.length <= 1) return entries;

    // Positive tabIndex values first (ascending), then 0s in tree order
    const positive: FocusEntry[] = [];
    const zeros: FocusEntry[] = [];
    for (const e of entries) {
      if (e.tabIndex > 0) {
        positive.push(e);
      } else {
        zeros.push(e);
      }
    }
    if (positive.length === 0) return entries; // all zeros, keep tree order
    positive.sort((a, b) => a.tabIndex - b.tabIndex);
    return [...positive, ...zeros];
  }

  // -------------------------------------------------------------------------
  // Focus / blur
  // -------------------------------------------------------------------------

  function doFocus(node: RenderNode): void {
    const prev = focused.peek();
    if (prev === node) return;

    if (prev) {
      const onBlur = prev.props.onBlur;
      if (onBlur) onBlur();
    }

    focused.value = node;

    const onFocus = node.props.onFocus;
    if (onFocus) onFocus();
  }

  function blur(): void {
    const prev = focused.peek();
    if (prev) {
      const onBlur = prev.props.onBlur;
      if (onBlur) onBlur();
    }
    focused.value = null;
  }

  /** Focus a node and activate the full group chain to reach it */
  function focusWithGroupActivation(node: RenderNode): void {
    const entry = nodeToEntry.get(node);
    if (!entry) {
      doFocus(node);
      return;
    }

    // Build the group chain from entry up to root
    const chain: FocusGroup[] = [];
    let p = entry.parent;
    while (p) {
      chain.unshift(p);
      p = p.parent;
    }

    activeGroupStack = chain;
    updateActiveGroupSignal();
    doFocus(node);
  }

  // -------------------------------------------------------------------------
  // Navigation helpers
  // -------------------------------------------------------------------------

  function isNodeInsideGroup(node: RenderNode, group: FocusGroup): boolean {
    for (const child of group.children) {
      if (child.node === node) return true;
      if (isFocusGroup(child) && isNodeInsideGroup(node, child)) return true;
    }
    return false;
  }

  function focusEntry(entry: FocusEntry, direction: number): void {
    if (isFocusGroup(entry)) {
      if (entry.options.autoActivate) {
        enterGroupInternal(entry, direction);
      } else {
        // Focus the group node itself (needs tabIndex to be meaningful)
        doFocus(entry.node);
      }
    } else {
      doFocus(entry.node);
    }
  }

  function findCurrentIndex(sorted: FocusEntry[]): number {
    const current = focused.peek();
    if (!current) return -1;
    return sorted.findIndex(e => e.node === current || (isFocusGroup(e) && isNodeInsideGroup(current, e)));
  }

  // -------------------------------------------------------------------------
  // Tab navigation
  // -------------------------------------------------------------------------

  function focusNext(): void {
    navigateTab(+1);
  }

  function focusPrev(): void {
    navigateTab(-1);
  }

  function navigateTab(direction: number): void {
    const group = activeGroupStack.length > 0
      ? activeGroupStack[activeGroupStack.length - 1]
      : null;

    // Inside a group with tabCycles: true → cycle within children
    if (group && group.options.tabCycles) {
      moveInGroup(direction, group, true);
      return;
    }

    // Inside a group with tabCycles: false → exit and advance at parent level
    if (group && !group.options.tabCycles) {
      saveLastFocused(group);
      exitGroupInternal();
      advancePastEntry(group, direction);
      return;
    }

    // At root level → advance in tree order (no tabIndex sorting)
    advanceAtRootLevel(direction);
  }

  /** Advance to the next entry after exitedEntry at the current level */
  function advancePastEntry(exitedEntry: FocusEntry, direction: number): void {
    const inGroup = activeGroupStack.length > 0;
    const level = getActiveLevel();
    const sorted = inGroup ? sortByTabIndex(level) : level;

    const idx = sorted.indexOf(exitedEntry);
    if (idx === -1) {
      // Shouldn't happen, but recover gracefully
      if (sorted.length > 0) focusEntry(sorted[0], direction);
      return;
    }

    const nextIdx = idx + direction;

    if (nextIdx < 0 || nextIdx >= sorted.length) {
      // At boundary of parent level
      const parentGroup = activeGroupStack.length > 0
        ? activeGroupStack[activeGroupStack.length - 1]
        : null;

      if (parentGroup && !parentGroup.options.tabCycles) {
        // Exit parent group too and advance at grandparent level
        saveLastFocused(parentGroup);
        exitGroupInternal();
        advancePastEntry(parentGroup, direction);
        return;
      }

      // Wrap (root level or tabCycles parent)
      const wrappedIdx = (nextIdx + sorted.length) % sorted.length;
      focusEntry(sorted[wrappedIdx], direction);
      return;
    }

    focusEntry(sorted[nextIdx], direction);
  }

  /** Navigate at root level (tree order, no tabIndex sorting) */
  function advanceAtRootLevel(direction: number): void {
    const level = rootEntries;
    if (level.length === 0) return;

    const idx = findCurrentIndex(level);

    if (idx === -1) {
      // Nothing focused at this level
      const target = direction > 0 ? level[0] : level[level.length - 1];
      focusEntry(target, direction);
      return;
    }

    const nextIdx = idx + direction;

    if (nextIdx < 0 || nextIdx >= level.length) {
      // Wrap at root
      const wrappedIdx = (nextIdx + level.length) % level.length;
      focusEntry(level[wrappedIdx], direction);
      return;
    }

    focusEntry(level[nextIdx], direction);
  }

  // -------------------------------------------------------------------------
  // Arrow key navigation within groups
  // -------------------------------------------------------------------------

  /**
   * Move within a group's children.
   * forceWrap: true for Tab in tabCycles groups, false for arrow keys (uses group.options.wrap).
   */
  function moveInGroup(direction: number, group: FocusGroup, forceWrap: boolean): void {
    const sorted = sortByTabIndex(group.children);
    if (sorted.length === 0) return;

    const idx = findCurrentIndex(sorted);

    if (idx === -1) {
      focusEntry(sorted[direction > 0 ? 0 : sorted.length - 1], direction);
      return;
    }

    const nextIdx = idx + direction;
    const shouldWrap = forceWrap || group.options.wrap;

    if (nextIdx < 0 || nextIdx >= sorted.length) {
      if (shouldWrap) {
        const wrappedIdx = (nextIdx + sorted.length) % sorted.length;
        focusEntry(sorted[wrappedIdx], direction);
      }
      return;
    }

    focusEntry(sorted[nextIdx], direction);
  }

  // -------------------------------------------------------------------------
  // Group enter / exit
  // -------------------------------------------------------------------------

  function enterGroupInternal(group: FocusGroup, direction: number): void {
    activeGroupStack.push(group);
    updateActiveGroupSignal();

    const sorted = sortByTabIndex(group.children);
    if (sorted.length === 0) return;

    // Forward entry: restore last focused position. Backward entry: focus last.
    if (direction > 0) {
      const restoredIdx = Math.min(group.lastFocusedIndex, sorted.length - 1);
      focusEntry(sorted[restoredIdx], direction);
    } else {
      focusEntry(sorted[sorted.length - 1], direction);
    }
  }

  function exitGroupInternal(): void {
    if (activeGroupStack.length === 0) return;
    activeGroupStack.pop();
    updateActiveGroupSignal();
  }

  function saveLastFocused(group: FocusGroup): void {
    const current = focused.peek();
    if (!current) return;
    const sorted = sortByTabIndex(group.children);
    const idx = sorted.findIndex(e => e.node === current || (isFocusGroup(e) && isNodeInsideGroup(current, e)));
    if (idx !== -1) {
      group.lastFocusedIndex = idx;
    }
  }

  // -------------------------------------------------------------------------
  // Public API: enterGroup / exitGroup
  // -------------------------------------------------------------------------

  function enterGroup(node: RenderNode): void {
    const entry = nodeToEntry.get(node);
    if (!entry || !isFocusGroup(entry)) return;
    enterGroupInternal(entry, +1);
  }

  /** Exit the current group (Escape). Does not change focused node. */
  function exitGroup(): void {
    if (activeGroupStack.length === 0) return;
    const group = activeGroupStack[activeGroupStack.length - 1];
    if (group.options.exitKey === false) return; // trapped
    saveLastFocused(group);
    exitGroupInternal();
    // Don't change focused node — it stays on the last focused child.
    // Next Tab/arrow will navigate from the group's position at the parent level.
  }

  // -------------------------------------------------------------------------
  // Public: focus(node) with group activation
  // -------------------------------------------------------------------------

  function focus(node: RenderNode): void {
    focusWithGroupActivation(node);
  }

  // -------------------------------------------------------------------------
  // Key handlers
  // -------------------------------------------------------------------------

  /** Handle Tab/Shift+Tab. Returns true if consumed. */
  function handleKey(event: KeyEvent): boolean {
    if (event.key === "tab" && !event.ctrl && !event.alt) {
      if (event.shift) {
        focusPrev();
      } else {
        focusNext();
      }
      return true;
    }
    return false;
  }

  /** Handle group navigation/exit keys (fallback after dispatch). Returns true if consumed. */
  function handleGroupKey(event: KeyEvent): boolean {
    if (activeGroupStack.length === 0) return false;

    const group = activeGroupStack[activeGroupStack.length - 1];

    // Check exit key
    if (group.options.exitKey !== false && event.key === group.options.exitKey && !event.ctrl && !event.alt && !event.shift) {
      exitGroup();
      return true;
    }

    // Check navigation keys
    const navKeys = group.options.navigationKeys;
    let direction: number | null = null;

    if (navKeys === "vertical") {
      if (event.key === "up") direction = -1;
      else if (event.key === "down") direction = +1;
    } else if (navKeys === "horizontal") {
      if (event.key === "left") direction = -1;
      else if (event.key === "right") direction = +1;
    } else if (Array.isArray(navKeys)) {
      const idx = navKeys.indexOf(event.key);
      if (idx !== -1) {
        // Even indices = backward, odd indices = forward
        direction = idx % 2 === 0 ? -1 : +1;
      }
    }

    if (direction !== null && !event.ctrl && !event.alt) {
      moveInGroup(direction, group, false);
      return true;
    }

    return false;
  }

  return {
    focused,
    activeGroup: activeGroupSignal,
    focusNext,
    focusPrev,
    focus,
    blur,
    updateFocusableList,
    handleKey,
    handleGroupKey,
    enterGroup,
    exitGroup,
  };
}
