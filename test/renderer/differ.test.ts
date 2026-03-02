import { describe, it, expect } from "vitest";
import { CellBuffer } from "../../src/renderer/buffer.js";
import { diff, renderFull } from "../../src/renderer/differ.js";
import { TEXT_NODE, TEXT } from "../../src/element/reconciler.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";

describe("differ", () => {
  it("produces empty output for identical buffers", () => {
    const a = new CellBuffer(5, 2);
    const b = new CellBuffer(5, 2);
    a.write(0, 0, "hello");
    b.write(0, 0, "hello");
    const output = diff(a, b);
    expect(output).toBe("");
  });

  it("detects changed lines", () => {
    const a = new CellBuffer(5, 2);
    const b = new CellBuffer(5, 2);
    a.write(0, 0, "hello");
    a.write(0, 1, "world");
    b.write(0, 0, "hello");
    b.write(0, 1, "earth");
    const output = diff(a, b);
    // Should only rewrite line 1 (y=1), not line 0
    expect(output).toContain("earth");
    expect(output).not.toContain("hello");
  });

  it("handles full render", () => {
    const buf = new CellBuffer(3, 1);
    buf.write(0, 0, "hi ");
    const output = renderFull(buf);
    expect(output).toContain("hi ");
  });

  it("only emits changed cells for a single-cell change", () => {
    const a = new CellBuffer(20, 1);
    const b = new CellBuffer(20, 1);
    a.write(0, 0, "abcdefghijklmnopqrst");
    b.write(0, 0, "abcdefghijklmnopqrst");
    // Change one cell in the middle
    b.write(10, 0, "X");
    const output = diff(a, b);
    // Output should contain cursor positioning to column 10 and the char X
    expect(output).toContain("X");
    // Should NOT contain full line content like "abcdefghij" or "lmnopqrst"
    expect(output).not.toContain("abcdefghij");
  });

  it("coalesces nearby runs", () => {
    const a = new CellBuffer(20, 1);
    const b = new CellBuffer(20, 1);
    a.write(0, 0, "abcdefghijklmnopqrst");
    b.write(0, 0, "abcdefghijklmnopqrst");
    // Change cells 5 and 7 (gap of 1 — should coalesce)
    b.write(5, 0, "X");
    b.write(7, 0, "Y");
    const output = diff(a, b);
    // Both changes should be in the output
    expect(output).toContain("X");
    expect(output).toContain("Y");
  });

  it("falls back to full line when most cells change", () => {
    const a = new CellBuffer(10, 1);
    const b = new CellBuffer(10, 1);
    a.write(0, 0, "0123456789");
    b.write(0, 0, "ABCDEFGHIJ");
    const output = diff(a, b);
    // Should contain the full new content
    expect(output).toContain("ABCDEFGHIJ");
  });
});

describe("stale row clearing", () => {
  it("clears stale rows when buffer shrinks", () => {
    const prev = new CellBuffer(10, 5);
    const next = new CellBuffer(10, 3);
    prev.write(0, 0, "line 0");
    prev.write(0, 3, "stale");
    prev.write(0, 4, "stale");
    next.write(0, 0, "line 0");
    const output = diff(prev, next);
    // Should contain erase commands for rows 3 and 4
    expect(output).toContain("\x1b[K"); // eraseToEndOfLine
  });

  it("does not emit clear when buffer size is unchanged", () => {
    const prev = new CellBuffer(10, 3);
    const next = new CellBuffer(10, 3);
    prev.write(0, 0, "same");
    next.write(0, 0, "same");
    const output = diff(prev, next);
    expect(output).not.toContain("\x1b[K");
  });

  it("does not emit clear when next is taller", () => {
    const prev = new CellBuffer(10, 2);
    const next = new CellBuffer(10, 4);
    next.write(0, 0, "a");
    const output = diff(prev, next);
    expect(output).not.toContain("\x1b[K");
  });
});

describe("style transitions", () => {
  it("uses individual off code for italic removal within a run", () => {
    const prev = new CellBuffer(2, 1);
    const next = new CellBuffer(2, 1);
    // prev is blank; next has cell 0 italic, cell 1 not italic
    // Both cells change, so they're in the same renderCells run
    next.write(0, 0, "a", { italic: true });
    next.write(1, 0, "b");
    const output = diff(prev, next);
    // renderCells processes: cell 0 (italic on) → cell 1 (italic off)
    // Should contain italic off (ESC[23m) for the transition
    expect(output).toContain("\x1b[23m");
  });

  it("handles bold removal while dim stays active within a run", () => {
    const prev = new CellBuffer(2, 1);
    const next = new CellBuffer(2, 1);
    // Both cells change: cell 0 has bold+dim, cell 1 has dim only
    next.write(0, 0, "a", { bold: true, dim: true });
    next.write(1, 0, "b", { dim: true }); // bold removed, dim stays
    const output = diff(prev, next);
    // Processing cell 1: cur has bold+dim, cell has dim only
    // Should emit SGR 22 (bold/dim off) then SGR 2 (dim re-enable)
    expect(output).toContain("\x1b[22m");
    expect(output).toContain("\x1b[2m");
  });
});

// ---------------------------------------------------------------------------
// Property-based: diff(prev, next) applied to prev produces next
// ---------------------------------------------------------------------------

/**
 * Minimal ANSI interpreter that applies diff output to a character grid.
 * Handles cursor positioning (CSI H), erase to EOL (CSI K), and character
 * writes. SGR style codes are skipped — this verifies character placement only.
 */
function applyDiffToCharGrid(grid: string[][], width: number, height: number, ansiStr: string): void {
  let cx = 0, cy = 0;
  let i = 0;

  while (i < ansiStr.length) {
    if (ansiStr[i] === "\x1b") {
      if (ansiStr[i + 1] === "[") {
        i += 2;
        let params = "";
        while (i < ansiStr.length && ((ansiStr[i] >= "0" && ansiStr[i] <= "9") || ansiStr[i] === ";")) {
          params += ansiStr[i++];
        }
        const cmd = ansiStr[i++];
        if (cmd === "H") {
          const parts = params.split(";");
          cy = parseInt(parts[0] || "1") - 1;
          cx = parseInt(parts[1] || "1") - 1;
        } else if (cmd === "K") {
          // Erase to end of line
          for (let x = cx; x < width; x++) {
            if (cy >= 0 && cy < height) grid[cy][x] = " ";
          }
        }
        // 'm' and other codes: skip (style only, no cursor effect)
      } else {
        i += 2; // skip non-CSI escape (e.g. ESC 7, ESC 8)
      }
    } else {
      if (cy >= 0 && cy < height && cx >= 0 && cx < width) {
        grid[cy][cx] = ansiStr[i];
      }
      cx++;
      i++;
    }
  }
}

function charGridFromBuffer(buf: CellBuffer): string[][] {
  return buf.cells.map(row => row.map(cell => cell.char || " "));
}

/** Simple deterministic PRNG (mulberry32) for reproducible tests */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("property: diff roundtrip", () => {
  const ITERATIONS = 200;
  const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789 !@#$%";

  function randomBuffer(rng: () => number, w: number, h: number): CellBuffer {
    const buf = new CellBuffer(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        buf.cells[y][x].char = CHARS[Math.floor(rng() * CHARS.length)];
      }
    }
    return buf;
  }

  it("diff(prev, next) applied to prev produces next (random ASCII buffers)", () => {
    for (let seed = 0; seed < ITERATIONS; seed++) {
      const rng = mulberry32(seed);
      const w = 3 + Math.floor(rng() * 13);  // 3–15
      const h = 1 + Math.floor(rng() * 5);   // 1–5

      const prev = randomBuffer(rng, w, h);
      const next = randomBuffer(rng, w, h);

      const patch = diff(prev, next);

      // Start with prev's char grid, apply the diff
      const applied = charGridFromBuffer(prev);
      applyDiffToCharGrid(applied, w, h, patch);

      const expected = charGridFromBuffer(next);

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (applied[y][x] !== expected[y][x]) {
            throw new Error(
              `seed=${seed} (${w}x${h}) mismatch at (${x},${y}): ` +
              `got "${applied[y][x]}", expected "${expected[y][x]}"`,
            );
          }
        }
      }
    }
  });

  it("diff(prev, next) applied to prev produces next (with height changes)", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed + 10000);
      const w = 5 + Math.floor(rng() * 10);
      const prevH = 1 + Math.floor(rng() * 6);
      const nextH = 1 + Math.floor(rng() * 6);

      const prev = randomBuffer(rng, w, prevH);
      const next = randomBuffer(rng, w, nextH);

      const patch = diff(prev, next);

      // For height shrink: simulate on a grid sized to max(prevH, nextH)
      const maxH = Math.max(prevH, nextH);
      const applied: string[][] = [];
      for (let y = 0; y < maxH; y++) {
        if (y < prevH) {
          applied.push(prev.cells[y].map(c => c.char || " "));
        } else {
          applied.push(Array(w).fill(" "));
        }
      }

      applyDiffToCharGrid(applied, w, maxH, patch);

      // Rows 0..nextH-1 should match next
      for (let y = 0; y < nextH; y++) {
        for (let x = 0; x < w; x++) {
          const expected = next.cells[y][x].char || " ";
          if (applied[y][x] !== expected) {
            throw new Error(
              `seed=${seed} (${w}x${prevH}→${nextH}) mismatch at (${x},${y}): ` +
              `got "${applied[y][x]}", expected "${expected}"`,
            );
          }
        }
      }

      // Rows nextH..prevH-1 should be cleared (spaces) if prev was taller
      for (let y = nextH; y < prevH; y++) {
        for (let x = 0; x < w; x++) {
          if (applied[y][x] !== " ") {
            throw new Error(
              `seed=${seed} (${w}x${prevH}→${nextH}) stale row ${y} col ${x} not cleared: ` +
              `got "${applied[y][x]}"`,
            );
          }
        }
      }
    }
  });

  it("diff(buf, buf) is always empty", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = mulberry32(seed + 20000);
      const w = 3 + Math.floor(rng() * 13);
      const h = 1 + Math.floor(rng() * 5);
      const buf = randomBuffer(rng, w, h);

      // Clone
      const clone = new CellBuffer(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          clone.cells[y][x].char = buf.cells[y][x].char;
        }
      }

      expect(diff(buf, clone)).toBe("");
    }
  });
});

describe("integration: mount → layout → buffer → diff", () => {
  it("renders a simple element pipeline", async () => {
    const { h } = await import("../../src/element/h.js");
    const { mount } = await import("../../src/element/reconciler.js");
    const { computeLayout } = await import("../../src/layout/engine.js");

    // Build element
    const el = h(Box, {},
      h(Text, {}, "Hello, Tuile!"),
    );

    // Mount
    const renderTree = mount(el);

    // Layout
    const layoutTree = computeLayout(renderTree, 20, 5);

    // Paint to buffer
    const buffer = new CellBuffer(20, 5);
    // Use the same paint logic as screen.ts
    paintNode(layoutTree, buffer);

    expect(buffer.getLine(0)).toContain("Hello, Tuile!");
  });
});

// Mini paint function for testing (mirrors screen.ts logic)
function paintNode(node: any, buffer: CellBuffer): void {
  const { renderNode, layout } = node;

  if (renderNode.type === TEXT_NODE) {
    const text = renderNode.text ?? "";
    if (text) buffer.write(layout.x, layout.y, text);
    return;
  }

  if (renderNode.type === TEXT) {
    let text = "";
    for (const child of renderNode.children) {
      if (child.type === TEXT_NODE) text += child.text ?? "";
    }
    if (text) buffer.write(layout.x, layout.y, text);
    return;
  }

  for (const child of node.children) {
    paintNode(child, buffer);
  }
}
