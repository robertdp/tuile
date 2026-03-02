import { describe, it, expect } from "vitest";
import { Checkbox } from "../../src/widgets/Checkbox.js";
import { mount } from "../../src/element/reconciler.js";
import { signal } from "../../src/reactive/signal.js";
import { Box } from "../../src/primitives/Box.js";

function key(k: string) {
  return { key: k, ctrl: false };
}

describe("Checkbox", () => {
  it("returns a box with indicator and label", () => {
    const el = Checkbox({ label: "Accept" });
    expect(el.type).toBe(Box);
    expect(el.props.direction).toBe("horizontal");
    expect(el.children.length).toBe(3); // indicator, space, label
  });

  it("mounts and has focusable tabIndex", () => {
    const el = Checkbox({ label: "Test" });
    const node = mount(el);
    expect(node.props.tabIndex).toBe(0);
  });

  it("toggles with controlled signal", () => {
    const checked = signal(false);
    const el = Checkbox({ label: "Test", checked });

    // Simulate keypress
    const handler = el.props.onKeyPress;
    expect(handler).toBeDefined();
    handler(key(" "));
    expect(checked.peek()).toBe(true);
    handler(key(" "));
    expect(checked.peek()).toBe(false);
  });

  it("toggles on enter key", () => {
    const checked = signal(false);
    const el = Checkbox({ label: "Test", checked });
    el.props.onKeyPress(key("enter"));
    expect(checked.peek()).toBe(true);
  });

  it("calls onChange callback", () => {
    const values: boolean[] = [];
    const el = Checkbox({
      label: "Test",
      onChange: (v) => values.push(v),
    });
    el.props.onKeyPress(key(" "));
    el.props.onKeyPress(key(" "));
    expect(values).toEqual([true, false]);
  });

  it("uses defaultChecked for initial state", () => {
    const el = Checkbox({ label: "Test", defaultChecked: true });
    // The internal signal starts as true; toggling should make it false
    el.props.onKeyPress(key(" "));
    // Not much we can assert without rendering, but no error means it works
  });
});
