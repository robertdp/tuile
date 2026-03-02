/** @jsxImportSource tuile */
import type { TuileElement, BoxProps } from "../element/types.js";
import type { ReadSignal } from "../reactive/signal.js";
import { signal } from "../reactive/signal.js";
import { Box } from "./Box.js";

/** Inner dimensions exposed as reactive signals. */
export interface MeasureSize {
  width: ReadSignal<number>;
  height: ReadSignal<number>;
}

export interface MeasureProps extends Pick<BoxProps,
  | "direction" | "gap" | "align" | "justify"
  | "width" | "height" | "flex" | "flexGrow" | "flexShrink"
> {
  children: (size: MeasureSize) => TuileElement | TuileElement[];
}

/** Transparent wrapper that exposes its available space as reactive signals. */
export function Measure(props: MeasureProps): TuileElement {
  const { children: renderFn, ...boxProps } = props;
  const width = signal(0);
  const height = signal(0);

  const content = renderFn({ width, height });
  const childArray = Array.isArray(content) ? content : [content];

  return (
    <Box
      {...boxProps}
      onLayout={({ width: w, height: h }: { width: number; height: number }) => {
        width.value = w;
        height.value = h;
      }}
    >
      {childArray}
    </Box>
  );
}
