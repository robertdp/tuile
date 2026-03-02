/** @jsxImportSource tuile */
import { signal, computed } from "../reactive/signal.js";
import type { WriteSignal } from "../reactive/signal.js";
import type { TuileElement, SizeValue, MaybeSignal, Direction, KeyEvent, ScrollEvent } from "../element/types.js";
import { Handled } from "../input/events.js";
import { Box } from "../primitives/Box.js";

// ---------------------------------------------------------------------------
// Scroll State
// ---------------------------------------------------------------------------

export interface ScrollState {
  /** Current scroll offset (rows from top / columns from left) */
  offset: WriteSignal<number>;
  /** Total content size along the scroll axis */
  contentSize: number;
  /** Visible viewport size along the scroll axis */
  viewportSize: number;
  /** Scroll by a number of rows/columns (positive = down/right, negative = up/left) */
  scrollBy(delta: number): void;
  /** Scroll to a specific row/column */
  scrollTo(row: number): void;
  /** Scroll to ensure a row/column is visible */
  scrollToVisible(row: number): void;
  /** Update dimensions */
  setDimensions(contentSize: number, viewportSize: number): void;
  /** Maximum scroll offset */
  maxOffset(): number;
}

/**
 * Create a scroll state manager.
 */
export function createScrollState(): ScrollState {
  const offset = signal(0);
  let contentSize = 0;
  let viewportSize = 0;

  function maxOffset(): number {
    return Math.max(0, contentSize - viewportSize);
  }

  function clamp(value: number): number {
    return Math.max(0, Math.min(value, maxOffset()));
  }

  function scrollBy(delta: number): void {
    offset.value = clamp(offset.peek() + delta);
  }

  function scrollTo(row: number): void {
    offset.value = clamp(row);
  }

  function scrollToVisible(row: number): void {
    const current = offset.peek();
    if (row < current) {
      offset.value = row;
    } else if (row >= current + viewportSize) {
      offset.value = clamp(row - viewportSize + 1);
    }
  }

  function setDimensions(cs: number, vs: number): void {
    contentSize = cs;
    viewportSize = vs;
    // Clamp current offset if dimensions changed
    offset.value = clamp(offset.peek());
  }

  return {
    offset,
    get contentSize() { return contentSize; },
    get viewportSize() { return viewportSize; },
    scrollBy,
    scrollTo,
    scrollToVisible,
    setDimensions,
    maxOffset,
  };
}

/**
 * Compute a scroll indicator (scrollbar) position.
 * Returns { start, size } in rows, for rendering a visual scrollbar.
 */
export function scrollIndicator(
  contentSize: number,
  viewportSize: number,
  offset: number,
): { start: number; size: number } {
  if (contentSize <= viewportSize) {
    return { start: 0, size: viewportSize };
  }

  const ratio = viewportSize / contentSize;
  const size = Math.max(1, Math.round(viewportSize * ratio));
  const maxStart = viewportSize - size;
  const maxOffset = contentSize - viewportSize;
  const start = maxOffset > 0 ? Math.round((offset / maxOffset) * maxStart) : 0;

  return { start, size };
}

// ---------------------------------------------------------------------------
// ScrollBox Component
// ---------------------------------------------------------------------------

export interface ScrollBoxProps {
  height?: MaybeSignal<SizeValue>;
  width?: MaybeSignal<SizeValue>;
  direction?: Direction;
  gap?: number;
  scrollState?: ScrollState;
  tabIndex?: number;
  /**
   * Arrow key scroll behaviour:
   * - `true`: Always scroll on arrow keys
   * - `false`: Never scroll on arrow keys (only pgup/pgdn/home/end/mouse)
   * - `"auto"` (default): Scroll on arrow keys only when the ScrollBox itself
   *   is focused, not when a descendant has focus (allows focus navigation)
   */
  keyboardScroll?: boolean | "auto";
  onKeyPress?: (event: KeyEvent) => boolean;
  children?: any;
}

/**
 * A scrollable container that clips content to a fixed viewport.
 * Handles keyboard (up/down/pageup/pagedown/home/end) and mouse scroll events.
 */
export function ScrollBox(props: ScrollBoxProps): TuileElement {
  const scroll = props.scrollState ?? createScrollState();
  const dir = props.direction ?? "vertical";
  const isVertical = dir === "vertical";
  const keyboardScroll = props.keyboardScroll ?? "auto";

  const children = Array.isArray(props.children) ? props.children : props.children != null ? [props.children] : [];

  // Track whether the ScrollBox itself is focused (vs a descendant)
  const selfFocused = signal(false);

  function shouldScrollOnArrow(): boolean {
    if (keyboardScroll === true) return true;
    if (keyboardScroll === false) return false;
    return selfFocused.peek(); // "auto": only when self is focused
  }

  return (
    <Box
      height={props.height}
      width={props.width}
      overflow="scroll"
      scrollOffsetY={isVertical ? scroll.offset : undefined}
      scrollOffsetX={isVertical ? undefined : scroll.offset}
      direction={dir}
      gap={props.gap}
      tabIndex={props.tabIndex ?? 0}
      onFocus={() => { selfFocused.value = true; }}
      onBlur={() => { selfFocused.value = false; }}
      onLayout={({ width, height, contentWidth, contentHeight }: { width: number; height: number; contentWidth?: number; contentHeight?: number }) => {
        scroll.setDimensions(
          isVertical ? (contentHeight ?? 0) : (contentWidth ?? 0),
          isVertical ? height : width,
        );
      }}
      onKeyPress={(e: KeyEvent): boolean => {
        if (shouldScrollOnArrow()) {
          switch (e.key) {
            case "up": scroll.scrollBy(-1); return Handled;
            case "down": scroll.scrollBy(1); return Handled;
          }
        }
        switch (e.key) {
          case "pageup": scroll.scrollBy(-(scroll.viewportSize || 1)); return Handled;
          case "pagedown": scroll.scrollBy(scroll.viewportSize || 1); return Handled;
          case "home": scroll.scrollTo(0); return Handled;
          case "end": scroll.scrollTo(scroll.maxOffset()); return Handled;
        }
        return props.onKeyPress?.(e) ?? false;
      }}
      onScroll={(e: ScrollEvent): boolean => {
        scroll.scrollBy(e.direction === "down" ? 3 : -3);
        return Handled;
      }}
    >
      {children}
    </Box>
  );
}
