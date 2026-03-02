import type { Edges } from "./types.js";
import type { SizeValue, BorderStyle } from "../element/types.js";
import { stringWidth, wrapText } from "../text/width.js";

// ---------------------------------------------------------------------------
// Constraint helpers
// ---------------------------------------------------------------------------

/** Resolve padding from props, handling shorthand and individual values */
export function resolveEdges(props: Record<string, any>, prefix: string): Edges {
  const all = (props[prefix] as number | undefined) ?? 0;
  const x = (props[`${prefix}X`] as number | undefined) ?? all;
  const y = (props[`${prefix}Y`] as number | undefined) ?? all;
  return {
    top: (props[`${prefix}Top`] as number | undefined) ?? y,
    right: (props[`${prefix}Right`] as number | undefined) ?? x,
    bottom: (props[`${prefix}Bottom`] as number | undefined) ?? y,
    left: (props[`${prefix}Left`] as number | undefined) ?? x,
  };
}

/** Resolve a size value to a pixel count given a parent dimension */
export function resolveSize(
  value: SizeValue | undefined,
  parentDimension: number,
): number | "auto" {
  if (value === undefined || value === "auto") return "auto";
  if (typeof value === "number") return value;
  // Percentage string like "50%"
  if (typeof value === "string" && value.endsWith("%")) {
    const pct = parseFloat(value);
    if (Number.isNaN(pct)) return "auto";
    return Math.floor((pct / 100) * parentDimension);
  }
  return "auto";
}

/** Get the extra width/height consumed by a border */
export function borderSize(border: BorderStyle | undefined): Edges {
  if (!border || border === "none") {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  // All border styles use 1 character per side
  return { top: 1, right: 1, bottom: 1, left: 1 };
}

/** Border character sets */
export interface BorderCharSet {
  topLeft: string; topRight: string; bottomLeft: string; bottomRight: string;
  horizontal: string; vertical: string;
}

const _single: BorderCharSet = { topLeft: "┌", topRight: "┐", bottomLeft: "└", bottomRight: "┘", horizontal: "─", vertical: "│" };
const _double: BorderCharSet = { topLeft: "╔", topRight: "╗", bottomLeft: "╚", bottomRight: "╝", horizontal: "═", vertical: "║" };
const _round: BorderCharSet = { topLeft: "╭", topRight: "╮", bottomLeft: "╰", bottomRight: "╯", horizontal: "─", vertical: "│" };
const _bold: BorderCharSet = { topLeft: "┏", topRight: "┓", bottomLeft: "┗", bottomRight: "┛", horizontal: "━", vertical: "┃" };

export const BORDER_CHARS: Record<string, BorderCharSet> = {
  single: _single, light: _single,
  double: _double,
  round: _round,
  bold: _bold, heavy: _bold,
};

/** Grid junction character sets (for internal grid lines) */
export interface GridJunctionCharSet {
  teeDown: string;   // ┬ — top edge junction
  teeUp: string;     // ┴ — bottom edge junction
  teeRight: string;  // ├ — left edge junction
  teeLeft: string;   // ┤ — right edge junction
  cross: string;     // ┼ — internal cross
}

const _jSingle: GridJunctionCharSet = { teeDown: "┬", teeUp: "┴", teeRight: "├", teeLeft: "┤", cross: "┼" };
const _jDouble: GridJunctionCharSet = { teeDown: "╦", teeUp: "╩", teeRight: "╠", teeLeft: "╣", cross: "╬" };
const _jBold: GridJunctionCharSet = { teeDown: "┳", teeUp: "┻", teeRight: "┣", teeLeft: "┫", cross: "╋" };

export const GRID_JUNCTION_CHARS: Record<string, GridJunctionCharSet> = {
  single: _jSingle, light: _jSingle,
  double: _jDouble,
  round: _jSingle,
  bold: _jBold, heavy: _jBold,
};

/** Measure the display width of a string (Unicode-aware) */
export function measureText(text: string, maxWidth: number, wrap: string = "word"): { width: number; height: number } {
  if (!text || text.length === 0) {
    return { width: 0, height: 0 };
  }

  const wrappedLines = wrapText(text, maxWidth, wrap as "word" | "truncate" | "none");
  const width = wrappedLines.length > 0 ? Math.max(...wrappedLines.map((l) => stringWidth(l))) : 0;
  return { width, height: wrappedLines.length };
}
