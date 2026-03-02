import type { KeyEvent } from "./keyboard.js";
import type { MouseEvent } from "./mouse.js";
import type { ScrollEvent } from "../element/types.js";
import type { LayoutNode } from "../layout/types.js";
import { type RenderNode, onCleanup, PORTAL } from "../element/reconciler.js";
import { peekValue } from "../reactive/utils.js";
import type { RenderInstance } from "../instance.js";
import { getActiveInstance } from "../instance.js";

// ---------------------------------------------------------------------------
// Event System — bubbling, hit testing, global handlers
//
// Key events bubble from the focused RenderNode up through parents to root,
// then fall through to global handlers.
//
// Mouse events use hit testing against the layout tree. Portals are tested
// first (highest zIndex first, matching the visual stacking order), then the
// normal flow tree. Within each subtree, children are tested in reverse
// zIndex order (highest first) so visually topmost elements receive events.
//
// Scroll containers offset hit-test coordinates: screen space → content
// space by adding the scroll offset, since children are positioned in
// content coordinates while the mouse reports screen coordinates.
// ---------------------------------------------------------------------------

/** Handler handled the event — stop bubbling */
export const Handled = true as const;
/** Handler did not handle the event — continue bubbling */
export const Propagate = false as const;

export type TuileKeyHandler = (event: KeyEvent) => boolean;
export type TuileMouseHandler = (event: MouseEvent) => boolean;
export type TuileScrollHandler = (event: ScrollEvent) => boolean;

/** Per-instance global key handler registries */
const instanceKeyHandlers = new WeakMap<RenderInstance, TuileKeyHandler[]>();

/** Get the key handlers for a render instance */
export function getInstanceKeyHandlers(inst: RenderInstance): TuileKeyHandler[] {
  let handlers = instanceKeyHandlers.get(inst);
  if (!handlers) {
    handlers = [];
    instanceKeyHandlers.set(inst, handlers);
  }
  return handlers;
}

/**
 * Register a global key handler. Must be called during component mount
 * (inside a component function body). Returns an unsubscribe function.
 */
export function onGlobalKey(handler: TuileKeyHandler): () => void {
  const inst = getActiveInstance();
  if (!inst) {
    throw new Error("onGlobalKey must be called during component mount (inside a component function body)");
  }
  const handlers = getInstanceKeyHandlers(inst);
  handlers.push(handler);
  const unsubscribe = () => {
    const idx = handlers.indexOf(handler);
    if (idx !== -1) handlers.splice(idx, 1);
  };
  onCleanup(unsubscribe);
  return unsubscribe;
}

/**
 * Dispatch a key event through the element tree.
 * First tries the focused element and bubbles up, then falls through to global handlers.
 */
export function dispatchKeyEvent(
  event: KeyEvent,
  focusedNode: RenderNode | null,
  globalHandlers: TuileKeyHandler[] = [],
): boolean {
  // Bubble from focused render node up to root
  let node = focusedNode;
  while (node) {
    const handler = node.props.onKeyPress;
    if (handler) {
      if (handler(event) === Handled) return true;
    }
    node = node.parent;
  }

  // Global handlers
  for (const handler of globalHandlers) {
    if (handler(event) === Handled) return true;
  }

  return false;
}

/**
 * Dispatch a mouse event. Hit-tests against the layout tree.
 */
export function dispatchMouseEvent(event: MouseEvent, rootLayout: LayoutNode): void {
  // Hit test: find the deepest node at (x, y)
  const target = hitTest(rootLayout, event.x, event.y);
  if (!target) return;

  // Determine handler prop name
  let handlerName: string;
  switch (event.type) {
    case "press":
    case "release":
      handlerName = "onClick";
      break;
    case "move":
      handlerName = "onMouseMove";
      break;
    case "scroll":
      handlerName = "onScroll";
      break;
    default:
      return;
  }

  // Bubble from target up
  let node: LayoutNode | null = target;
  while (node) {
    const handler = node.renderNode.props[handlerName];
    if (handler) {
      if (handler(event) === Handled) return;
    }
    node = node.parent;
  }
}

/**
 * Find the deepest layout node at the given (x, y) position.
 * Tests portals first (highest zIndex first, matching paint order),
 * then the normal flow tree. Accounts for scroll offset in scroll containers.
 */
export function hitTest(root: LayoutNode, x: number, y: number): LayoutNode | null {
  // Collect portals from the tree (mirrors paintTree's two-pass approach)
  const portals: LayoutNode[] = [];
  collectPortals(root, portals);

  // Test portals first — highest zIndex first (they're visually on top)
  if (portals.length > 0) {
    portals.sort((a, b) => (b.renderNode.props.zIndex ?? 0) - (a.renderNode.props.zIndex ?? 0));
    for (const portal of portals) {
      const hit = hitTestNode(portal, x, y, false);
      if (hit) return hit;
    }
  }

  // Then test normal tree (skipping portals)
  return hitTestNode(root, x, y, true);
}

/** Collect portal nodes from the layout tree */
function collectPortals(node: LayoutNode, result: LayoutNode[]): void {
  if (node.renderNode.type === PORTAL) {
    result.push(node);
    return;
  }
  for (const child of node.children) {
    collectPortals(child, result);
  }
}

/** Recursive hit-test against a single subtree */
function hitTestNode(node: LayoutNode, x: number, y: number, skipPortals: boolean): LayoutNode | null {
  if (skipPortals && node.renderNode.type === PORTAL) return null;

  const { layout } = node;

  // Check if point is within this node's bounds
  if (
    x < layout.x ||
    x >= layout.x + layout.width ||
    y < layout.y ||
    y >= layout.y + layout.height
  ) {
    return null;
  }

  // Adjust coordinates for scroll offset — children are positioned in
  // content space, so we add the scroll offset to convert screen→content
  let childX = x;
  let childY = y;
  if (node.renderNode.props.scrollOffsetX != null) {
    childX = x + peekValue(node.renderNode.props.scrollOffsetX);
  }
  if (node.renderNode.props.scrollOffsetY != null) {
    childY = y + peekValue(node.renderNode.props.scrollOffsetY);
  }

  // Sort children by zIndex descending (highest first) for hit testing
  const children = getZSortedChildrenDesc(node);

  for (const child of children) {
    const hit = hitTestNode(child, childX, childY, skipPortals);
    if (hit) return hit;
  }

  // This node contains the point
  return node;
}

/** Return children sorted by zIndex descending (highest first) for hit testing */
function getZSortedChildrenDesc(node: LayoutNode): LayoutNode[] {
  let hasZIndex = false;
  for (const child of node.children) {
    if (child.renderNode.props.zIndex !== undefined) {
      hasZIndex = true;
      break;
    }
  }

  if (!hasZIndex) {
    // No zIndex — check in reverse tree order (last child first)
    const reversed: LayoutNode[] = [];
    for (let i = node.children.length - 1; i >= 0; i--) {
      reversed.push(node.children[i]);
    }
    return reversed;
  }

  // Sort descending by zIndex
  const sorted = [...node.children];
  sorted.sort((a, b) => {
    const za = a.renderNode.props.zIndex ?? 0;
    const zb = b.renderNode.props.zIndex ?? 0;
    return zb - za;
  });
  return sorted;
}
