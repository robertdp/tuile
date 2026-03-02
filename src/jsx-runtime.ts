// ---------------------------------------------------------------------------
// JSX automatic runtime entry point
// tsconfig: "jsxImportSource": "tuile"
// resolves to: tuile/jsx-runtime
// ---------------------------------------------------------------------------

export { jsx, jsxs, jsxDEV, Fragment } from "./element/h.js";

import type { TuileElement } from "./element/types.js";

export namespace JSX {
  export type Element = TuileElement;
  export interface ElementChildrenAttribute {
    children: {};
  }
}
