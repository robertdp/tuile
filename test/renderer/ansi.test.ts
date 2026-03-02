import { describe, it, expect } from "vitest";
import { fgColor, bgColor } from "../../src/renderer/ansi.js";

describe("hex color shorthand", () => {
  it("parses 6-digit hex", () => {
    const result = fgColor("#ff8800");
    expect(result).toContain("38;2;255;136;0");
  });

  it("parses 3-digit hex shorthand", () => {
    // #f80 → #ff8800
    const result = fgColor("#f80");
    expect(result).toContain("38;2;255;136;0");
  });

  it("parses #fff as white", () => {
    expect(fgColor("#fff")).toContain("38;2;255;255;255");
  });

  it("parses #000 as black", () => {
    expect(fgColor("#000")).toContain("38;2;0;0;0");
  });

  it("works with bgColor too", () => {
    const result = bgColor("#f00");
    expect(result).toContain("48;2;255;0;0");
  });

  it("3-digit and 6-digit produce identical output", () => {
    expect(fgColor("#abc")).toBe(fgColor("#aabbcc"));
    expect(bgColor("#1a2")).toBe(bgColor("#11aa22"));
  });
});
