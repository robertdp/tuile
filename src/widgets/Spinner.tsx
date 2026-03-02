/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Spinner Widget — animated loading indicator
// ---------------------------------------------------------------------------

import { signal } from "../reactive/signal.js";
import { onCleanup } from "../element/reconciler.js";
import type { TuileElement, TextStyle, MaybeSignal } from "../element/types.js";
import { Box } from "../primitives/Box.js";
import { Text } from "../primitives/Text.js";
import { getScheduler } from "../animation/scheduler.js";

/** Built-in spinner frame sets */
export const spinnerFrames = {
  dots: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  line: ["-", "\\", "|", "/"],
  arc: ["◜", "◠", "◝", "◞", "◡", "◟"],
  circle: ["◐", "◓", "◑", "◒"],
  square: ["◰", "◳", "◲", "◱"],
  toggle: ["⊶", "⊷"],
  arrow: ["←", "↖", "↑", "↗", "→", "↘", "↓", "↙"],
  bouncingBar: ["[    ]", "[=   ]", "[==  ]", "[=== ]", "[ ===]", "[  ==]", "[   =]", "[    ]"],
} as const;

export type SpinnerType = keyof typeof spinnerFrames;

export interface SpinnerProps {
  /** Frame set name or custom frames array (default: "dots") */
  type?: SpinnerType | string[];
  /** Interval between frames in ms (default: 80) */
  interval?: number;
  /** Label to show after the spinner */
  label?: MaybeSignal<string>;
  /** Text style for the spinner character */
  style?: TextStyle;
}

/**
 * Animated spinner component.
 *
 * ```tsx
 * <Spinner type="dots" label="Loading..." />
 * ```
 */
export function Spinner(props: SpinnerProps): TuileElement {
  const {
    type = "dots",
    interval = 80,
    label,
    style = {},
  } = props;

  const frames = Array.isArray(type) ? type : spinnerFrames[type] ?? spinnerFrames.dots;
  const frame = signal(frames[0]);
  let idx = 0;
  let lastAdvance = 0;

  const unregister = getScheduler().onFrame((timestamp) => {
    if (lastAdvance === 0) {
      lastAdvance = timestamp;
      return;
    }
    if (timestamp - lastAdvance >= interval) {
      idx = (idx + 1) % frames.length;
      frame.value = frames[idx];
      lastAdvance = timestamp;
    }
  });

  onCleanup(unregister);

  return (
    <Box direction="horizontal">
      <Text {...style}>{frame}</Text>
      {label !== undefined && <Text>{" "}{label}</Text>}
    </Box>
  );
}
