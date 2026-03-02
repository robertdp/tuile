import type { TuileElement, TuileChild, BoxProps } from "../element/types.js";
import { BOX } from "../element/reconciler.js";

export type { BoxProps } from "../element/types.js";

/** Flex container component. */
export function Box(props: BoxProps): TuileElement {
  const { children, ...rest } = props;
  const childArray: TuileChild[] = children == null
    ? []
    : Array.isArray(children) ? children : [children];
  return { type: BOX, props: rest, children: childArray };
}
