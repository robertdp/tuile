/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Checkbox Widget
// ---------------------------------------------------------------------------

import { signal, computed } from "../reactive/signal.js";
import type { WriteSignal } from "../reactive/signal.js";
import type { TuileElement, MaybeSignal } from "../element/types.js";
import type { KeyEvent } from "../input/keyboard.js";
import { Handled, Propagate } from "../input/events.js";
import { Box } from "../primitives/Box.js";
import { Text } from "../primitives/Text.js";

export interface CheckboxProps {
  /** Label text */
  label: MaybeSignal<string>;
  /** Controlled checked state (signal for two-way binding) */
  checked?: WriteSignal<boolean>;
  /** Initial checked state for uncontrolled mode (default: false) */
  defaultChecked?: boolean;
  /** Called when checked state changes */
  onChange?: (checked: boolean) => void;
  /** Character for checked state (default: "✓") */
  checkedChar?: string;
  /** Character for unchecked state (default: " ") */
  uncheckedChar?: string;
  /** Tab index for focus (default: 0) */
  tabIndex?: number;
}

/**
 * Checkbox component with keyboard toggle (space/enter).
 *
 * ```tsx
 * const checked = signal(false);
 * <Checkbox label="Accept terms" checked={checked} />
 * ```
 */
export function Checkbox(props: CheckboxProps): TuileElement {
  const {
    label,
    checked: controlledChecked,
    defaultChecked = false,
    onChange,
    checkedChar = "✓",
    uncheckedChar = " ",
    tabIndex = 0,
  } = props;

  // Use controlled signal if provided, otherwise create internal state
  const checkedState = controlledChecked ?? signal(defaultChecked);

  const indicator = computed(() => {
    return checkedState.value ? `[${checkedChar}]` : `[${uncheckedChar}]`;
  });

  function toggle(): void {
    const next = !checkedState.peek();
    checkedState.value = next;
    if (onChange) onChange(next);
  }

  function handleKey(event: KeyEvent): boolean {
    if (event.key === " " || event.key === "enter") {
      toggle();
      return Handled;
    }
    return Propagate;
  }

  return (
    <Box direction="horizontal" tabIndex={tabIndex} onKeyPress={handleKey}>
      <Text>{indicator}</Text>
      <Text>{" "}</Text>
      <Text>{label}</Text>
    </Box>
  );
}
