/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// TextInput Widget — single-line editable text field
// ---------------------------------------------------------------------------

import { signal, computed } from "../reactive/signal.js";
import type { WriteSignal } from "../reactive/signal.js";
import type { TuileElement, Color, SizeValue } from "../element/types.js";
import type { KeyEvent } from "../input/keyboard.js";
import { Handled, Propagate } from "../input/events.js";
import { Box } from "../primitives/Box.js";
import { Text } from "../primitives/Text.js";
import { graphemes, stringWidth, sliceByWidth } from "../text/width.js";

export interface TextInputProps {
  /** Controlled value (signal for two-way binding) */
  value?: WriteSignal<string>;
  /** Initial value for uncontrolled mode (default: "") */
  defaultValue?: string;
  /** Placeholder text shown when empty */
  placeholder?: string;
  /** Called on each value change */
  onChange?: (value: string) => void;
  /** Called on enter key */
  onSubmit?: (value: string) => void;
  /** Width — character count or layout size like "100%" (default: 20) */
  width?: SizeValue;
  /** Cursor character (default: "▎") */
  cursor?: string;
  /** Placeholder text color */
  placeholderColor?: Color;
  /** Tab index for focus (default: 0) */
  tabIndex?: number;
}

/**
 * Single-line text input component.
 *
 * ```tsx
 * const name = signal("");
 * <TextInput value={name} placeholder="Enter name..." onSubmit={(v) => console.log(v)} />
 * ```
 */
export function TextInput(props: TextInputProps): TuileElement {
  const {
    value: controlledValue,
    defaultValue = "",
    placeholder = "",
    onChange,
    onSubmit,
    width = 20,
    cursor = "▎",
    placeholderColor = "gray",
    tabIndex = 0,
  } = props;

  const text = controlledValue ?? signal(defaultValue);
  // cursorPos is a grapheme index (not a UTF-16 code unit index)
  const cursorPos = signal(graphemes(text.peek()).length);
  const focused = signal(false);

  // When width is a number, use it for text padding. Otherwise don't pad.
  const charWidth = typeof width === "number" ? width : null;

  // Scroll offset in display columns — persists across re-renders
  let scrollCol = 0;

  /** Convert grapheme index to string index */
  function graphemeToStringIndex(str: string, graphemeIdx: number): number {
    const segs = graphemes(str);
    let strIdx = 0;
    for (let i = 0; i < graphemeIdx && i < segs.length; i++) {
      strIdx += segs[i].length;
    }
    return strIdx;
  }

  /** Slice a string starting at a display-column offset for a given max width */
  function sliceWindow(str: string, startCol: number, maxWidth: number): string {
    let col = 0;
    let result = "";
    let resultWidth = 0;
    for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(str)) {
      const w = stringWidth(segment);
      if (col + w <= startCol) {
        col += w;
        continue;
      }
      if (resultWidth + w > maxWidth) break;
      result += segment;
      resultWidth += w;
    }
    return result;
  }

  // Visible text with cursor
  const displayText = computed(() => {
    const t = text.value;
    const pos = cursorPos.value;
    const isFocused = focused.value;

    if (t.length === 0 && !isFocused) {
      scrollCol = 0;
      return placeholder;
    }

    if (!isFocused) {
      scrollCol = 0;
      if (charWidth === null) return t;
      return stringWidth(t) > charWidth ? sliceByWidth(t, charWidth) : t.padEnd(charWidth, " ");
    }

    // Insert cursor at grapheme boundary
    const strIdx = graphemeToStringIndex(t, pos);
    const before = t.slice(0, strIdx);
    const after = t.slice(strIdx);
    const display = before + cursor + after;

    if (charWidth === null) return display;

    // Cursor's display column in the full display string (text before + cursor)
    const cursorCol = stringWidth(before);
    const cursorW = stringWidth(cursor);

    // Adjust scroll offset to keep cursor visible
    if (cursorCol < scrollCol) {
      scrollCol = cursorCol;
    } else if (cursorCol + cursorW > scrollCol + charWidth) {
      scrollCol = cursorCol + cursorW - charWidth;
    }

    const visible = sliceWindow(display, scrollCol, charWidth);
    const visibleWidth = stringWidth(visible);
    return visibleWidth < charWidth ? visible + " ".repeat(charWidth - visibleWidth) : visible;
  });

  const isPlaceholder = computed(() => {
    return text.value.length === 0 && !focused.value;
  });

  function handleKey(event: KeyEvent): boolean {
    const t = text.peek();
    const segs = graphemes(t);
    const pos = cursorPos.peek();

    if (event.key === "enter") {
      if (onSubmit) onSubmit(t);
      return Handled;
    }

    if (event.key === "backspace") {
      if (pos > 0) {
        const strIdx = graphemeToStringIndex(t, pos);
        const prevStrIdx = graphemeToStringIndex(t, pos - 1);
        text.value = t.slice(0, prevStrIdx) + t.slice(strIdx);
        cursorPos.value = pos - 1;
        if (onChange) onChange(text.peek());
      }
      return Handled;
    }

    if (event.key === "delete") {
      if (pos < segs.length) {
        const strIdx = graphemeToStringIndex(t, pos);
        const nextStrIdx = graphemeToStringIndex(t, pos + 1);
        text.value = t.slice(0, strIdx) + t.slice(nextStrIdx);
        if (onChange) onChange(text.peek());
      }
      return Handled;
    }

    if (event.key === "left") {
      cursorPos.value = Math.max(0, pos - 1);
      return Handled;
    }

    if (event.key === "right") {
      cursorPos.value = Math.min(segs.length, pos + 1);
      return Handled;
    }

    if (event.key === "home" || (event.ctrl && event.key === "a")) {
      cursorPos.value = 0;
      return Handled;
    }

    if (event.key === "end" || (event.ctrl && event.key === "e")) {
      cursorPos.value = segs.length;
      return Handled;
    }

    // Bracketed paste — insert text at cursor (strip newlines for single-line input)
    if (event.key === "paste") {
      const pasted = event.raw.replace(/[\r\n]/g, " ");
      const pastedSegs = graphemes(pasted);
      if (pastedSegs.length > 0) {
        const strIdx = graphemeToStringIndex(t, pos);
        text.value = t.slice(0, strIdx) + pasted + t.slice(strIdx);
        cursorPos.value = pos + pastedSegs.length;
        if (onChange) onChange(text.peek());
      }
      return Handled;
    }

    // Printable character (single grapheme, not a named key)
    if (event.key.length >= 1 && !event.ctrl && !event.alt && graphemes(event.key).length === 1) {
      const strIdx = graphemeToStringIndex(t, pos);
      text.value = t.slice(0, strIdx) + event.key + t.slice(strIdx);
      cursorPos.value = pos + 1;
      if (onChange) onChange(text.peek());
      return Handled;
    }

    return Propagate;
  }

  const textColor = computed(() => isPlaceholder.value ? placeholderColor : undefined);

  return (
    <Box
      width={width}
      tabIndex={tabIndex}
      onKeyPress={handleKey}
      onFocus={() => { focused.value = true; }}
      onBlur={() => { focused.value = false; }}
    >
      <Text color={textColor}>{displayText}</Text>
    </Box>
  );
}
