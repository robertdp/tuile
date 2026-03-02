import { describe, it, expect } from "vitest";
import { h, Fragment } from "../../src/element/h.js";
import { FRAGMENT } from "../../src/element/reconciler.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";

describe("h()", () => {
  it("creates an intrinsic element", () => {
    const el = h(Box, { padding: 1 });
    expect(el.type).toBe(Box);
    expect(el.props).toEqual({ padding: 1 });
    expect(el.children).toEqual([]);
  });

  it("creates an element with string children", () => {
    const el = h(Text, {}, "hello", " ", "world");
    expect(el.type).toBe(Text);
    expect(el.children).toEqual(["hello", " ", "world"]);
  });

  it("creates an element with nested element children", () => {
    const child = h(Text, {}, "inner");
    const el = h(Box, {}, child);
    expect(el.children).toHaveLength(1);
    expect(el.children[0]).toBe(child);
  });

  it("flattens nested arrays", () => {
    const el = h(Box, {}, [h(Text, {}, "a"), h(Text, {}, "b")]);
    expect(el.children).toHaveLength(2);
  });

  it("filters out null, undefined, false, true from children", () => {
    const el = h(Box, {}, "a", null, undefined, false, true, "b");
    expect(el.children).toEqual(["a", "b"]);
  });

  it("handles number children", () => {
    const el = h(Text, {}, 42);
    expect(el.children).toEqual([42]);
  });

  it("handles null props", () => {
    const el = h(Box, null);
    expect(el.props).toEqual({});
  });

  it("handles component type", () => {
    const MyComponent = (props: any) => h(Text, {}, "hello");
    const el = h(MyComponent, { name: "test" });
    expect(el.type).toBe(MyComponent);
    expect(el.props).toEqual({ name: "test" });
  });

  it("handles deeply nested children arrays", () => {
    const el = h(Box, {}, [[["a"]], [["b", "c"]]]);
    expect(el.children).toEqual(["a", "b", "c"]);
  });
});

describe("Fragment", () => {
  it("creates a fragment element", () => {
    const el = Fragment({ children: [h(Text, {}, "a"), h(Text, {}, "b")] });
    expect(el.type).toBe(FRAGMENT);
    expect(el.children).toHaveLength(2);
  });

  it("handles single child", () => {
    const child = h(Text, {}, "only");
    const el = Fragment({ children: child });
    expect(el.children).toHaveLength(1);
  });

  it("handles no children", () => {
    const el = Fragment({});
    expect(el.children).toEqual([]);
  });
});
