/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// ProgressBar Widget
// ---------------------------------------------------------------------------

import { computed } from "../reactive/signal.js";
import type { TuileElement, MaybeSignal, Color } from "../element/types.js";
import { isSignal, readValue } from "../reactive/utils.js";
import { Box } from "../primitives/Box.js";
import { Text } from "../primitives/Text.js";

export interface ProgressBarProps {
  /** Progress value from 0 to 1 */
  value: MaybeSignal<number>;
  /** Width of the bar in characters (default: 20) */
  width?: MaybeSignal<number>;
  /** Character for filled portion (default: "█") */
  filled?: string;
  /** Character for empty portion (default: "░") */
  empty?: string;
  /** Color of the filled portion */
  filledColor?: Color;
  /** Color of the empty portion */
  emptyColor?: Color;
  /** Show percentage label (default: true) */
  showLabel?: boolean;
}

/**
 * Progress bar component.
 *
 * ```tsx
 * const progress = signal(0.5);
 * <ProgressBar value={progress} width={30} />
 * ```
 */
export function ProgressBar(props: ProgressBarProps): TuileElement {
  const {
    value,
    width: rawWidth = 20,
    filled = "█",
    empty = "░",
    filledColor,
    emptyColor,
    showLabel = true,
  } = props;

  const w = () => Math.max(0, readValue(rawWidth));
  const v = () => Math.max(0, Math.min(1, readValue(value)));

  const needsComputed = isSignal(value) || isSignal(rawWidth);

  const labelText = needsComputed
    ? computed(() => ` ${Math.round(v() * 100)}%`)
    : ` ${Math.round(v() * 100)}%`;

  const children: TuileElement[] = [];

  if (filledColor || emptyColor) {
    const filledText = needsComputed
      ? computed(() => filled.repeat(Math.round(v() * w())))
      : filled.repeat(Math.round(v() * w()));

    const emptyText = needsComputed
      ? computed(() => empty.repeat(w() - Math.round(v() * w())))
      : empty.repeat(w() - Math.round(v() * w()));

    children.push(<Text color={filledColor}>{filledText}</Text>);
    children.push(<Text color={emptyColor}>{emptyText}</Text>);
  } else {
    const barText = needsComputed
      ? computed(() => {
          const fc = Math.round(v() * w());
          return filled.repeat(fc) + empty.repeat(w() - fc);
        })
      : (() => {
          const fc = Math.round(v() * w());
          return filled.repeat(fc) + empty.repeat(w() - fc);
        })();
    children.push(<Text>{barText}</Text>);
  }

  if (showLabel) {
    children.push(<Text>{labelText}</Text>);
  }

  return <Box direction="horizontal">{children}</Box>;
}
