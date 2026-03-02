import { describe, it, expect } from "vitest";
import { Select } from "../../src/widgets/Select.js";
import { mount } from "../../src/element/reconciler.js";
import { signal } from "../../src/reactive/signal.js";
import { Box } from "../../src/primitives/Box.js";

function key(k: string) {
  return { key: k, ctrl: false };
}

const options = [
  { label: "Apple", value: "apple" },
  { label: "Banana", value: "banana" },
  { label: "Cherry", value: "cherry" },
];

describe("Select", () => {
  it("returns a box element", () => {
    const el = Select({ options });
    expect(el.type).toBe(Box);
    expect(el.props.direction).toBe("vertical");
  });

  it("has focusable tabIndex", () => {
    const el = Select({ options });
    expect(el.props.tabIndex).toBe(0);
  });

  it("navigates down with arrow keys", () => {
    let selected = "";
    const el = Select({
      options,
      onChange: (v) => { selected = v; },
    });
    const handler = el.props.onKeyPress;

    handler(key("down"));
    handler(key("enter"));
    expect(selected).toBe("banana");
  });

  it("navigates up with arrow keys", () => {
    let selected = "";
    const el = Select({
      options,
      onChange: (v) => { selected = v; },
    });
    const handler = el.props.onKeyPress;

    // Wrap around: up from 0 → last item
    handler(key("up"));
    handler(key("enter"));
    expect(selected).toBe("cherry");
  });

  it("supports vim-style j/k navigation", () => {
    let selected = "";
    const el = Select({
      options,
      onChange: (v) => { selected = v; },
    });
    const handler = el.props.onKeyPress;

    handler(key("j"));
    handler(key("j"));
    handler(key("enter"));
    expect(selected).toBe("cherry");

    handler(key("k"));
    handler(key("enter"));
    expect(selected).toBe("banana");
  });

  it("selects with space key", () => {
    let selected = "";
    const el = Select({
      options,
      onChange: (v) => { selected = v; },
    });
    el.props.onKeyPress(key(" "));
    expect(selected).toBe("apple");
  });

  it("updates controlled value signal", () => {
    const val = signal("");
    const el = Select({ options, value: val });
    el.props.onKeyPress(key("down"));
    el.props.onKeyPress(key("enter"));
    expect(val.peek()).toBe("banana");
  });

  it("wraps around when navigating past end", () => {
    let selected = "";
    const el = Select({
      options,
      onChange: (v) => { selected = v; },
    });
    const handler = el.props.onKeyPress;

    handler(key("down")); // 1
    handler(key("down")); // 2
    handler(key("down")); // wraps to 0
    handler(key("enter"));
    expect(selected).toBe("apple");
  });
});
