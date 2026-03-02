import { describe, it, expect } from "vitest";
import { CellBuffer } from "../../src/renderer/buffer.js";

describe("CellBuffer.write with Unicode", () => {
  it("writes CJK characters as 2-column cells", () => {
    const buf = new CellBuffer(10, 1);
    buf.write(0, 0, "漢字");
    // "漢" at x=0 (wide), continuation at x=1
    // "字" at x=2 (wide), continuation at x=3
    expect(buf.get(0, 0)!.char).toBe("漢");
    expect(buf.get(1, 0)!.char).toBe(""); // continuation
    expect(buf.get(2, 0)!.char).toBe("字");
    expect(buf.get(3, 0)!.char).toBe(""); // continuation
    expect(buf.get(4, 0)!.char).toBe(" "); // untouched
  });

  it("writes mixed ASCII and CJK", () => {
    const buf = new CellBuffer(10, 1);
    buf.write(0, 0, "a漢b");
    expect(buf.get(0, 0)!.char).toBe("a");
    expect(buf.get(1, 0)!.char).toBe("漢");
    expect(buf.get(2, 0)!.char).toBe(""); // continuation
    expect(buf.get(3, 0)!.char).toBe("b");
  });

  it("clips wide characters at buffer edge", () => {
    const buf = new CellBuffer(3, 1);
    buf.write(0, 0, "漢字");
    // "漢" at x=0 with continuation at x=1 — fits
    // "字" at x=2 — wide, needs x=3 but buffer is only 3 wide
    // Wide char doesn't fit — replaced with space to avoid terminal corruption
    expect(buf.get(0, 0)!.char).toBe("漢");
    expect(buf.get(1, 0)!.char).toBe(""); // continuation
    expect(buf.get(2, 0)!.char).toBe(" "); // space placeholder — no room for wide char
  });

  it("applies style to continuation cells", () => {
    const buf = new CellBuffer(10, 1);
    buf.write(0, 0, "漢", { bold: true, fg: "red" });
    expect(buf.get(0, 0)!.bold).toBe(true);
    expect(buf.get(0, 0)!.fg).toBe("red");
    expect(buf.get(1, 0)!.bold).toBe(true);
    expect(buf.get(1, 0)!.fg).toBe("red");
  });

  it("handles emoji", () => {
    const buf = new CellBuffer(10, 1);
    buf.write(0, 0, "😀x");
    expect(buf.get(0, 0)!.char).toBe("😀");
    expect(buf.get(1, 0)!.char).toBe(""); // continuation
    expect(buf.get(2, 0)!.char).toBe("x");
  });

  it("getLine returns full graphemes including continuations", () => {
    const buf = new CellBuffer(10, 1);
    buf.write(0, 0, "a漢b");
    // getLine joins all chars: "a" + "漢" + "" + "b" + " " * 6
    const line = buf.getLine(0);
    expect(line).toBe("a漢b      ");
  });
});
