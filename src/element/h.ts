import type { TuileElement, TuileChild, ComponentFn } from "./types.js";
import { FRAGMENT } from "./reconciler.js";

// ---------------------------------------------------------------------------
// JSX Runtime — h() / createElement
// ---------------------------------------------------------------------------

/**
 * Create an element descriptor. This is the JSX runtime function.
 *
 * ```ts
 * h(Box, { padding: 1 }, h(Text, { bold: true }, "hello"))
 * // equivalent to: <Box padding={1}><Text bold>hello</Text></Box>
 * ```
 */
export function h(
  type: ComponentFn | symbol,
  props?: Record<string, any> | null,
  ...children: TuileChild[]
): TuileElement {
  const resolvedProps = props ?? {};

  // Flatten nested arrays in children
  const flatChildren = flattenChildren(children);

  return {
    type,
    props: resolvedProps,
    children: flatChildren,
  };
}

function flattenChildren(children: any[]): TuileChild[] {
  const result: TuileChild[] = [];
  for (const child of children) {
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else if (child !== null && child !== undefined && child !== false && child !== true) {
      result.push(child);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// JSX automatic runtime (jsxImportSource)
// ---------------------------------------------------------------------------

/** Used by the automatic JSX transform for production */
export function jsx(
  type: ComponentFn | symbol,
  props: Record<string, any>,
): TuileElement {
  const { children, ...rest } = props;
  const childArray = children == null
    ? []
    : Array.isArray(children)
      ? children
      : [children];
  return {
    type,
    props: rest,
    children: flattenChildren(childArray),
  };
}

/** Used by the automatic JSX transform for development */
export const jsxDEV = jsx;

/** Used by the automatic JSX transform for fragments */
export function Fragment(props: { children?: TuileChild | TuileChild[] }): TuileElement {
  const children = props.children == null
    ? []
    : Array.isArray(props.children)
      ? props.children
      : [props.children];
  return {
    type: FRAGMENT,
    props: {},
    children: flattenChildren(children),
  };
}

export const jsxs = jsx;
