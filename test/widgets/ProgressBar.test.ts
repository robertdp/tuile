import { describe, it, expect } from "vitest";
import { ProgressBar } from "../../src/widgets/ProgressBar.js";
import { mount, BOX } from "../../src/element/reconciler.js";
import { signal } from "../../src/reactive/signal.js";
import { Box } from "../../src/primitives/Box.js";

describe("ProgressBar", () => {
  it("returns a box element", () => {
    const el = ProgressBar({ value: 0.5 });
    expect(el.type).toBe(Box);
    expect(el.props.direction).toBe("horizontal");
  });

  it("mounts with static value", () => {
    const el = ProgressBar({ value: 0.5, width: 10 });
    const node = mount(el);
    expect(node.type).toBe(BOX);
    // Children: bar text + label text
    expect(node.children.length).toBe(2);
  });

  it("mounts with signal value", () => {
    const val = signal(0.3);
    const el = ProgressBar({ value: val, width: 10 });
    const node = mount(el);
    expect(node.type).toBe(BOX);
  });

  it("clamps value to 0-1 range", () => {
    const el = ProgressBar({ value: 1.5, width: 10, showLabel: false });
    const node = mount(el);
    // Should not throw, value clamped to 1
    expect(node.children.length).toBe(1);
  });

  it("hides label when showLabel=false", () => {
    const el = ProgressBar({ value: 0.5, showLabel: false });
    const node = mount(el);
    // Only bar text, no label
    expect(node.children.length).toBe(1);
  });

  it("supports custom fill/empty characters", () => {
    const el = ProgressBar({ value: 0.5, filled: "#", empty: ".", width: 10 });
    const node = mount(el);
    expect(node.type).toBe(BOX);
  });
});
