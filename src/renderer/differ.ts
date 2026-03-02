import type { Cell } from "./buffer.js";
import { CellBuffer, cellsEqual } from "./buffer.js";
import * as ansi from "./ansi.js";
import { graphemeWidth } from "../text/width.js";

// ---------------------------------------------------------------------------
// Hybrid Run-based Differ
//
// Compares two CellBuffers and emits minimal ANSI to transform the terminal.
// Strategy per row:
//   1. Skip identical rows entirely (fast path).
//   2. Find contiguous runs of changed cells.
//   3. Coalesce nearby runs (gap < 3 cells) to avoid cursor-movement overhead.
//   4. If >60% of the row changed, fall back to a single full-line write
//      (cheaper than many cursor jumps).
//   5. Otherwise, emit each run individually with cursor positioning.
//
// Wide characters (CJK, emoji) occupy two cells: a primary cell with the
// grapheme and a continuation cell (char === ""). When a changed run starts
// on a continuation cell, we back up to include the primary so the full
// character is re-emitted and the cursor advances correctly.
// ---------------------------------------------------------------------------

/** Coalesce threshold: merge runs separated by fewer than this many unchanged cells */
const COALESCE_GAP = 3;

/** If more than this fraction of cells changed, render the full line instead */
const FULL_LINE_THRESHOLD = 0.6;

/**
 * Compare two buffers and produce an ANSI escape string that transforms
 * the terminal from showing `prev` to showing `next`.
 *
 * Uses a hybrid run-based approach: within each row, contiguous runs of
 * changed cells are identified and rendered individually. Nearby runs
 * are coalesced to avoid cursor-jump overhead. If most of a line changed,
 * falls back to full-line rendering.
 */
export function diff(prev: CellBuffer, next: CellBuffer): string {
  const output: string[] = [];
  const height = next.height;
  const width = next.width;

  for (let y = 0; y < height; y++) {
    const nextRow = next.cells[y];
    const prevRow = y < prev.height ? prev.cells[y] : null;

    // Quick check: is the line identical?
    if (prevRow && prevRow.length === nextRow.length) {
      let identical = true;
      for (let x = 0; x < nextRow.length; x++) {
        if (!cellsEqual(prevRow[x], nextRow[x])) {
          identical = false;
          break;
        }
      }
      if (identical) continue;
    }

    // Find runs of changed cells
    const runs = findChangedRuns(prevRow, nextRow, width);
    if (runs.length === 0) continue;

    // Count changed cells to decide strategy
    let changedCount = 0;
    for (const [start, end] of runs) {
      changedCount += end - start;
    }

    if (changedCount / width > FULL_LINE_THRESHOLD) {
      // Full-line fallback
      output.push(ansi.cursorTo(0, y));
      output.push(renderCells(nextRow, 0, width));
    } else {
      // Render individual runs
      for (let [start, end] of runs) {
        // If the run starts at a wide-char continuation cell, back up to
        // include the primary cell so the full character is re-emitted and
        // the cursor advances correctly.
        if (start > 0 && nextRow[start].char === "" && graphemeWidth(nextRow[start - 1].char) === 2) {
          start--;
        }
        output.push(ansi.cursorTo(start, y));
        output.push(renderCells(nextRow, start, end));
      }
    }
  }

  // Clear stale rows from the previous buffer
  if (prev.height > next.height) {
    for (let y = next.height; y < prev.height; y++) {
      output.push(ansi.cursorTo(0, y));
      output.push(ansi.eraseToEndOfLine());
    }
  }

  return output.join("");
}

/**
 * Render a full buffer to ANSI (for initial render, no prev buffer).
 */
export function renderFull(buffer: CellBuffer): string {
  const output: string[] = [];

  for (let y = 0; y < buffer.height; y++) {
    output.push(ansi.cursorTo(0, y));
    output.push(renderCells(buffer.cells[y], 0, buffer.cells[y].length));
  }

  return output.join("");
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Find contiguous runs of changed cells in a row.
 * Returns an array of [start, end) pairs.
 * Coalesces runs separated by fewer than COALESCE_GAP unchanged cells.
 */
function findChangedRuns(
  prevRow: Cell[] | null,
  nextRow: Cell[],
  width: number,
): [number, number][] {
  const runs: [number, number][] = [];
  let runStart = -1;

  for (let x = 0; x < width; x++) {
    const changed = !prevRow || x >= prevRow.length || !cellsEqual(prevRow[x], nextRow[x]);

    if (changed) {
      if (runStart === -1) {
        runStart = x;
      }
    } else if (runStart !== -1) {
      runs.push([runStart, x]);
      runStart = -1;
    }
  }

  // Close final run
  if (runStart !== -1) {
    runs.push([runStart, width]);
  }

  // Coalesce nearby runs
  if (runs.length <= 1) return runs;

  const coalesced: [number, number][] = [runs[0]];
  for (let i = 1; i < runs.length; i++) {
    const prev = coalesced[coalesced.length - 1];
    const curr = runs[i];
    if (curr[0] - prev[1] < COALESCE_GAP) {
      // Merge: extend previous run to cover the gap
      prev[1] = curr[1];
    } else {
      coalesced.push(curr);
    }
  }

  return coalesced;
}

/** Tracked style state for incremental style emission */
interface StyleState {
  fg: string; // serialized fg color string or ""
  bg: string; // serialized bg color string or ""
  bold: boolean;
  dim: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  inverse: boolean;
}

function emptyStyle(): StyleState {
  return { fg: "", bg: "", bold: false, dim: false, italic: false, underline: false, strikethrough: false, inverse: false };
}

function colorKey(color: import("../element/types.js").Color | null): string {
  if (color === null) return "";
  if (typeof color === "number") return `n${color}`;
  if (typeof color === "object" && "r" in color) return `r${color.r},${color.g},${color.b}`;
  return `s${color}`;
}

/**
 * Render a range of cells [start, end) to an ANSI string.
 *
 * Tracks cumulative SGR state to emit only the attributes that differ
 * from the previous cell. Bold and dim share SGR 22 as their off code,
 * so turning off either requires resetting both and re-applying the
 * surviving attribute.
 *
 * Wide-character continuation cells (char === "") are skipped when they
 * follow a valid primary cell. Orphaned continuations (left behind when
 * a wide character is partially overwritten) are emitted as spaces to
 * prevent cursor misalignment.
 */
function renderCells(cells: Cell[], start: number, end: number): string {
  const parts: string[] = [];
  const cur = emptyStyle();

  for (let x = start; x < end; x++) {
    const cell = cells[x];
    if (cell.char === "") {
      // Valid wide-char continuation — primary already advanced cursor by 2
      if (x > 0 && graphemeWidth(cells[x - 1].char) === 2) {
        continue;
      }
      // Orphaned continuation — emit as space below
    }
    const char = cell.char || " ";

    const nextFg = colorKey(cell.fg);
    const nextBg = colorKey(cell.bg);

    // Bold and dim share SGR 22 as their off code — handle together
    if ((cur.bold && !cell.bold) || (cur.dim && !cell.dim)) {
      parts.push(ansi.bold(false)); // SGR 22 turns off both bold and dim
      cur.bold = false;
      cur.dim = false;
      if (cell.bold) { parts.push(ansi.bold(true)); cur.bold = true; }
      if (cell.dim) { parts.push(ansi.dim(true)); cur.dim = true; }
    }

    // Other attributes have individual off codes
    if (cur.italic && !cell.italic) { parts.push(ansi.italic(false)); cur.italic = false; }
    if (cur.underline && !cell.underline) { parts.push(ansi.underline(false)); cur.underline = false; }
    if (cur.strikethrough && !cell.strikethrough) { parts.push(ansi.strikethrough(false)); cur.strikethrough = false; }
    if (cur.inverse && !cell.inverse) { parts.push(ansi.inverse(false)); cur.inverse = false; }

    // Emit only the attributes that differ from current state
    if (nextFg !== cur.fg) {
      if (nextFg === "") {
        parts.push(ansi.resetFg());
      } else if (cell.fg !== null) {
        parts.push(ansi.fgColor(cell.fg));
      }
      cur.fg = nextFg;
    }
    if (nextBg !== cur.bg) {
      if (nextBg === "") {
        parts.push(ansi.resetBg());
      } else if (cell.bg !== null) {
        parts.push(ansi.bgColor(cell.bg));
      }
      cur.bg = nextBg;
    }
    if (cell.bold && !cur.bold) { parts.push(ansi.bold(true)); cur.bold = true; }
    if (cell.dim && !cur.dim) { parts.push(ansi.dim(true)); cur.dim = true; }
    if (cell.italic && !cur.italic) { parts.push(ansi.italic(true)); cur.italic = true; }
    if (cell.underline && !cur.underline) { parts.push(ansi.underline(true)); cur.underline = true; }
    if (cell.strikethrough && !cur.strikethrough) { parts.push(ansi.strikethrough(true)); cur.strikethrough = true; }
    if (cell.inverse && !cur.inverse) { parts.push(ansi.inverse(true)); cur.inverse = true; }

    parts.push(char);
  }

  // Reset at end of run
  parts.push(ansi.resetStyle());
  return parts.join("");
}
