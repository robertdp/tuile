/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Showcase — shared state and components
// ---------------------------------------------------------------------------

import { signal, computed, Box, Text } from "../src/index.js";
import type { KeyEvent } from "../src/index.js";
import { theme } from "./theme.js";

// ---------------------------------------------------------------------------
// Terminal size (reactive)
// ---------------------------------------------------------------------------

export const cols = signal(process.stdout.columns ?? 80);
export const rows = signal(process.stdout.rows ?? 24);

process.stdout.on("resize", () => {
  cols.value = process.stdout.columns ?? 80;
  rows.value = process.stdout.rows ?? 24;
});

// ---------------------------------------------------------------------------
// Page-level key handler — set by interactive pages, cleared on unmount
// ---------------------------------------------------------------------------

export const pageKeyHandler = signal<((e: KeyEvent) => void) | null>(null);

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

export function Section(props: { title: string; color?: string }) {
  return (
    <Box direction="horizontal" gap={1} paddingLeft={2}>
      <Text color={props.color ?? theme.primary} bold>
        ▎
      </Text>
      <Text color={theme.text} bold>
        {props.title}
      </Text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Sparkline helper
// ---------------------------------------------------------------------------

const SPARK = "▁▂▃▄▅▆▇█";

export function sparkline(values: number[]): string {
  return values
    .map((v) => SPARK[Math.round(Math.max(0, Math.min(1, v)) * 7)])
    .join("");
}
