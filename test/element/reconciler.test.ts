import { describe, it, expect, vi } from "vitest";
import { mount, unmount, registerRoot, unregisterRoot, onMount, onCleanup, createRef, TEXT_NODE, TEXT, BOX } from "../../src/element/reconciler.js";
import { h } from "../../src/element/h.js";
import { signal, _getSubscriberCount } from "../../src/reactive/signal.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";
import { ErrorBoundary } from "../../src/reactive/control-flow.js";
import { collectText } from "../../src/layout/engine.js";

function collectAllText(node: ReturnType<typeof mount>): string {
  return collectText(node);
}

describe("mount", () => {
  it("mounts a simple text element", () => {
    const el = h(Text, {}, "hello");
    const node = mount(el);
    expect(node.type).toBe(TEXT);
    expect(node.children).toHaveLength(1);
    expect(node.children[0].type).toBe(TEXT_NODE);
    expect(node.children[0].text).toBe("hello");
  });

  it("mounts a box with nested text", () => {
    const el = h(Box, { padding: 1 }, h(Text, {}, "inner"));
    const node = mount(el);
    expect(node.type).toBe(BOX);
    expect(node.props.padding).toBe(1);
    expect(node.children).toHaveLength(1);
    expect(node.children[0].type).toBe(TEXT);
  });

  it("mounts a component (calls it once)", () => {
    const fn = vi.fn((props: any) => h(Text, {}, props.label));
    const el = h(fn, { label: "test" });
    const node = mount(el);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(node.type).toBe(TEXT);
    expect(node.children[0].text).toBe("test");
  });

  it("sets up reactive bindings for signal children", () => {
    const name = signal("Alice");
    const el = h(Text, {}, name);
    const dirty = vi.fn();

    const node = mount(el);
    registerRoot(node, dirty);
    expect(node.children[0].text).toBe("Alice");

    name.value = "Bob";
    expect(node.children[0].text).toBe("Bob");
    expect(dirty).toHaveBeenCalled();

    unregisterRoot(node);
  });

  it("sets up reactive bindings for signal props", () => {
    const pad = signal(1);
    const el = h(Box, { padding: pad }, h(Text, {}, "hi"));
    const dirty = vi.fn();

    const node = mount(el);
    registerRoot(node, dirty);
    expect(node.props.padding).toBe(1);

    pad.value = 3;
    expect(node.props.padding).toBe(3);
    expect(dirty).toHaveBeenCalled();

    unregisterRoot(node);
  });

  it("mounts nested components", () => {
    const Inner = (props: any) => h(Text, {}, props.value);
    const Outer = (props: any) => h(Box, {}, h(Inner, { value: "nested" }));
    const el = h(Outer, {});
    const node = mount(el);
    expect(node.type).toBe(BOX);
    expect(node.children[0].type).toBe(TEXT);
    expect(node.children[0].children[0].text).toBe("nested");
  });

  it("passes children to component props", () => {
    const Wrapper = (props: any) => {
      return h(Box, {}, props.children);
    };
    const el = h(Wrapper, {}, h(Text, {}, "child"));
    const node = mount(el);
    expect(node.type).toBe(BOX);
    expect(node.children[0].type).toBe(TEXT);
  });

  it("handles string primitives", () => {
    const node = mount("hello" as any);
    expect(node.type).toBe(TEXT_NODE);
    expect(node.text).toBe("hello");
  });

  it("handles number primitives", () => {
    const node = mount(42 as any);
    expect(node.type).toBe(TEXT_NODE);
    expect(node.text).toBe("42");
  });

  it("handles null", () => {
    const node = mount(null as any);
    expect(node.type).toBe(TEXT_NODE);
    expect(node.text).toBe("");
  });
});

describe("unmount", () => {
  it("disposes reactive effects", () => {
    const name = signal("Alice");
    const el = h(Text, {}, name);
    const dirty = vi.fn();

    const node = mount(el);
    registerRoot(node, dirty);
    expect(node.children[0].text).toBe("Alice");

    unmount(node);
    unregisterRoot(node);

    // After unmount, signal changes should not update the node
    dirty.mockClear();
    name.value = "Bob";
    expect(dirty).not.toHaveBeenCalled();
  });

  it("clears children and parent references", () => {
    const el = h(Box, {}, h(Text, {}, "a"), h(Text, {}, "b"));
    const node = mount(el);
    expect(node.children).toHaveLength(2);

    unmount(node);
    expect(node.children).toHaveLength(0);
    expect(node.parent).toBeNull();
  });

  it("removes child from parent.children when unmounting a single child", () => {
    const el = h(Box, {}, h(Text, {}, "a"), h(Text, {}, "b"), h(Text, {}, "c"));
    const parent = mount(el);
    expect(parent.children).toHaveLength(3);

    const middle = parent.children[1];
    unmount(middle);

    expect(parent.children).toHaveLength(2);
    expect(parent.children[0].children[0].text).toBe("a");
    expect(parent.children[1].children[0].text).toBe("c");
    expect(middle.parent).toBeNull();
  });

  it("handles unmounting a node with no parent", () => {
    const el = h(Text, {}, "standalone");
    const node = mount(el);
    unmount(node);
    expect(node.parent).toBeNull();
  });
});

describe("lifecycle hooks", () => {
  it("onMount fires after mount() completes", () => {
    const order: string[] = [];

    const Comp = () => {
      order.push("render");
      onMount(() => {
        order.push("onMount");
      });
      return h(Text, {}, "hello");
    };

    mount(h(Comp, {}));
    expect(order).toEqual(["render", "onMount"]);
  });

  it("onCleanup fires when component is unmounted", () => {
    const cleanupFn = vi.fn();

    const Comp = () => {
      onCleanup(cleanupFn);
      return h(Text, {}, "hello");
    };

    const node = mount(h(Comp, {}));
    expect(cleanupFn).not.toHaveBeenCalled();

    unmount(node);
    expect(cleanupFn).toHaveBeenCalledTimes(1);
  });

  it("onMount for nested components fires in order", () => {
    const order: string[] = [];

    const Inner = () => {
      onMount(() => order.push("inner-mount"));
      return h(Text, {}, "inner");
    };

    const Outer = () => {
      onMount(() => order.push("outer-mount"));
      return h(Box, {}, h(Inner, {}));
    };

    mount(h(Outer, {}));
    expect(order).toEqual(["outer-mount", "inner-mount"]);
  });

  it("onCleanup for nested components fires on unmount", () => {
    const outerCleanup = vi.fn();
    const innerCleanup = vi.fn();

    const Inner = () => {
      onCleanup(innerCleanup);
      return h(Text, {}, "inner");
    };

    const Outer = () => {
      onCleanup(outerCleanup);
      return h(Box, {}, h(Inner, {}));
    };

    const node = mount(h(Outer, {}));
    unmount(node);
    expect(outerCleanup).toHaveBeenCalledTimes(1);
    expect(innerCleanup).toHaveBeenCalledTimes(1);
  });

  it("multiple onCleanup calls accumulate", () => {
    const cleanup1 = vi.fn();
    const cleanup2 = vi.fn();

    const Comp = () => {
      onCleanup(cleanup1);
      onCleanup(cleanup2);
      return h(Text, {}, "hello");
    };

    const node = mount(h(Comp, {}));
    unmount(node);
    expect(cleanup1).toHaveBeenCalledTimes(1);
    expect(cleanup2).toHaveBeenCalledTimes(1);
  });
});

describe("error boundaries", () => {
  it("component errors propagate without ErrorBoundary", () => {
    const BrokenComp = () => {
      throw new Error("component exploded");
    };

    expect(() => mount(h(BrokenComp, {}))).toThrow("component exploded");
  });

  it("ErrorBoundary catches component errors and renders fallback", () => {
    const BrokenComp = () => {
      throw new Error("component exploded");
    };

    const el = h(ErrorBoundary, {
      fallback: (err: Error) => h(Text, {}, `Error: ${err.message}`),
    }, h(BrokenComp, {}));
    const node = mount(el);

    // The fallback text should be rendered
    const text = collectAllText(node);
    expect(text).toContain("Error: component exploded");
  });

  it("ErrorBoundary catches non-Error throws", () => {
    const BrokenComp = () => {
      throw "string error";
    };

    const el = h(ErrorBoundary, {
      fallback: (err: Error) => h(Text, {}, `Error: ${err.message}`),
    }, h(BrokenComp, {}));
    const node = mount(el);

    const text = collectAllText(node);
    expect(text).toContain("Error: string error");
  });

  it("ErrorBoundary calls onError callback", () => {
    const onError = vi.fn();
    const BrokenComp = () => { throw new Error("boom"); };

    const el = h(ErrorBoundary, {
      fallback: "oops",
      onError,
    }, h(BrokenComp, {}));
    mount(el);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toBe("boom");
  });
});

describe("createRef", () => {
  it("ref.current is populated after mount", () => {
    const ref = createRef();
    expect(ref.current).toBeNull();

    const el = h(Box, { ref, padding: 1 });
    const node = mount(el);

    expect(ref.current).toBe(node);
  });

  it("ref.current is cleared after unmount", () => {
    const ref = createRef();

    const el = h(Box, { ref });
    const node = mount(el);
    expect(ref.current).toBe(node);

    unmount(node);
    expect(ref.current).toBeNull();
  });

  it("ref works on text elements", () => {
    const ref = createRef();

    const el = h(Text, { ref }, "hello");
    const node = mount(el);

    expect(ref.current).toBe(node);
    expect(node.type).toBe(TEXT);

    unmount(node);
    expect(ref.current).toBeNull();
  });

  it("ref is not copied to node.props", () => {
    const ref = createRef();

    const el = h(Box, { ref, padding: 2 });
    const node = mount(el);

    expect(node.props.ref).toBeUndefined();
    expect(node.props.padding).toBe(2);

    unmount(node);
  });
});

describe("mount/unmount subscriber cleanup", () => {
  it("signal children have zero subscribers after unmount", () => {
    const name = signal("Alice");
    const el = h(Text, {}, name);

    const node = mount(el);
    expect(_getSubscriberCount(name)).toBeGreaterThan(0);

    unmount(node);
    expect(_getSubscriberCount(name)).toBe(0);
  });

  it("signal props have zero subscribers after unmount", () => {
    const pad = signal(1);
    const el = h(Box, { padding: pad }, h(Text, {}, "hi"));

    const node = mount(el);
    expect(_getSubscriberCount(pad)).toBeGreaterThan(0);

    unmount(node);
    expect(_getSubscriberCount(pad)).toBe(0);
  });

  it("nested tree with multiple signals cleans up fully", () => {
    const title = signal("Title");
    const visible = signal(true);
    const color = signal("red");

    const el = h(Box, { bgColor: color },
      h(Text, {}, title),
      h(Text, {}, visible),
    );

    const node = mount(el);
    expect(_getSubscriberCount(title)).toBeGreaterThan(0);
    expect(_getSubscriberCount(visible)).toBeGreaterThan(0);
    expect(_getSubscriberCount(color)).toBeGreaterThan(0);

    unmount(node);
    expect(_getSubscriberCount(title)).toBe(0);
    expect(_getSubscriberCount(visible)).toBe(0);
    expect(_getSubscriberCount(color)).toBe(0);
  });

  it("signals do not fire effects after unmount", () => {
    const name = signal("Alice");
    const el = h(Text, {}, name);
    const dirty = vi.fn();

    const node = mount(el);
    registerRoot(node, dirty);

    unmount(node);
    unregisterRoot(node);

    dirty.mockClear();
    name.value = "Bob";
    expect(dirty).not.toHaveBeenCalled();
  });
});
