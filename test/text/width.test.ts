import { describe, it, expect } from "vitest";
import { graphemes, graphemeWidth, stringWidth, sliceByWidth, wrapText } from "../../src/text/width.js";
import { measureText } from "../../src/layout/constraints.js";

describe("graphemes", () => {
  it("splits ASCII text into individual characters", () => {
    expect(graphemes("hello")).toEqual(["h", "e", "l", "l", "o"]);
  });

  it("keeps CJK characters as individual graphemes", () => {
    expect(graphemes("漢字")).toEqual(["漢", "字"]);
  });

  it("keeps ZWJ emoji as a single grapheme", () => {
    const result = graphemes("👨‍👩‍👧");
    expect(result).toHaveLength(1);
    expect(result[0]).toBe("👨‍👩‍👧");
  });

  it("keeps flag emoji as a single grapheme", () => {
    const result = graphemes("🇯🇵");
    expect(result).toHaveLength(1);
  });

  it("keeps skin-tone emoji as a single grapheme", () => {
    const result = graphemes("👋🏽");
    expect(result).toHaveLength(1);
  });

  it("handles empty string", () => {
    expect(graphemes("")).toEqual([]);
  });

  it("handles mixed ASCII and CJK", () => {
    expect(graphemes("a漢b")).toEqual(["a", "漢", "b"]);
  });
});

describe("graphemeWidth (single codepoint)", () => {
  it("returns 1 for ASCII characters", () => {
    expect(graphemeWidth("a")).toBe(1);
    expect(graphemeWidth("Z")).toBe(1);
    expect(graphemeWidth("0")).toBe(1);
  });

  it("returns 2 for CJK ideographs", () => {
    expect(graphemeWidth("漢")).toBe(2);
    expect(graphemeWidth("字")).toBe(2);
  });

  it("returns 2 for Hiragana", () => {
    expect(graphemeWidth("あ")).toBe(2);
  });

  it("returns 2 for Katakana", () => {
    expect(graphemeWidth("カ")).toBe(2);
  });

  it("returns 2 for Hangul syllables", () => {
    expect(graphemeWidth("한")).toBe(2);
  });

  it("returns 2 for fullwidth Latin", () => {
    expect(graphemeWidth("Ａ")).toBe(2);
  });
});

describe("graphemeWidth", () => {
  it("returns 1 for ASCII", () => {
    expect(graphemeWidth("a")).toBe(1);
  });

  it("returns 2 for CJK", () => {
    expect(graphemeWidth("漢")).toBe(2);
  });

  it("returns 2 for ZWJ emoji", () => {
    expect(graphemeWidth("👨‍👩‍👧")).toBe(2);
  });

  it("returns 2 for flag emoji", () => {
    expect(graphemeWidth("🇯🇵")).toBe(2);
  });

  it("returns 2 for skin-tone emoji", () => {
    expect(graphemeWidth("👋🏽")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(graphemeWidth("")).toBe(0);
  });
});

describe("stringWidth", () => {
  it("returns correct width for ASCII", () => {
    expect(stringWidth("hello")).toBe(5);
  });

  it("returns correct width for CJK text", () => {
    expect(stringWidth("漢字")).toBe(4);
  });

  it("returns correct width for mixed text", () => {
    // "a" = 1, "漢" = 2, "b" = 1 => 4
    expect(stringWidth("a漢b")).toBe(4);
  });

  it("returns correct width for emoji", () => {
    // Single emoji = 2 columns
    expect(stringWidth("😀")).toBe(2);
  });

  it("returns correct width for ZWJ emoji sequence", () => {
    // Family emoji is one grapheme, 2 columns wide
    expect(stringWidth("👨‍👩‍👧")).toBe(2);
  });

  it("returns 0 for empty string", () => {
    expect(stringWidth("")).toBe(0);
  });

  it("handles Hiragana text", () => {
    // ひらがな = 4 chars x 2 columns = 8
    expect(stringWidth("ひらがな")).toBe(8);
  });

  it("handles fullwidth forms", () => {
    // Ａ = 2 columns
    expect(stringWidth("ＡＢ")).toBe(4);
  });
});

describe("sliceByWidth", () => {
  it("slices ASCII by character", () => {
    expect(sliceByWidth("hello", 3)).toBe("hel");
  });

  it("slices CJK without splitting wide chars", () => {
    // "漢字" = 4 columns. maxWidth=3 => only "漢" fits (2 cols), "字" would be 4
    expect(sliceByWidth("漢字", 3)).toBe("漢");
  });

  it("slices mixed text correctly", () => {
    // "a漢b" widths: a=1, 漢=2, b=1. maxWidth=3 => "a漢" (3 cols)
    expect(sliceByWidth("a漢b", 3)).toBe("a漢");
  });

  it("returns empty string for maxWidth 0", () => {
    expect(sliceByWidth("hello", 0)).toBe("");
  });

  it("returns full string if it fits", () => {
    expect(sliceByWidth("hi", 10)).toBe("hi");
  });

  it("handles emoji without splitting", () => {
    // "😀a" = 2+1=3. maxWidth=2 => "😀" fits
    expect(sliceByWidth("😀a", 2)).toBe("😀");
    // maxWidth=1 => emoji doesn't fit
    expect(sliceByWidth("😀a", 1)).toBe("");
  });
});

describe("measureText with Unicode", () => {
  it("measures CJK text width correctly", () => {
    const result = measureText("漢字", 80, "none");
    expect(result.width).toBe(4);
    expect(result.height).toBe(1);
  });

  it("wraps CJK text by display width", () => {
    // "漢字漢字" = 8 columns, maxWidth=5 => wraps
    const result = measureText("漢字漢字", 5, "word");
    expect(result.height).toBe(2);
    expect(result.width).toBeLessThanOrEqual(5);
  });

  it("truncates CJK text by display width", () => {
    const result = measureText("漢字漢字", 5, "truncate");
    expect(result.width).toBeLessThanOrEqual(5);
    expect(result.height).toBe(1);
  });

  it("measures mixed ASCII/CJK correctly", () => {
    // "a漢b" = 1+2+1 = 4 columns
    const result = measureText("a漢b", 80, "none");
    expect(result.width).toBe(4);
  });
});

describe("wrapText", () => {
  it("returns lines unchanged in 'none' mode", () => {
    expect(wrapText("hello world", 5, "none")).toEqual(["hello world"]);
  });

  it("truncates lines in 'truncate' mode", () => {
    expect(wrapText("hello world", 5, "truncate")).toEqual(["hello"]);
  });

  it("word-wraps at word boundaries", () => {
    const result = wrapText("hello world foo", 11, "word");
    expect(result).toEqual(["hello world", "foo"]);
  });

  it("handles words longer than maxWidth", () => {
    const result = wrapText("abcdefghij", 5, "word");
    expect(result).toEqual(["abcde", "fghij"]);
  });

  it("handles multiline input", () => {
    const result = wrapText("hello\nworld", 20, "word");
    expect(result).toEqual(["hello", "world"]);
  });

  it("returns empty array for maxWidth <= 0", () => {
    expect(wrapText("hello", 0, "word")).toEqual([]);
    expect(wrapText("hello", -1, "word")).toEqual([]);
  });

  it("preserves short lines without wrapping", () => {
    expect(wrapText("hi", 10, "word")).toEqual(["hi"]);
  });

  it("wraps CJK text that has no spaces", () => {
    // Each CJK char is 2 columns. "漢字漢字" = 8 cols, maxWidth=5
    const result = wrapText("漢字漢字", 5, "word");
    expect(result).toEqual(["漢字", "漢字"]);
  });

  it("wraps each CJK character individually at small width", () => {
    const result = wrapText("漢字", 2, "word");
    expect(result).toEqual(["漢", "字"]);
  });

  it("wraps mixed CJK and Latin text", () => {
    // "hello漢字world" = 5+2+2+5 = 14 cols, maxWidth=10
    const result = wrapText("hello漢字world", 10, "word");
    expect(result).toEqual(["hello漢字", "world"]);
  });

  it("still wraps Latin text at space boundaries", () => {
    const result = wrapText("hello world", 8, "word");
    expect(result).toEqual(["hello", "world"]);
  });
});
