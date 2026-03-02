// ---------------------------------------------------------------------------
// Unicode-aware text width utilities
//
// Terminal display width differs from string length: CJK ideographs and
// most emoji occupy 2 columns, combining marks occupy 0. The Unicode
// East_Asian_Width property defines "Ambiguous" characters (e.g. °, →)
// whose width depends on locale — 1 column on Western terminals, 2 on
// CJK-locale terminals. Call detectAmbiguousWidth() before render() to
// probe the terminal's actual behavior.
// ---------------------------------------------------------------------------

import stringWidthLib from "string-width";
import { eastAsianWidth } from "get-east-asian-width";

// Intl.Segmenter is available in Node 16+ and all modern runtimes.
const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Pre-computed options passed to eastAsianWidth() and stringWidthLib().
// Both libraries read only the property they care about and ignore the other.
// Mutated in place by setAmbiguousWidth() to avoid per-call allocation.
const ambiguousOptions = { ambiguousAsWide: false, ambiguousIsNarrow: true };

/** Configure the display width used for Unicode ambiguous-width characters. */
export function setAmbiguousWidth(width: 1 | 2): void {
  ambiguousOptions.ambiguousAsWide = width === 2;
  ambiguousOptions.ambiguousIsNarrow = width === 1;
}

/** Get the current ambiguous-width setting. */
export function getAmbiguousWidth(): 1 | 2 {
  return ambiguousOptions.ambiguousAsWide ? 2 : 1;
}

/**
 * Probe the terminal to detect how it renders East_Asian_Width=Ambiguous
 * characters, and set the ambiguous width accordingly.
 *
 * Writes a probe character at row 1 col 1, queries cursor position via
 * DSR/CPR, then erases the probe and restores the cursor. The probe
 * character (`°`) is visually inconspicuous and the round-trip completes
 * in single-digit milliseconds on local terminals.
 *
 * Must be called **before** `render()` — once render owns stdin, the CPR
 * response would be consumed by the keyboard parser.
 *
 * Returns the detected width (1 or 2). On non-TTY or timeout, returns the
 * current setting unchanged.
 */
export async function detectAmbiguousWidth(options?: {
  stdout?: NodeJS.WriteStream;
  stdin?: NodeJS.ReadStream;
  /** Timeout in ms (default: 1000). Falls back to current setting. */
  timeout?: number;
}): Promise<1 | 2> {
  const stdout = options?.stdout ?? (process.stdout as NodeJS.WriteStream);
  const stdin = options?.stdin ?? (process.stdin as NodeJS.ReadStream);
  const timeout = options?.timeout ?? 1000;

  if (!stdout.isTTY || !stdin.isTTY) {
    return getAmbiguousWidth();
  }

  // Probe character: ° (U+00B0 DEGREE SIGN) — East_Asian_Width=Ambiguous.
  // Chosen for being visually inconspicuous if briefly visible. Renders as
  // 1 column on Western terminals, 2 on CJK-locale terminals.
  const PROBE = "\u00b0";

  const wasRaw = stdin.isRaw;
  if (!wasRaw) stdin.setRawMode(true);
  const wasFlowing = stdin.readableFlowing;
  stdin.resume();
  stdin.setEncoding("utf8");

  try {
    return await new Promise<1 | 2>((resolve) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        finish(getAmbiguousWidth());
      }, timeout);

      function finish(width: 1 | 2) {
        clearTimeout(timer);
        stdin.off("data", onData);
        // Erase probe: move to 1;1, overwrite with space, restore cursor
        stdout.write("\x1b[1;1H \x1b8");
        setAmbiguousWidth(width);
        resolve(width);
      }

      function onData(data: string) {
        // CPR response format: ESC [ row ; col R
        const match = data.match(/\x1b\[(\d+);(\d+)R/);
        if (!match || settled) return;
        settled = true;
        const col = parseInt(match[2], 10);
        // Wrote probe at col 1. Cursor advances to col 2 (width 1) or col 3 (width 2).
        finish(col >= 3 ? 2 : 1);
      }

      stdin.on("data", onData);

      // Save cursor → move to row 1 col 1 → write probe → query cursor position (DSR)
      stdout.write("\x1b7\x1b[1;1H" + PROBE + "\x1b[6n");
    });
  } finally {
    if (!wasRaw) stdin.setRawMode(false);
    if (wasFlowing === false) stdin.pause();
  }
}

/**
 * Split a string into grapheme clusters.
 *
 * Handles ZWJ sequences (👨‍👩‍👧), flags (🇯🇵), skin tones (👋🏽),
 * combining marks, and other multi-codepoint clusters correctly.
 */
export function graphemes(str: string): string[] {
  const result: string[] = [];
  for (const { segment } of segmenter.segment(str)) {
    result.push(segment);
  }
  return result;
}

/** Zero-width codepoint check — not covered by get-east-asian-width. */
export function isZeroWidth(cp: number): boolean {
  return (
    cp === 0x200b || // ZERO WIDTH SPACE
    cp === 0x200c || // ZERO WIDTH NON-JOINER
    cp === 0x200d || // ZERO WIDTH JOINER
    cp === 0xfeff || // ZERO WIDTH NO-BREAK SPACE / BOM
    (cp >= 0xfe00 && cp <= 0xfe0f) || // Variation Selectors
    (cp >= 0xe0100 && cp <= 0xe01ef) || // Variation Selectors Supplement
    (cp >= 0x0300 && cp <= 0x036f) || // Combining Diacritical Marks
    (cp >= 0x1ab0 && cp <= 0x1aff) || // Combining Diacritical Marks Extended
    (cp >= 0x1dc0 && cp <= 0x1dff) || // Combining Diacritical Marks Supplement
    (cp >= 0x20d0 && cp <= 0x20ff) || // Combining Diacritical Marks for Symbols
    (cp >= 0xfe20 && cp <= 0xfe2f) || // Combining Half Marks
    (cp >= 0xe0000 && cp <= 0xe007f) || // Tags (used in flag sequences)
    (cp >= 0x302a && cp <= 0x302d) || // Ideographic tone marks
    cp === 0x3099 || cp === 0x309a || // Combining Katakana voiced/semi-voiced
    cp === 0x16fe4 // Khitan Small Script filler
  );
}

/**
 * Return the display width of a grapheme cluster.
 *
 * Single-codepoint graphemes: zero-width check + eastAsianWidth.
 * Multi-codepoint clusters (ZWJ emoji, flags, skin tones) delegate to
 * string-width which uses emoji-regex for accurate emoji detection.
 */
export function graphemeWidth(grapheme: string): number {
  if (grapheme.length === 0) return 0;
  if (grapheme.length === 1) {
    const cp = grapheme.charCodeAt(0);
    return isZeroWidth(cp) ? 0 : eastAsianWidth(cp, ambiguousOptions);
  }
  return stringWidthLib(grapheme, ambiguousOptions);
}

/**
 * Calculate the display width of a string in terminal columns.
 */
export function stringWidth(str: string): number {
  if (str.length === 0) return 0;
  return stringWidthLib(str, ambiguousOptions);
}

/**
 * Wrap text to fit within a maximum display width.
 * Supports word wrap, truncation, and no-wrap modes.
 */
export function wrapText(
  text: string,
  maxWidth: number,
  wrap: "word" | "truncate" | "none" = "word",
): string[] {
  if (maxWidth <= 0) return [];
  const lines = text.split("\n");
  if (wrap === "none") return lines;
  if (wrap === "truncate") return lines.map((l) => sliceByWidth(l, maxWidth));

  // Word wrap
  const result: string[] = [];
  for (const line of lines) {
    if (stringWidth(line) <= maxWidth) {
      result.push(line);
      continue;
    }

    const segments = splitWrappable(line);
    let current = "";
    let currentWidth = 0;

    for (const seg of segments) {
      const segWidth = stringWidth(seg.text);
      const sepWidth = seg.spaceBefore ? 1 : 0;

      if (currentWidth === 0) {
        current = seg.text;
        currentWidth = segWidth;
      } else if (currentWidth + sepWidth + segWidth <= maxWidth) {
        if (seg.spaceBefore) {
          current += " " + seg.text;
          currentWidth += 1 + segWidth;
        } else {
          current += seg.text;
          currentWidth += segWidth;
        }
      } else {
        result.push(current);
        current = seg.text;
        currentWidth = segWidth;
      }

      while (currentWidth > maxWidth) {
        const sliced = sliceByWidth(current, maxWidth);
        result.push(sliced);
        current = current.slice(sliced.length);
        currentWidth = stringWidth(current);
      }
    }

    if (currentWidth > 0) {
      result.push(current);
    }
  }
  return result;
}

/**
 * Split a line into wrappable segments.
 * Latin/ASCII runs between spaces are single segments.
 * Each wide character (CJK/emoji) is its own wrappable segment,
 * consistent with Unicode UAX #14 line-breaking rules.
 */
interface WrapSegment {
  text: string;
  spaceBefore: boolean;
}

function splitWrappable(line: string): WrapSegment[] {
  const segments: WrapSegment[] = [];
  let current = "";
  let pendingSpace = false;

  for (const { segment: grapheme } of segmenter.segment(line)) {
    if (grapheme === " ") {
      if (current.length > 0) {
        segments.push({ text: current, spaceBefore: pendingSpace });
        current = "";
      }
      pendingSpace = true;
      continue;
    }

    const w = graphemeWidth(grapheme);
    if (w === 2) {
      // Wide character: flush current narrow run, emit as its own segment
      if (current.length > 0) {
        segments.push({ text: current, spaceBefore: pendingSpace });
        current = "";
        pendingSpace = false;
      }
      segments.push({ text: grapheme, spaceBefore: pendingSpace });
      pendingSpace = false;
    } else {
      current += grapheme;
    }
  }

  if (current.length > 0) {
    segments.push({ text: current, spaceBefore: pendingSpace });
  }

  return segments;
}

/**
 * Slice a string to fit within a maximum display width.
 * Returns the prefix that fits, measured by display columns.
 */
export function sliceByWidth(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";

  let width = 0;
  let result = "";

  for (const { segment } of segmenter.segment(str)) {
    const w = graphemeWidth(segment);
    if (width + w > maxWidth) break;
    result += segment;
    width += w;
  }

  return result;
}
