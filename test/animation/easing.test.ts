import { describe, it, expect } from "vitest";
import {
  linear,
  easeInQuad,
  easeOutQuad,
  easeInOutQuad,
  easeInCubic,
  easeOutCubic,
  easeInOutCubic,
  easeInSine,
  easeOutSine,
  easeInOutSine,
  easeInExpo,
  easeOutExpo,
  easeInOutExpo,
  easeInElastic,
  easeOutElastic,
  easeInBounce,
  easeOutBounce,
  easeInBack,
  easeOutBack,
  resolveEasing,
  cubicBezier,
} from "../../src/animation/easing.js";

describe("easing functions", () => {
  // All easing functions should satisfy f(0) = 0 and f(1) = 1
  const easings = [
    ["linear", linear],
    ["easeInQuad", easeInQuad],
    ["easeOutQuad", easeOutQuad],
    ["easeInOutQuad", easeInOutQuad],
    ["easeInCubic", easeInCubic],
    ["easeOutCubic", easeOutCubic],
    ["easeInOutCubic", easeInOutCubic],
    ["easeInSine", easeInSine],
    ["easeOutSine", easeOutSine],
    ["easeInOutSine", easeInOutSine],
    ["easeInExpo", easeInExpo],
    ["easeOutExpo", easeOutExpo],
    ["easeInOutExpo", easeInOutExpo],
    ["easeInElastic", easeInElastic],
    ["easeOutElastic", easeOutElastic],
    ["easeInBounce", easeInBounce],
    ["easeOutBounce", easeOutBounce],
    ["easeInBack", easeInBack],
    ["easeOutBack", easeOutBack],
  ] as const;

  for (const [name, fn] of easings) {
    it(`${name}: f(0) = 0 and f(1) = 1`, () => {
      expect(fn(0)).toBeCloseTo(0, 5);
      expect(fn(1)).toBeCloseTo(1, 5);
    });
  }

  it("linear is identity", () => {
    expect(linear(0.25)).toBe(0.25);
    expect(linear(0.5)).toBe(0.5);
    expect(linear(0.75)).toBe(0.75);
  });

  it("easeInQuad starts slow", () => {
    expect(easeInQuad(0.25)).toBeLessThan(0.25);
    expect(easeInQuad(0.5)).toBeLessThan(0.5);
  });

  it("easeOutQuad ends slow", () => {
    expect(easeOutQuad(0.5)).toBeGreaterThan(0.5);
    expect(easeOutQuad(0.75)).toBeGreaterThan(0.75);
  });

  it("easeInOut is symmetric at midpoint", () => {
    expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 5);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 5);
    expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("resolveEasing", () => {
  it("resolves string name to function", () => {
    const fn = resolveEasing("ease-in-quad");
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
    expect(fn).toBe(easeInQuad);
  });

  it("passes through a function directly", () => {
    const custom = (t: number) => t * t * t;
    expect(resolveEasing(custom)).toBe(custom);
  });

  it("throws for unknown name", () => {
    expect(() => resolveEasing("not-a-thing" as any)).toThrow("Unknown easing");
  });
});

describe("cubicBezier", () => {
  it("boundary values", () => {
    const ease = cubicBezier(0.25, 0.1, 0.25, 1.0);
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
  });

  it("linear approximation with (0,0,1,1)", () => {
    const ease = cubicBezier(0, 0, 1, 1);
    expect(ease(0.5)).toBeCloseTo(0.5, 1);
    expect(ease(0.25)).toBeCloseTo(0.25, 1);
  });

  it("ease-in curve starts slow", () => {
    const ease = cubicBezier(0.42, 0, 1, 1);
    expect(ease(0.25)).toBeLessThan(0.25);
  });
});
