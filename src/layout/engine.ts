import { type RenderNode, BOX, TEXT, PORTAL, FRAGMENT, TEXT_NODE } from "../element/reconciler.js";
import type { LayoutNode, Constraints, Layout, Edges } from "./types.js";
import type { Direction, Align, Justify, SizeValue } from "../element/types.js";
import { resolveEdges, resolveSize, borderSize, measureText } from "./constraints.js";

// ---------------------------------------------------------------------------
// Layout Engine — 2-pass constraint-based layout
// ---------------------------------------------------------------------------

/**
 * Compute layout for a render tree given terminal dimensions.
 */
export function computeLayout(root: RenderNode, termWidth: number, termHeight: number): LayoutNode {
  layoutGeneration++;
  const layoutRoot = buildLayoutTree(root, null);
  const rootConstraints: Constraints = { maxWidth: termWidth, maxHeight: termHeight };

  // Pass 1: Top-down — distribute constraints (portals receive root constraints)
  distributeConstraints(layoutRoot, rootConstraints, rootConstraints);

  // Pass 2: Bottom-up — resolve intrinsic sizes (portals excluded from parent aggregation)
  resolveSizes(layoutRoot);

  // Pass 3: Flex distribution — grow/shrink children along main axis
  distributeFlex(layoutRoot);

  // Pass 3.5: Re-measure text that overflows after flex changed parent widths
  reflowText(layoutRoot);

  // Position children (portals excluded from flow, positioned at 0,0)
  positionChildren(layoutRoot, 0, 0);

  return layoutRoot;
}

// ---------------------------------------------------------------------------
// Build / sync layout tree from render tree
// ---------------------------------------------------------------------------

/** Cache: RenderNode → its most recent LayoutNode */
const layoutCache = new WeakMap<RenderNode, LayoutNode>();

/** Monotonically increasing generation counter for cache invalidation */
let layoutGeneration = 0;

function buildLayoutTree(node: RenderNode, parent: LayoutNode | null): LayoutNode {
  const gen = layoutGeneration;
  let layoutNode = layoutCache.get(node);

  if (layoutNode) {
    // Reuse existing node — reset layout values for fresh computation
    layoutNode.layout.x = 0;
    layoutNode.layout.y = 0;
    layoutNode.layout.width = 0;
    layoutNode.layout.height = 0;
    layoutNode.constraints.maxWidth = 0;
    layoutNode.constraints.maxHeight = 0;
    layoutNode.parent = parent;
    layoutNode.generation = gen;
  } else {
    // Create new node
    layoutNode = {
      renderNode: node,
      layout: { x: 0, y: 0, width: 0, height: 0 },
      constraints: { maxWidth: 0, maxHeight: 0 },
      children: [],
      parent,
      generation: gen,
    };
    layoutCache.set(node, layoutNode);
  }

  // Sync children — reuse LayoutNode array, rebuild contents
  layoutNode.children.length = 0;

  for (const child of node.children) {
    // Flatten fragments
    if (child.type === FRAGMENT) {
      for (const fragmentChild of child.children) {
        layoutNode.children.push(buildLayoutTree(fragmentChild, layoutNode));
      }
    } else {
      layoutNode.children.push(buildLayoutTree(child, layoutNode));
    }
  }

  return layoutNode;
}

// ---------------------------------------------------------------------------
// Pass 1: Top-down constraint distribution
// ---------------------------------------------------------------------------

function distributeConstraints(node: LayoutNode, constraints: Constraints, rootConstraints: Constraints): void {
  const { renderNode } = node;
  const props = renderNode.props;

  // Store constraints for use in pass 2
  node.constraints = constraints;

  if (renderNode.type === TEXT_NODE || renderNode.type === TEXT) {
    // Text/leaf nodes just receive their constraints
    // Also propagate to __text children of text elements
    for (const child of node.children) {
      child.constraints = constraints;
      distributeConstraints(child, constraints, rootConstraints);
    }
    return;
  }

  // Resolve fixed/percentage dimensions
  const explicitWidth = resolveSize(props.width, constraints.maxWidth);
  const explicitHeight = resolveSize(props.height, constraints.maxHeight);

  let maxW = explicitWidth === "auto" ? constraints.maxWidth : explicitWidth;
  let maxH = explicitHeight === "auto" ? constraints.maxHeight : explicitHeight;

  // Cap with maxWidth/maxHeight props
  if (typeof props.maxWidth === "number") maxW = Math.min(maxW, props.maxWidth);
  if (typeof props.maxHeight === "number") maxH = Math.min(maxH, props.maxHeight);

  // Subtract padding and border from available space for children
  const padding = resolveEdges(props, "padding");
  const border = borderSize(props.border);
  const innerWidth = Math.max(0, maxW - padding.left - padding.right - border.left - border.right);
  const innerHeight = Math.max(0, maxH - padding.top - padding.bottom - border.top - border.bottom);

  const direction: Direction = props.direction ?? "vertical";
  const gap: number = props.gap ?? 0;

  // Count only in-flow children for gap calculation
  const inFlowChildren = node.children.filter(c => c.renderNode.type !== PORTAL);
  const inFlowCount = inFlowChildren.length;
  const totalGap = inFlowCount > 1 ? gap * (inFlowCount - 1) : 0;

  const isScrollContainer = props.overflow === "scroll";

  if (direction === "vertical") {
    // Each child receives the full available height as its max constraint.
    // Flex shrink (pass 3, default shrink=1) corrects overflow post-hoc.
    const availableHeight = Math.max(0, innerHeight - totalGap);
    for (const child of node.children) {
      // Portals are out-of-flow — give them root constraints
      if (child.renderNode.type === PORTAL) {
        distributeConstraints(child, rootConstraints, rootConstraints);
        continue;
      }
      const childConstraints: Constraints = {
        maxWidth: innerWidth,
        maxHeight: isScrollContainer ? Number.MAX_SAFE_INTEGER : availableHeight,
      };
      distributeConstraints(child, childConstraints, rootConstraints);
    }
  } else {
    const availableWidth = Math.max(0, innerWidth - totalGap);
    for (const child of node.children) {
      // Portals are out-of-flow — give them root constraints
      if (child.renderNode.type === PORTAL) {
        distributeConstraints(child, rootConstraints, rootConstraints);
        continue;
      }
      const childConstraints: Constraints = {
        maxWidth: isScrollContainer ? Number.MAX_SAFE_INTEGER : availableWidth,
        maxHeight: innerHeight,
      };
      distributeConstraints(child, childConstraints, rootConstraints);
    }
  }
}

// ---------------------------------------------------------------------------
// Pass 2: Bottom-up size resolution
// ---------------------------------------------------------------------------

function resolveSizes(node: LayoutNode): void {
  const { renderNode } = node;
  const props = renderNode.props;
  const constraints = node.constraints;

  // Resolve children first (bottom-up)
  for (const child of node.children) {
    resolveSizes(child);
  }

  if (renderNode.type === TEXT_NODE) {
    // Leaf text node — measure content
    const text = renderNode.text ?? "";
    const measurement = measureText(text, constraints.maxWidth);
    node.layout.width = measurement.width;
    node.layout.height = measurement.height;
    return;
  }

  if (renderNode.type === TEXT) {
    // Text element — aggregate text children
    const wrap = props.wrap ?? "word";
    const textContent = collectText(renderNode);
    const measurement = measureText(textContent, constraints.maxWidth, wrap);
    node.layout.width = measurement.width;
    node.layout.height = measurement.height;

    // Also size any non-text children
    for (const child of node.children) {
      if (child.layout.width > node.layout.width) {
        node.layout.width = child.layout.width;
      }
    }
    return;
  }

  // Box element
  const direction: Direction = props.direction ?? "vertical";
  const gap: number = props.gap ?? 0;
  const padding = resolveEdges(props, "padding");
  const border = borderSize(props.border);

  // Aggregate children sizes (portals are out-of-flow, excluded from content)
  let contentWidth = 0;
  let contentHeight = 0;
  let inFlowIndex = 0;

  if (direction === "vertical") {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.renderNode.type === PORTAL) continue;
      contentWidth = Math.max(contentWidth, child.layout.width);
      contentHeight += child.layout.height;
      if (inFlowIndex > 0) contentHeight += gap;
      inFlowIndex++;
    }
  } else {
    for (let i = 0; i < node.children.length; i++) {
      const child = node.children[i];
      if (child.renderNode.type === PORTAL) continue;
      contentWidth += child.layout.width;
      contentHeight = Math.max(contentHeight, child.layout.height);
      if (inFlowIndex > 0) contentWidth += gap;
      inFlowIndex++;
    }
  }

  // Add padding and border
  const totalWidth = contentWidth + padding.left + padding.right + border.left + border.right;
  const totalHeight = contentHeight + padding.top + padding.bottom + border.top + border.bottom;

  // Resolve explicit sizes or use intrinsic
  const explicitWidth = resolveSize(props.width, constraints.maxWidth);
  const explicitHeight = resolveSize(props.height, constraints.maxHeight);

  node.layout.width = explicitWidth === "auto"
    ? Math.min(totalWidth, constraints.maxWidth)
    : explicitWidth;
  node.layout.height = explicitHeight === "auto"
    ? Math.min(totalHeight, constraints.maxHeight)
    : explicitHeight;

  // Clamp to min/max constraints
  if (typeof props.minWidth === "number") node.layout.width = Math.max(node.layout.width, props.minWidth);
  if (typeof props.maxWidth === "number") node.layout.width = Math.min(node.layout.width, props.maxWidth);
  if (typeof props.minHeight === "number") node.layout.height = Math.max(node.layout.height, props.minHeight);
  if (typeof props.maxHeight === "number") node.layout.height = Math.min(node.layout.height, props.maxHeight);
}

// ---------------------------------------------------------------------------
// Pass 3: Flex distribution
// ---------------------------------------------------------------------------

function distributeFlex(node: LayoutNode): void {
  const { renderNode } = node;
  if (renderNode.type === TEXT_NODE || renderNode.type === TEXT) return;
  if (node.children.length === 0) return;

  // Skip flex for scroll containers — content is unconstrained
  if (renderNode.props.overflow === "scroll") return;

  const props = renderNode.props;
  const direction: Direction = props.direction ?? "vertical";
  const gap: number = props.gap ?? 0;
  const padding = resolveEdges(props, "padding");
  const border = borderSize(props.border);

  const innerWidth = node.layout.width - padding.left - padding.right - border.left - border.right;
  const innerHeight = node.layout.height - padding.top - padding.bottom - border.top - border.bottom;
  const mainSpace = direction === "vertical" ? innerHeight : innerWidth;

  // Filter to in-flow children only (portals are out-of-flow)
  const inFlowChildren = node.children.filter(c => c.renderNode.type !== PORTAL);

  // Re-resolve percentage-based sizes against actual parent dimensions.
  // Pass 2 resolved percentages against constraints.maxWidth/maxHeight, which
  // may exceed the actual dimensions after flex distribution (e.g. a "100%"-wide
  // child inside a flex-shrunk container). Re-resolving here mirrors CSS where
  // percentage sizes resolve against the containing block's used dimensions.
  for (const child of inFlowChildren) {
    const cp = child.renderNode.props;
    if (typeof cp.width === "string" && cp.width.endsWith("%")) {
      const resolved = resolveSize(cp.width as SizeValue, innerWidth);
      if (resolved !== "auto") child.layout.width = resolved;
    }
    if (typeof cp.height === "string" && cp.height.endsWith("%")) {
      const resolved = resolveSize(cp.height as SizeValue, innerHeight);
      if (resolved !== "auto") child.layout.height = resolved;
    }
  }

  // Calculate total intrinsic size on main axis (flexBasis overrides intrinsic)
  let totalIntrinsic = 0;
  const totalGap = inFlowChildren.length > 1 ? gap * (inFlowChildren.length - 1) : 0;
  for (const child of inFlowChildren) {
    const basis = child.renderNode.props.flexBasis as number | undefined;
    const intrinsic = direction === "vertical" ? child.layout.height : child.layout.width;
    totalIntrinsic += basis !== undefined ? basis : intrinsic;
  }
  totalIntrinsic += totalGap;

  const freeSpace = mainSpace - totalIntrinsic;

  if (freeSpace > 0) {
    // Distribute free space to flexGrow children
    let totalGrow = 0;
    for (const child of inFlowChildren) {
      const cp = child.renderNode.props;
      const grow = cp.flex ?? cp.flexGrow ?? 0;
      totalGrow += grow;
    }

    if (totalGrow > 0) {
      let distributed = 0;
      const growEntries: { child: LayoutNode; extra: number }[] = [];

      for (const child of inFlowChildren) {
        const cp = child.renderNode.props;
        const grow = cp.flex ?? cp.flexGrow ?? 0;
        if (grow > 0) {
          const extra = Math.floor((freeSpace * grow) / totalGrow);
          growEntries.push({ child, extra });
          distributed += extra;
        }
      }

      // Distribute rounding remainder (1px each to first N children)
      let remainder = freeSpace - distributed;
      for (const entry of growEntries) {
        const bonus = remainder > 0 ? 1 : 0;
        const basis = entry.child.renderNode.props.flexBasis as number | undefined;
        if (direction === "vertical") {
          if (basis !== undefined) {
            entry.child.layout.height = basis + entry.extra + bonus;
          } else {
            entry.child.layout.height += entry.extra + bonus;
          }
        } else {
          if (basis !== undefined) {
            entry.child.layout.width = basis + entry.extra + bonus;
          } else {
            entry.child.layout.width += entry.extra + bonus;
          }
        }
        if (remainder > 0) remainder--;
      }
    }
  } else if (freeSpace < 0) {
    // Shrink flexShrink children (default shrink=1 matches CSS flexbox)
    let totalShrink = 0;
    for (const child of inFlowChildren) {
      const cp = child.renderNode.props;
      const shrink = cp.flexShrink ?? 1;
      totalShrink += shrink;
    }

    if (totalShrink > 0) {
      const overflow = -freeSpace;
      let distributed = 0;
      const shrinkEntries: { child: LayoutNode; reduction: number }[] = [];

      for (const child of inFlowChildren) {
        const cp = child.renderNode.props;
        const shrink = cp.flexShrink ?? 1;
        if (shrink > 0) {
          const reduction = Math.floor((overflow * shrink) / totalShrink);
          shrinkEntries.push({ child, reduction });
          distributed += reduction;
        }
      }

      // Distribute rounding remainder (1px extra shrink to first N children)
      let remainder = overflow - distributed;
      for (const entry of shrinkEntries) {
        const bonus = remainder > 0 ? 1 : 0;
        const totalReduction = entry.reduction + bonus;
        const basis = entry.child.renderNode.props.flexBasis as number | undefined;
        if (direction === "vertical") {
          const base = basis !== undefined ? basis : entry.child.layout.height;
          entry.child.layout.height = Math.max(0, base - totalReduction);
        } else {
          const base = basis !== undefined ? basis : entry.child.layout.width;
          entry.child.layout.width = Math.max(0, base - totalReduction);
        }
        if (remainder > 0) remainder--;
      }
    }
  }

  // Clamp children to min/max after flex distribution
  for (const child of inFlowChildren) {
    const cp = child.renderNode.props;
    if (typeof cp.minWidth === "number") child.layout.width = Math.max(child.layout.width, cp.minWidth);
    if (typeof cp.maxWidth === "number") child.layout.width = Math.min(child.layout.width, cp.maxWidth);
    if (typeof cp.minHeight === "number") child.layout.height = Math.max(child.layout.height, cp.minHeight);
    if (typeof cp.maxHeight === "number") child.layout.height = Math.min(child.layout.height, cp.maxHeight);
  }

  // Cross-axis stretch: expand children to fill cross dimension
  const crossAlign: Align = props.align ?? "stretch";
  const crossSpace = direction === "vertical" ? innerWidth : innerHeight;
  for (const child of inFlowChildren) {
    const selfAlign = child.renderNode.props.alignSelf ?? crossAlign;
    if (selfAlign === "stretch") {
      if (direction === "vertical") {
        if (child.renderNode.props.width === undefined) child.layout.width = crossSpace;
      } else {
        if (child.renderNode.props.height === undefined) child.layout.height = crossSpace;
      }
    }
  }

  // Recurse AFTER distributing at this level (top-down)
  for (const child of node.children) {
    distributeFlex(child);
  }
}

// ---------------------------------------------------------------------------
// Pass 3.5: Reflow text after flex
// ---------------------------------------------------------------------------
//
// Flex distribution (pass 3) can change a container's width after text was
// already measured in pass 2.  This pass walks top-down, clamping children to
// their parent's actual inner width and re-measuring any text nodes that no
// longer fit.  Heights are propagated upward for auto-sized ancestors.

function reflowText(node: LayoutNode): boolean {
  const { renderNode } = node;
  if (renderNode.type === TEXT_NODE || renderNode.type === TEXT) return false;
  if (node.children.length === 0) return false;

  const props = renderNode.props;
  const padding = resolveEdges(props, "padding");
  const border = borderSize(props.border);
  const innerWidth = Math.max(0, node.layout.width - padding.left - padding.right - border.left - border.right);

  let changed = false;

  for (const child of node.children) {
    if (child.renderNode.type === PORTAL) continue;

    if (child.renderNode.type === TEXT) {
      if (innerWidth > 0) {
        const wrap = child.renderNode.props.wrap ?? "word";
        const textContent = collectText(child.renderNode);
        const measurement = measureText(textContent, innerWidth, wrap);
        if (measurement.width !== child.layout.width || measurement.height !== child.layout.height) {
          child.layout.width = measurement.width;
          child.layout.height = measurement.height;
          changed = true;
        }
      }
    } else if (child.renderNode.type !== TEXT_NODE) {
      if (child.layout.width > innerWidth) {
        child.layout.width = innerWidth;
      }
      if (reflowText(child)) {
        changed = true;
      }
    }
  }

  // Propagate height changes upward for auto-sized containers
  if (changed && props.height === undefined) {
    const direction: Direction = props.direction ?? "vertical";
    const gap: number = props.gap ?? 0;

    let contentHeight = 0;
    let inFlowIndex = 0;

    if (direction === "vertical") {
      for (const child of node.children) {
        if (child.renderNode.type === PORTAL) continue;
        contentHeight += child.layout.height;
        if (inFlowIndex > 0) contentHeight += gap;
        inFlowIndex++;
      }
    } else {
      for (const child of node.children) {
        if (child.renderNode.type === PORTAL) continue;
        contentHeight = Math.max(contentHeight, child.layout.height);
        inFlowIndex++;
      }
    }

    const totalHeight = contentHeight + padding.top + padding.bottom + border.top + border.bottom;
    // Only grow — shrinking would undo flex-distributed heights from pass 3,
    // since auto-sized containers can't distinguish intrinsic vs flex height.
    if (totalHeight > node.layout.height) {
      node.layout.height = totalHeight;
    }
  }

  return changed;
}

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

function positionChildren(node: LayoutNode, x: number, y: number): void {
  const { renderNode } = node;
  node.layout.x = x;
  node.layout.y = y;

  if (renderNode.type === TEXT_NODE || renderNode.type === TEXT) {
    // Leaf nodes — no children to position
    return;
  }

  const props = renderNode.props;
  const direction: Direction = props.direction ?? "vertical";
  const gap: number = props.gap ?? 0;
  const align: Align = props.align ?? "stretch";
  const justify: Justify = props.justify ?? "start";
  const padding = resolveEdges(props, "padding");
  const border = borderSize(props.border);

  const innerX = x + padding.left + border.left;
  const innerY = y + padding.top + border.top;
  const innerWidth = node.layout.width - padding.left - padding.right - border.left - border.right;
  const innerHeight = node.layout.height - padding.top - padding.bottom - border.top - border.bottom;

  // Separate in-flow children from portals
  const inFlowChildren: LayoutNode[] = [];
  const portalChildren: LayoutNode[] = [];
  for (const child of node.children) {
    if (child.renderNode.type === PORTAL) {
      portalChildren.push(child);
    } else {
      inFlowChildren.push(child);
    }
  }

  // Calculate total content size along main axis for justification
  let totalMainSize = 0;
  for (let i = 0; i < inFlowChildren.length; i++) {
    const child = inFlowChildren[i];
    totalMainSize += direction === "vertical" ? child.layout.height : child.layout.width;
    if (i > 0) totalMainSize += gap;
  }

  const mainSpace = direction === "vertical" ? innerHeight : innerWidth;
  const freeSpace = Math.max(0, mainSpace - totalMainSize);

  // Justification offsets
  let mainOffset = 0;
  let spaceBetween = gap;

  if (justify === "center") {
    mainOffset = Math.floor(freeSpace / 2);
  } else if (justify === "end") {
    mainOffset = freeSpace;
  } else if (justify === "space-between" && inFlowChildren.length > 1) {
    spaceBetween = gap + freeSpace / (inFlowChildren.length - 1);
  } else if (justify === "space-around" && inFlowChildren.length > 0) {
    const unit = freeSpace / inFlowChildren.length;
    mainOffset = unit / 2;
    spaceBetween = gap + unit;
  } else if (justify === "space-evenly" && inFlowChildren.length > 0) {
    const unit = freeSpace / (inFlowChildren.length + 1);
    mainOffset = unit;
    spaceBetween = gap + unit;
  }

  // Position in-flow children
  let cursor = mainOffset;
  for (let i = 0; i < inFlowChildren.length; i++) {
    const child = inFlowChildren[i];
    let childX: number;
    let childY: number;

    const childAlign = child.renderNode.props.alignSelf ?? align;

    if (direction === "vertical") {
      childY = innerY + cursor;
      childX = innerX + crossOffset(child.layout.width, innerWidth, childAlign);
      cursor += child.layout.height + (i < inFlowChildren.length - 1 ? spaceBetween : 0);
    } else {
      childX = innerX + cursor;
      childY = innerY + crossOffset(child.layout.height, innerHeight, childAlign);
      cursor += child.layout.width + (i < inFlowChildren.length - 1 ? spaceBetween : 0);
    }

    positionChildren(child, childX, childY);
  }

  // Position portals at (0, 0) — they paint in a separate pass at root level
  for (const portal of portalChildren) {
    positionChildren(portal, 0, 0);
  }
}

function crossOffset(childSize: number, containerSize: number, align: Align): number {
  if (align === "center") return Math.floor((containerSize - childSize) / 2);
  if (align === "end") return containerSize - childSize;
  return 0; // start, stretch (stretch already sized, position at start)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Recursively collect text content from a render node tree */
export function collectText(node: RenderNode): string {
  if (node.type === TEXT_NODE) {
    return node.text ?? "";
  }
  return node.children.map(collectText).join("");
}
