import { describe, it, expect } from "vitest";
import { CellBuffer, cellsEqual, emptyCell } from "../../src/renderer/buffer.js";

describe("CellBuffer", () => {
  it("creates a buffer with the given dimensions", () => {
    const buf = new CellBuffer(10, 5);
    expect(buf.width).toBe(10);
    expect(buf.height).toBe(5);
  });

  it("initializes with empty cells", () => {
    const buf = new CellBuffer(3, 2);
    expect(buf.getLine(0)).toBe("   ");
    expect(buf.getLine(1)).toBe("   ");
  });

  it("writes text at position", () => {
    const buf = new CellBuffer(10, 3);
    buf.write(2, 1, "hello");
    expect(buf.getLine(1)).toBe("  hello   ");
  });

  it("writes with style", () => {
    const buf = new CellBuffer(10, 1);
    buf.write(0, 0, "hi", { bold: true, fg: "red" });
    const cell = buf.get(0, 0)!;
    expect(cell.char).toBe("h");
    expect(cell.bold).toBe(true);
    expect(cell.fg).toBe("red");
  });

  it("clips text at buffer boundary", () => {
    const buf = new CellBuffer(5, 1);
    buf.write(3, 0, "hello");
    expect(buf.getLine(0)).toBe("   he");
  });

  it("ignores out-of-bounds writes", () => {
    const buf = new CellBuffer(5, 5);
    buf.write(0, -1, "no");
    buf.write(0, 10, "no");
    expect(buf.getLine(0)).toBe("     ");
  });

  it("clears the buffer", () => {
    const buf = new CellBuffer(5, 1);
    buf.write(0, 0, "hello");
    buf.clear();
    expect(buf.getLine(0)).toBe("     ");
  });

  it("resizes preserving content", () => {
    const buf = new CellBuffer(5, 2);
    buf.write(0, 0, "abc");
    buf.resize(10, 3);
    expect(buf.width).toBe(10);
    expect(buf.height).toBe(3);
    expect(buf.getLine(0).startsWith("abc")).toBe(true);
    expect(buf.getLine(2)).toBe("          ");
  });

  it("resizes smaller truncates content", () => {
    const buf = new CellBuffer(10, 5);
    buf.write(0, 0, "1234567890");
    buf.resize(5, 2);
    expect(buf.width).toBe(5);
    expect(buf.height).toBe(2);
    expect(buf.getLine(0)).toBe("12345");
  });
});

describe("cellsEqual", () => {
  it("considers two empty cells equal", () => {
    expect(cellsEqual(emptyCell(), emptyCell())).toBe(true);
  });

  it("detects different chars", () => {
    const a = emptyCell();
    const b = emptyCell();
    b.char = "x";
    expect(cellsEqual(a, b)).toBe(false);
  });

  it("detects different styles", () => {
    const a = emptyCell();
    const b = emptyCell();
    b.bold = true;
    expect(cellsEqual(a, b)).toBe(false);
  });

  it("compares RGB colors", () => {
    const a = emptyCell();
    const b = emptyCell();
    a.fg = { r: 255, g: 0, b: 0 };
    b.fg = { r: 255, g: 0, b: 0 };
    expect(cellsEqual(a, b)).toBe(true);
    b.fg = { r: 0, g: 255, b: 0 };
    expect(cellsEqual(a, b)).toBe(false);
  });
});
