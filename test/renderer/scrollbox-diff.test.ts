import { describe, it, expect } from "vitest";
import { CellBuffer, cellsEqual } from "../../src/renderer/buffer.js";
import { diff } from "../../src/renderer/differ.js";
import { graphemeWidth } from "../../src/text/width.js";

describe("scrollbox diff", () => {
  it("☰ is now width 2", () => {
    expect(graphemeWidth("☰")).toBe(2);
  });

  it("☰  ScrollBox in 13-wide buffer", () => {
    const w = 13;
    const prev = new CellBuffer(w, 1);
    const next = new CellBuffer(w, 1);
    prev.write(0, 0, "☰  ScrollBox");

    console.log("prev chars:", JSON.stringify(prev.cells[0].map(c => c.char)));
    console.log("next chars:", JSON.stringify(next.cells[0].map(c => c.char)));

    const patch = diff(prev, next);
    console.log("diff output (escaped):", JSON.stringify(patch));

    for (let x = 0; x < w; x++) {
      const eq = cellsEqual(prev.cells[0][x], next.cells[0][x]);
      console.log("cell " + x + ": prev=" + JSON.stringify(prev.cells[0][x].char) + " next=" + JSON.stringify(next.cells[0][x].char) + " " + (eq ? "SAME" : "CHANGED"));
    }
  });
});
