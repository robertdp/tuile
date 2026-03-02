/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Select Widget — scrollable option list
// ---------------------------------------------------------------------------

import { signal, computed } from "../reactive/signal.js";
import type { WriteSignal } from "../reactive/signal.js";
import type { TuileElement, MaybeSignal, Color } from "../element/types.js";
import type { KeyEvent } from "../input/keyboard.js";
import { Handled, Propagate } from "../input/events.js";
import { readValue } from "../reactive/utils.js";
import { For } from "../reactive/control-flow.js";
import { Box } from "../primitives/Box.js";
import { Text } from "../primitives/Text.js";

export interface SelectOption<T = string> {
  label: string;
  value: T;
}

export interface SelectProps<T = string> {
  /** List of options (reactive or static) */
  options: MaybeSignal<SelectOption<T>[]>;
  /** Controlled selected value */
  value?: WriteSignal<T>;
  /** Called when selection changes */
  onChange?: (value: T) => void;
  /** Number of visible rows (default: all) */
  visibleRows?: number;
  /** Prefix for selected item (default: "❯ ") */
  selectedPrefix?: string;
  /** Prefix for unselected items (default: "  ") */
  unselectedPrefix?: string;
  /** Color for selected item */
  selectedColor?: Color;
  /** Color for unselected items */
  unselectedColor?: Color;
  /** Tab index for focus (default: 0) */
  tabIndex?: number;
}

/**
 * Selectable list component with keyboard navigation.
 *
 * ```tsx
 * <Select
 *   options={[
 *     { label: "Apple", value: "apple" },
 *     { label: "Banana", value: "banana" },
 *   ]}
 *   onChange={(v) => console.log(v)}
 * />
 * ```
 */
export function Select<T = string>(props: SelectProps<T>): TuileElement {
  const {
    options,
    value: controlledValue,
    onChange,
    visibleRows,
    selectedPrefix = "❯ ",
    unselectedPrefix = "  ",
    selectedColor,
    unselectedColor,
    tabIndex = 0,
  } = props;

  const highlightIndex = signal(0);
  const scrollOffset = signal(0);

  function handleKey(event: KeyEvent): boolean {
    const opts = readValue(options);
    const idx = highlightIndex.peek();
    const maxVisible = visibleRows ?? opts.length;

    if (event.key === "up" || event.key === "k") {
      const next = (idx - 1 + opts.length) % opts.length;
      highlightIndex.value = next;
      if (next < scrollOffset.peek()) {
        scrollOffset.value = next;
      }
      if (next >= scrollOffset.peek() + maxVisible) {
        scrollOffset.value = next - maxVisible + 1;
      }
      return Handled;
    }

    if (event.key === "down" || event.key === "j") {
      const next = (idx + 1) % opts.length;
      highlightIndex.value = next;
      if (next >= scrollOffset.peek() + maxVisible) {
        scrollOffset.value = next - maxVisible + 1;
      }
      if (next < scrollOffset.peek()) {
        scrollOffset.value = next;
      }
      return Handled;
    }

    if (event.key === "enter" || event.key === " ") {
      const selected = opts[idx];
      if (controlledValue) {
        controlledValue.value = selected.value;
      }
      if (onChange) onChange(selected.value);
      return Handled;
    }

    return Propagate;
  }

  // Build visible option rows — each as a separate Text for per-row styling
  const visibleRows_ = computed(() => {
    const opts = readValue(options);
    const idx = highlightIndex.value;
    const offset = scrollOffset.value;
    const maxVisible = visibleRows ?? opts.length;
    const end = Math.min(offset + maxVisible, opts.length);
    const rows: { text: string; selected: boolean }[] = [];
    for (let i = offset; i < end; i++) {
      const isSelected = i === idx;
      const prefix = isSelected ? selectedPrefix : unselectedPrefix;
      rows.push({ text: prefix + opts[i].label, selected: isSelected });
    }
    return rows;
  });

  return (
    <Box direction="vertical" tabIndex={tabIndex} onKeyPress={handleKey}>
      <For each={visibleRows_}>
        {(row) => (
          <Text color={row.selected ? selectedColor : unselectedColor}>{row.text}</Text>
        )}
      </For>
    </Box>
  );
}
