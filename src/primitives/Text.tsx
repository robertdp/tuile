import type { TuileElement, TuileChild, TextProps } from "../element/types.js";
import { TEXT } from "../element/reconciler.js";

export type { TextProps } from "../element/types.js";

/** Text display component. */
export function Text(props: TextProps): TuileElement {
  const { children, ...rest } = props;
  const childArray: TuileChild[] = children == null
    ? []
    : Array.isArray(children) ? children : [children];
  return { type: TEXT, props: rest, children: childArray };
}
