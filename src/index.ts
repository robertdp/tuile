// Reactive primitives
export { signal, computed, effect, batch, _getSubscriberCount } from "./reactive/signal.js";
export type { ReadSignal, WriteSignal, ComputedSignal } from "./reactive/signal.js";
export { isSignal, readValue, peekValue } from "./reactive/utils.js";

// Element system
export { h, jsx, jsxs, jsxDEV, Fragment } from "./element/h.js";
export { mount, unmount, onMount, onCleanup, markDirty, createRef, getNodeInstance } from "./element/reconciler.js";
export type { RenderNode, Ref } from "./element/reconciler.js";
export { createRenderInstance, setActiveInstance, getActiveInstance } from "./instance.js";
export type { RenderInstance } from "./instance.js";
export type {
  TuileElement,
  TuileChild,
  BoxProps,
  TextProps,
  TextStyle,
  FocusGroupOptions,
  Color,
  Direction,
  Align,
  Justify,
  SizeValue,
  BorderStyle,
  MaybeSignal,
  PaintContext,
} from "./element/types.js";

// Primitives
export { Box } from "./primitives/Box.js";
export { Text } from "./primitives/Text.js";
export { Measure } from "./primitives/Measure.js";
export type { MeasureProps, MeasureSize } from "./primitives/Measure.js";

// Control flow
export { Show, For, Switch, Match, ErrorBoundary } from "./reactive/control-flow.js";
export type { ErrorBoundaryProps } from "./reactive/control-flow.js";

// Context
export { createContext, useContext } from "./reactive/context.js";
export type { Context } from "./reactive/context.js";

// Portal
export { Portal } from "./element/portal.js";
export type { PortalProps } from "./element/portal.js";

// Text utilities
export { graphemes, graphemeWidth, stringWidth, sliceByWidth, wrapText, setAmbiguousWidth, getAmbiguousWidth, detectAmbiguousWidth } from "./text/width.js";

// Layout
export { computeLayout } from "./layout/engine.js";
export type { LayoutNode, Constraints, Layout } from "./layout/types.js";

// Renderer
export { render } from "./renderer/screen.js";
export type { RenderHandle, ScreenOptions } from "./renderer/screen.js";
export { CellBuffer } from "./renderer/buffer.js";
export type { Cell, CellStyle } from "./renderer/buffer.js";

// Input
export { parseInput, createParseState } from "./input/keyboard.js";
export type { KeyEvent, KeyHandler, ParseState } from "./input/keyboard.js";
export { parseSgrMouse } from "./input/mouse.js";
export type { MouseEvent, MouseHandler } from "./input/mouse.js";
export { Handled, Propagate, onGlobalKey, dispatchKeyEvent, dispatchMouseEvent, hitTest, getInstanceKeyHandlers } from "./input/events.js";
export type { TuileKeyHandler, TuileMouseHandler, TuileScrollHandler } from "./input/events.js";

// Focus
export { createFocusManager } from "./focus/manager.js";
export type { FocusManager } from "./focus/manager.js";

// Scroll
export { createScrollState, scrollIndicator, ScrollBox } from "./scroll/container.js";
export type { ScrollState, ScrollBoxProps } from "./scroll/container.js";

// Animation
export { animate, spring } from "./animation/tween.js";
export type { TweenOptions, TweenControl, SpringOptions, SpringControl } from "./animation/tween.js";
export { createScheduler, getScheduler, setScheduler } from "./animation/scheduler.js";
export type { AnimationScheduler } from "./animation/scheduler.js";
export { resolveEasing, cubicBezier } from "./animation/easing.js";
export type { EasingFn, EasingName } from "./animation/easing.js";

// Widgets
export { TextInput } from "./widgets/TextInput.js";
export type { TextInputProps } from "./widgets/TextInput.js";
export { Select } from "./widgets/Select.js";
export type { SelectProps, SelectOption } from "./widgets/Select.js";
export { Checkbox } from "./widgets/Checkbox.js";
export type { CheckboxProps } from "./widgets/Checkbox.js";
export { ProgressBar } from "./widgets/ProgressBar.js";
export type { ProgressBarProps } from "./widgets/ProgressBar.js";
export { Spinner, spinnerFrames } from "./widgets/Spinner.js";
export type { SpinnerProps, SpinnerType } from "./widgets/Spinner.js";
export { Table } from "./widgets/Table.js";
export type { TableProps, TableColumn } from "./widgets/Table.js";
export { Grid, GridItem } from "./widgets/Grid.js";
export type { GridProps, GridItemProps, GridTrackSize } from "./widgets/Grid.js";
