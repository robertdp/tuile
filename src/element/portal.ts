import type { TuileElement, ComponentFn, TuileChild } from "./types.js";
import { PORTAL } from "./reconciler.js";

// ---------------------------------------------------------------------------
// Portal — renders children outside the parent's layout/clipping context
// ---------------------------------------------------------------------------

export interface PortalProps {
  zIndex?: number;
  children: TuileChild | TuileChild[];
}

/**
 * Render children in a second paint pass at root level, escaping the
 * parent's overflow clipping and z-order context. Useful for modals,
 * dropdowns, and tooltips.
 *
 * ```tsx
 * <Portal zIndex={10}>
 *   <Box border="single"><Text>Modal content</Text></Box>
 * </Portal>
 * ```
 */
export const Portal: ComponentFn<PortalProps> = (props) => {
  const children = Array.isArray(props.children) ? props.children : [props.children];
  return {
    type: PORTAL,
    props: { zIndex: props.zIndex ?? 0 },
    children: children.filter((c) => c != null),
  };
};
