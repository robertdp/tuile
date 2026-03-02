import type { ReadSignal, WriteSignal } from "../reactive/signal.js";
import type { Ref } from "./reconciler.js";
import type { KeyEvent } from "../input/keyboard.js";
import type { MouseEvent } from "../input/mouse.js";
import type { LayoutNode } from "../layout/types.js";
import type { CellStyle } from "../renderer/buffer.js";

export type { KeyEvent } from "../input/keyboard.js";
export type { MouseEvent } from "../input/mouse.js";

// ---------------------------------------------------------------------------
// Element descriptor types
// ---------------------------------------------------------------------------

/** A value that may be static or reactive */
export type MaybeSignal<T> = T | ReadSignal<T> | WriteSignal<T>;

/** Unwrap a MaybeSignal to its underlying type */
export type Unwrap<T> = T extends ReadSignal<infer U> ? U : T;

/** Supported color values */
export type Color =
  | string // named or hex
  | number // 256-color index
  | { r: number; g: number; b: number }; // truecolor

/** Style properties for Text elements */
export interface TextStyle {
  color?: MaybeSignal<Color | undefined>;
  bgColor?: MaybeSignal<Color | undefined>;
  bold?: MaybeSignal<boolean>;
  dim?: MaybeSignal<boolean>;
  italic?: MaybeSignal<boolean>;
  underline?: MaybeSignal<boolean>;
  strikethrough?: MaybeSignal<boolean>;
  inverse?: MaybeSignal<boolean>;
}

/** Border style ("light" is an alias for "single", "heavy" is an alias for "bold") */
export type BorderStyle = "single" | "light" | "double" | "round" | "bold" | "heavy" | "none";

/** Layout direction */
export type Direction = "vertical" | "horizontal";

/** Alignment along the cross axis */
export type Align = "start" | "center" | "end" | "stretch";

/** Justification along the main axis */
export type Justify = "start" | "center" | "end" | "space-between" | "space-around" | "space-evenly";

/** Size value: fixed number, percentage string, or auto */
export type SizeValue = number | `${number}%` | "auto";

/** Options for focus group behavior on a Box */
export interface FocusGroupOptions {
  /** Arrow key direction for navigation (default: "vertical" = up/down) */
  navigationKeys?: "vertical" | "horizontal" | string[];
  /** Auto-activate when group receives Tab focus (default: true) */
  autoActivate?: boolean;
  /** Key to exit the group (default: "escape"). false = trap. */
  exitKey?: string | false;
  /** Tab cycles within group children instead of exiting (default: false) */
  tabCycles?: boolean;
  /** Wrap at boundaries (default: true) */
  wrap?: boolean;
}

/** Layout properties for Box elements */
export interface BoxProps {
  direction?: MaybeSignal<Direction>;
  width?: MaybeSignal<SizeValue>;
  height?: MaybeSignal<SizeValue>;
  minWidth?: MaybeSignal<number>;
  maxWidth?: MaybeSignal<number>;
  minHeight?: MaybeSignal<number>;
  maxHeight?: MaybeSignal<number>;
  padding?: MaybeSignal<number>;
  paddingX?: MaybeSignal<number>;
  paddingY?: MaybeSignal<number>;
  paddingTop?: MaybeSignal<number>;
  paddingRight?: MaybeSignal<number>;
  paddingBottom?: MaybeSignal<number>;
  paddingLeft?: MaybeSignal<number>;
  border?: MaybeSignal<BorderStyle>;
  borderColor?: MaybeSignal<Color>;
  gap?: MaybeSignal<number>;
  align?: MaybeSignal<Align>;
  alignSelf?: MaybeSignal<Align>;
  justify?: MaybeSignal<Justify>;
  // Event handlers
  onKeyPress?: (event: KeyEvent) => boolean;
  onClick?: (event: MouseEvent) => boolean;
  onMouseMove?: (event: MouseEvent) => boolean;
  onScroll?: (event: ScrollEvent) => boolean;
  onFocus?: () => void;
  onBlur?: () => void;
  onLayout?: (layout: { width: number; height: number; contentWidth?: number; contentHeight?: number }) => void;
  onPaint?: (ctx: PaintContext) => void;
  tabIndex?: number;
  autoFocus?: boolean;
  bgColor?: MaybeSignal<Color>;
  zIndex?: MaybeSignal<number>;
  overflow?: MaybeSignal<"visible" | "hidden" | "scroll">;
  scrollOffsetX?: MaybeSignal<number>;
  scrollOffsetY?: MaybeSignal<number>;
  focusTrap?: boolean;
  focusGroup?: boolean | FocusGroupOptions;
  ref?: Ref;
  flex?: MaybeSignal<number>;
  flexGrow?: MaybeSignal<number>;
  flexShrink?: MaybeSignal<number>;
  flexBasis?: MaybeSignal<number>;
  children?: TuileChild | TuileChild[];
}

/** Text element properties */
export interface TextProps extends TextStyle {
  wrap?: MaybeSignal<"word" | "truncate" | "none">;
  ref?: Ref;
  children?: TuileChild | TuileChild[];
}

export interface ScrollEvent {
  direction: "up" | "down";
  x: number;
  y: number;
}

/** Context passed to onPaint callbacks for custom drawing into the render buffer. */
export interface PaintContext {
  /** Layout node for this box — walk .children for subtree positions. */
  node: LayoutNode;
  /** Write text at buffer coordinates, respecting the current clip region. */
  write: (x: number, y: number, text: string, style?: CellStyle) => void;
  /** Offset to convert layout coords to buffer coords: bufferX = layout.x + offsetX */
  offsetX: number;
  /** Offset to convert layout coords to buffer coords: bufferY = layout.y + offsetY */
  offsetY: number;
}

// ---------------------------------------------------------------------------
// Element types
// ---------------------------------------------------------------------------

/** Component function */
export type ComponentFn<P = any> = (props: P) => TuileElement;

/** A child of a Text element (can be a string, number, signal, or nested element) */
export type TuileChild =
  | string
  | number
  | boolean
  | null
  | undefined
  | ReadSignal<any>
  | WriteSignal<any>
  | TuileElement;

/** Element descriptor — the output of h() */
export interface TuileElement {
  type: ComponentFn | symbol;
  props: Record<string, any>;
  children: TuileChild[];
}
