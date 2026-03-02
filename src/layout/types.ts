import type { RenderNode } from "../element/reconciler.js";

// ---------------------------------------------------------------------------
// Layout Types
// ---------------------------------------------------------------------------

/** Resolved edges (padding, margin) */
export interface Edges {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Size constraints passed from parent to child */
export interface Constraints {
  maxWidth: number;
  maxHeight: number;
}

/** Computed layout result for a node */
export interface Layout {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A layout node — pairs a render node with its computed layout */
export interface LayoutNode {
  renderNode: RenderNode;
  layout: Layout;
  /** Constraints assigned during pass 1 (top-down) */
  constraints: Constraints;
  children: LayoutNode[];
  parent: LayoutNode | null;
  /** Generation counter — used to detect stale cached nodes */
  generation: number;
}
