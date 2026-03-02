import type { Color } from "../element/types.js";
import { graphemeWidth } from "../text/width.js";

// ---------------------------------------------------------------------------
// Cell Buffer — 2D grid of styled characters
// ---------------------------------------------------------------------------

/** Module-level Intl.Segmenter singleton for grapheme-aware text iteration */
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** A single character cell with styling */
export interface Cell {
  char: string;
  fg: Color | null;
  bg: Color | null;
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
}

/** Create a default empty cell */
export function emptyCell(): Cell {
  return {
    char: " ",
    fg: null,
    bg: null,
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    strikethrough: false,
    inverse: false,
  };
}

/** Clone a cell */
export function cloneCell(cell: Cell): Cell {
  return { ...cell };
}

/** Check if two cells are visually identical */
export function cellsEqual(a: Cell, b: Cell): boolean {
  return (
    a.char === b.char &&
    colorEqual(a.fg, b.fg) &&
    colorEqual(a.bg, b.bg) &&
    a.bold === b.bold &&
    a.dim === b.dim &&
    a.italic === b.italic &&
    a.underline === b.underline &&
    a.strikethrough === b.strikethrough &&
    a.inverse === b.inverse
  );
}

function colorEqual(a: Color | null, b: Color | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a === "object" && typeof b === "object" && "r" in a && "r" in b) {
    return a.r === b.r && a.g === b.g && a.b === b.b;
  }
  return a === b;
}

/** Style to apply when writing to the buffer */
export interface CellStyle {
  fg?: Color | null;
  bg?: Color | null;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  inverse?: boolean;
}

/**
 * A 2D buffer of terminal cells.
 */
export class CellBuffer {
  width: number;
  height: number;
  cells: Cell[][];

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.cells = [];
    for (let y = 0; y < height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < width; x++) {
        row.push(emptyCell());
      }
      this.cells.push(row);
    }
  }

  /** Get a cell at (x, y). Returns null if out of bounds. */
  get(x: number, y: number): Cell | null {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.cells[y][x];
  }

  /** Set a cell at (x, y). No-op if out of bounds. */
  set(x: number, y: number, cell: Cell): void {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
    this.cells[y][x] = cell;
  }

  /** Write a string at (x, y) with the given style. Handles wide characters (CJK, emoji). */
  write(x: number, y: number, text: string, style: CellStyle = {}): void {
    if (y < 0 || y >= this.height) return;

    let cx = x;
    const row = this.cells[y];

    for (const { segment } of segmenter.segment(text)) {
      const w = graphemeWidth(segment);
      if (w === 0) continue; // skip zero-width characters

      if (cx >= this.width) break;
      if (cx < 0) { cx += w; continue; }

      // Wide character doesn't fit at the right edge — write a space instead
      if (cx + w > this.width) {
        row[cx].char = " ";
        break;
      }

      // Clean up orphaned wide-character halves before writing
      // If we're overwriting a continuation cell, clear the primary at cx-1
      if (row[cx].char === "" && cx > 0) {
        row[cx - 1].char = " ";
      }
      // If we're overwriting the primary of a wide char, clear the continuation at cx+1
      if (graphemeWidth(row[cx].char) === 2 && cx + 1 < this.width) {
        row[cx + 1].char = " ";
      }
      // If writing a wide char, check if cx+1 is the primary of another wide char
      if (w === 2 && cx + 1 < this.width && graphemeWidth(row[cx + 1].char) === 2 && cx + 2 < this.width) {
        row[cx + 2].char = " ";
      }

      const cell = row[cx];
      cell.char = segment;
      if (style.fg !== undefined) cell.fg = style.fg;
      if (style.bg !== undefined) cell.bg = style.bg;
      if (style.bold !== undefined) cell.bold = style.bold;
      if (style.dim !== undefined) cell.dim = style.dim;
      if (style.italic !== undefined) cell.italic = style.italic;
      if (style.underline !== undefined) cell.underline = style.underline;
      if (style.strikethrough !== undefined) cell.strikethrough = style.strikethrough;
      if (style.inverse !== undefined) cell.inverse = style.inverse;

      // Wide character: mark next cell as continuation
      if (w === 2 && cx + 1 < this.width) {
        const next = row[cx + 1];
        next.char = "";
        if (style.fg !== undefined) next.fg = style.fg;
        if (style.bg !== undefined) next.bg = style.bg;
        if (style.bold !== undefined) next.bold = style.bold;
        if (style.dim !== undefined) next.dim = style.dim;
        if (style.italic !== undefined) next.italic = style.italic;
        if (style.underline !== undefined) next.underline = style.underline;
        if (style.strikethrough !== undefined) next.strikethrough = style.strikethrough;
        if (style.inverse !== undefined) next.inverse = style.inverse;
      }

      cx += w;
    }
  }

  /** Clear the entire buffer to empty cells (in-place reset, no allocations) */
  clear(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y][x];
        cell.char = " ";
        cell.fg = null;
        cell.bg = null;
        cell.bold = false;
        cell.dim = false;
        cell.italic = false;
        cell.underline = false;
        cell.strikethrough = false;
        cell.inverse = false;
      }
    }
  }

  /** Resize the buffer, preserving content where possible */
  resize(width: number, height: number): void {
    const newCells: Cell[][] = [];
    for (let y = 0; y < height; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < width; x++) {
        if (y < this.height && x < this.width) {
          row.push(this.cells[y][x]);
        } else {
          row.push(emptyCell());
        }
      }
      newCells.push(row);
    }
    this.cells = newCells;
    this.width = width;
    this.height = height;
  }

  /** Get a line as a string (for debugging) */
  getLine(y: number): string {
    if (y < 0 || y >= this.height) return "";
    return this.cells[y].map((c) => c.char).join("");
  }
}
