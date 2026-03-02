import { describe, it, expect } from "vitest";
import { TextInput } from "../../src/widgets/TextInput.js";
import { mount } from "../../src/element/reconciler.js";
import { signal } from "../../src/reactive/signal.js";
import { Box } from "../../src/primitives/Box.js";

function key(k: string, ctrl = false) {
  return { key: k, ctrl };
}

describe("TextInput", () => {
  it("returns a box element", () => {
    const el = TextInput({});
    expect(el.type).toBe(Box);
  });

  it("has focusable tabIndex", () => {
    const el = TextInput({});
    expect(el.props.tabIndex).toBe(0);
  });

  it("inserts characters via keypress handler", () => {
    const val = signal("");
    const el = TextInput({ value: val });
    const handler = el.props.onKeyPress;

    handler(key("h"));
    handler(key("i"));
    expect(val.peek()).toBe("hi");
  });

  it("handles backspace", () => {
    const val = signal("abc");
    const el = TextInput({ value: val });
    const handler = el.props.onKeyPress;

    // Cursor starts at end (position 3)
    handler(key("backspace"));
    expect(val.peek()).toBe("ab");
  });

  it("handles delete key", () => {
    const val = signal("abc");
    const el = TextInput({ value: val });
    const handler = el.props.onKeyPress;

    // Move cursor to start
    handler(key("home"));
    handler(key("delete"));
    expect(val.peek()).toBe("bc");
  });

  it("handles arrow key navigation", () => {
    const val = signal("abc");
    const el = TextInput({ value: val });
    const handler = el.props.onKeyPress;

    // Cursor at end (3), move left, insert 'x'
    handler(key("left"));
    handler(key("x"));
    expect(val.peek()).toBe("abxc");
  });

  it("calls onSubmit on enter", () => {
    let submitted = "";
    const val = signal("hello");
    const el = TextInput({
      value: val,
      onSubmit: (v) => { submitted = v; },
    });
    el.props.onKeyPress(key("enter"));
    expect(submitted).toBe("hello");
  });

  it("calls onChange on character input", () => {
    const changes: string[] = [];
    const el = TextInput({
      onChange: (v) => changes.push(v),
    });
    el.props.onKeyPress(key("a"));
    el.props.onKeyPress(key("b"));
    expect(changes).toEqual(["a", "ab"]);
  });

  it("ignores ctrl+key as printable input", () => {
    const val = signal("");
    const el = TextInput({ value: val });
    el.props.onKeyPress(key("c", true));
    expect(val.peek()).toBe("");
  });

  it("home/end navigation", () => {
    const val = signal("abcd");
    const el = TextInput({ value: val });
    const handler = el.props.onKeyPress;

    handler(key("home"));
    handler(key("x"));
    expect(val.peek()).toBe("xabcd");

    handler(key("end"));
    handler(key("y"));
    expect(val.peek()).toBe("xabcdy");
  });
});
