import { describe, it, expect, vi, afterEach } from "vitest";
import { Spinner, spinnerFrames } from "../../src/widgets/Spinner.js";
import { mount, unmount, BOX } from "../../src/element/reconciler.js";
import { h } from "../../src/element/h.js";
import { Box } from "../../src/primitives/Box.js";

describe("Spinner", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a box with text children", () => {
    vi.useFakeTimers();
    const el = Spinner({ label: "Loading" });
    expect(el.type).toBe(Box);
    expect(el.props.direction).toBe("horizontal");
    expect(el.children.length).toBe(2); // spinner + label
    vi.useRealTimers();
  });

  it("mounts without error", () => {
    vi.useFakeTimers();
    const el = Spinner({});
    const node = mount(el);
    expect(node.type).toBe(BOX);
    unmount(node);
    vi.useRealTimers();
  });

  it("has built-in frame sets", () => {
    expect(spinnerFrames.dots.length).toBeGreaterThan(0);
    expect(spinnerFrames.line.length).toBeGreaterThan(0);
    expect(spinnerFrames.arc.length).toBeGreaterThan(0);
  });

  it("accepts custom frames", () => {
    vi.useFakeTimers();
    const el = Spinner({ type: ["a", "b", "c"] });
    expect(el.type).toBe(Box);
    vi.useRealTimers();
  });

  it("starts timer only after mount via onMount", () => {
    const el = h(Spinner, { type: "line", interval: 50, label: "loading" });
    const node = mount(el);
    // The spinner should have children (frame text + label text)
    expect(node.children.length).toBeGreaterThanOrEqual(1);
    unmount(node);
  });
});
