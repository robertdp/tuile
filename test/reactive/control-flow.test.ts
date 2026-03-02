import { describe, it, expect, vi } from "vitest";
import { Show, For, Switch, Match } from "../../src/reactive/control-flow.js";
import { mount, unmount, registerRoot, unregisterRoot, TEXT } from "../../src/element/reconciler.js";
import { h } from "../../src/element/h.js";
import { signal, computed, _getSubscriberCount } from "../../src/reactive/signal.js";
import { Text } from "../../src/primitives/Text.js";

// ---------------------------------------------------------------------------

describe("Show", () => {
  it("renders children when condition is truthy", () => {
    const el = h(Show, { when: true }, h(Text, {}, "visible"));
    const node = mount(el);
    // Show creates a fragment. The fragment's children are the mounted content.
    expect(node.children).toHaveLength(1);
    expect(node.children[0].type).toBe(TEXT);
  });

  it("renders nothing when condition is falsy", () => {
    const el = h(Show, { when: false }, h(Text, {}, "hidden"));
    const node = mount(el);
    expect(node.children).toHaveLength(0);
  });

  it("renders fallback when condition is falsy", () => {
    const el = h(Show, { when: false, fallback: h(Text, {}, "fallback") }, h(Text, {}, "main"));
    const node = mount(el);
    expect(node.children).toHaveLength(1);
    expect(node.children[0].children[0].text).toBe("fallback");
  });

  it("swaps content when signal condition changes", () => {
    const visible = signal(true);
    const dirty = vi.fn();

    const el = h(Show, { when: visible, fallback: h(Text, {}, "hidden") }, h(Text, {}, "visible"));
    const node = mount(el);
    registerRoot(node, dirty);

    expect(node.children).toHaveLength(1);
    expect(node.children[0].children[0].text).toBe("visible");

    visible.value = false;
    expect(node.children).toHaveLength(1);
    expect(node.children[0].children[0].text).toBe("hidden");
    expect(dirty).toHaveBeenCalled();

    visible.value = true;
    expect(node.children[0].children[0].text).toBe("visible");

    unmount(node);
    unregisterRoot(node);
  });

  it("does not remount children when signal changes between truthy values", () => {
    const count = signal(1);
    const dirty = vi.fn();
    let mountCount = 0;

    const Child = () => {
      mountCount++;
      return h(Text, {}, "child");
    };

    const el = h(Show, { when: count }, h(Child, {}));
    const node = mount(el);
    registerRoot(node, dirty);

    expect(mountCount).toBe(1);
    expect(node.children).toHaveLength(1);

    // Change from 1 to 2 — still truthy, should NOT remount
    count.value = 2;
    expect(mountCount).toBe(1);

    // Change from 2 to 5 — still truthy, should NOT remount
    count.value = 5;
    expect(mountCount).toBe(1);

    // Change to 0 — falsy, should unmount
    count.value = 0;
    expect(node.children).toHaveLength(0);

    // Change back to truthy — should remount (new mount)
    count.value = 1;
    expect(mountCount).toBe(2);
    expect(node.children).toHaveLength(1);

    unmount(node);
    unregisterRoot(node);
  });

  it("still swaps between truthy and falsy with fallback", () => {
    const visible = signal(true);
    const dirty = vi.fn();

    const el = h(Show, { when: visible, fallback: h(Text, {}, "hidden") }, h(Text, {}, "visible"));
    const node = mount(el);
    registerRoot(node, dirty);

    expect(node.children[0].children[0].text).toBe("visible");

    visible.value = false;
    expect(node.children[0].children[0].text).toBe("hidden");

    visible.value = true;
    expect(node.children[0].children[0].text).toBe("visible");

    unmount(node);
    unregisterRoot(node);
  });

  it("unmounts old children when swapping", () => {
    const visible = signal(true);
    const el = h(Show, { when: visible }, h(Text, {}, "content"));
    const node = mount(el);
    registerRoot(node, () => {});

    const oldChild = node.children[0];
    visible.value = false;
    // Old child should be unmounted (children cleared)
    expect(oldChild.children).toHaveLength(0);

    unmount(node);
    unregisterRoot(node);
  });
});

describe("For", () => {
  it("renders a list of items", () => {
    const el = h(For as any, { each: ["a", "b", "c"] }, (item: string) => h(Text, {}, item));
    const node = mount(el);
    expect(node.children).toHaveLength(3);
    expect(node.children[0].children[0].text).toBe("a");
    expect(node.children[1].children[0].text).toBe("b");
    expect(node.children[2].children[0].text).toBe("c");
  });

  it("renders empty list", () => {
    const el = h(For as any, { each: [] }, (item: string) => h(Text, {}, item));
    const node = mount(el);
    expect(node.children).toHaveLength(0);
  });

  it("updates when signal array changes", () => {
    const items = signal(["x", "y"]);
    const dirty = vi.fn();

    const el = h(For as any, { each: items }, (item: string) => h(Text, {}, item));
    const node = mount(el);
    registerRoot(node, dirty);

    expect(node.children).toHaveLength(2);

    items.value = ["x", "y", "z"];
    expect(node.children).toHaveLength(3);
    expect(node.children[2].children[0].text).toBe("z");
    expect(dirty).toHaveBeenCalled();

    items.value = ["only"];
    expect(node.children).toHaveLength(1);
    expect(node.children[0].children[0].text).toBe("only");

    unmount(node);
    unregisterRoot(node);
  });

  it("reuses nodes across updates when key function matches", () => {
    type Item = { id: number; name: string };
    const items = signal<Item[]>([
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ]);
    const dirty = vi.fn();

    const el = h(For as any, {
      each: items,
      key: (item: Item) => item.id,
    }, (item: Item) => h(Text, {}, item.name));

    const node = mount(el);
    registerRoot(node, dirty);

    expect(node.children).toHaveLength(2);
    const firstChild = node.children[0];
    const secondChild = node.children[1];

    // Update with new object references but same ids
    items.value = [
      { id: 1, name: "Alice Updated" },
      { id: 2, name: "Bob Updated" },
    ];

    // Same nodes should be reused (same identity)
    expect(node.children[0]).toBe(firstChild);
    expect(node.children[1]).toBe(secondChild);

    unmount(node);
    unregisterRoot(node);
  });

  it("creates new nodes for new keys", () => {
    type Item = { id: number; name: string };
    const items = signal<Item[]>([{ id: 1, name: "Alice" }]);
    const dirty = vi.fn();

    const el = h(For as any, {
      each: items,
      key: (item: Item) => item.id,
    }, (item: Item) => h(Text, {}, item.name));

    const node = mount(el);
    registerRoot(node, dirty);

    const originalChild = node.children[0];

    // Add a new item with a different key
    items.value = [
      { id: 1, name: "Alice" },
      { id: 3, name: "Charlie" },
    ];

    expect(node.children).toHaveLength(2);
    expect(node.children[0]).toBe(originalChild); // reused
    expect(node.children[1]).not.toBe(originalChild); // new

    unmount(node);
    unregisterRoot(node);
  });

  it("falls back to identity matching without key prop", () => {
    const items = signal(["a", "b"]);
    const dirty = vi.fn();

    const el = h(For as any, { each: items }, (item: string) => h(Text, {}, item));
    const node = mount(el);
    registerRoot(node, dirty);

    const firstChild = node.children[0];

    // Same string primitives — identity match works
    items.value = ["a", "b", "c"];
    expect(node.children[0]).toBe(firstChild); // reused

    unmount(node);
    unregisterRoot(node);
  });

  it("passes reactive index to render function", () => {
    const items = signal(["a", "b"]);
    const dirty = vi.fn();

    const el = h(For as any, { each: items }, (item: string, i: any) =>
      h(Text, {}, computed(() => `${i.value}:${item}`)),
    );
    const node = mount(el);
    registerRoot(node, dirty);

    expect(node.children[0].children[0].text).toBe("0:a");
    expect(node.children[1].children[0].text).toBe("1:b");

    // Reverse the items — reused nodes should get updated indices
    items.value = ["b", "a"];
    expect(node.children[0].children[0].text).toBe("0:b");
    expect(node.children[1].children[0].text).toBe("1:a");

    unmount(node);
    unregisterRoot(node);
  });
});

describe("Switch / Match", () => {
  it("renders the first matching branch", () => {
    const el = h(
      Switch,
      {},
      h(Match, { when: false }, h(Text, {}, "A")),
      h(Match, { when: true }, h(Text, {}, "B")),
      h(Match, { when: true }, h(Text, {}, "C")),
    );
    const node = mount(el);
    expect(node.children).toHaveLength(1);
    expect(node.children[0].children[0].text).toBe("B");
  });

  it("renders fallback when no branch matches", () => {
    const el = h(
      Switch,
      { fallback: h(Text, {}, "fallback") },
      h(Match, { when: false }, h(Text, {}, "A")),
    );
    const node = mount(el);
    expect(node.children).toHaveLength(1);
    expect(node.children[0].children[0].text).toBe("fallback");
  });

  it("renders nothing when no branch matches and no fallback", () => {
    const el = h(
      Switch,
      {},
      h(Match, { when: false }, h(Text, {}, "A")),
    );
    const node = mount(el);
    expect(node.children).toHaveLength(0);
  });

  it("swaps branch when signal condition changes", () => {
    const condA = signal(true);
    const condB = signal(false);
    const dirty = vi.fn();

    const el = h(
      Switch,
      { fallback: h(Text, {}, "none") },
      h(Match, { when: condA }, h(Text, {}, "A")),
      h(Match, { when: condB }, h(Text, {}, "B")),
    );
    const node = mount(el);
    registerRoot(node, dirty);

    expect(node.children[0].children[0].text).toBe("A");

    condA.value = false;
    expect(node.children[0].children[0].text).toBe("none");

    condB.value = true;
    expect(node.children[0].children[0].text).toBe("B");

    unmount(node);
    unregisterRoot(node);
  });
});

describe("stress tests", () => {
  it("Show toggled 1000 times does not leak subscribers", () => {
    const visible = signal(true);
    const dirty = vi.fn();

    const el = h(Show, { when: visible }, h(Text, {}, "content"));
    const node = mount(el);
    registerRoot(node, dirty);

    for (let i = 0; i < 1000; i++) {
      visible.value = !visible.peek();
    }

    expect(_getSubscriberCount(visible)).toBeLessThanOrEqual(2);

    unmount(node);
    unregisterRoot(node);

    expect(_getSubscriberCount(visible)).toBe(0);
  });

  it("For list updated 1000 times does not leak subscribers", () => {
    const items = signal(["a", "b", "c"]);
    const dirty = vi.fn();

    const el = h(For as any, { each: items }, (item: string) => h(Text, {}, item));
    const node = mount(el);
    registerRoot(node, dirty);

    for (let i = 0; i < 1000; i++) {
      items.value = Array.from({ length: (i % 10) + 1 }, (_, j) => `item-${j}`);
    }

    expect(_getSubscriberCount(items)).toBeLessThanOrEqual(2);

    unmount(node);
    unregisterRoot(node);

    expect(_getSubscriberCount(items)).toBe(0);
  });

  it("Switch toggled 1000 times does not leak subscribers", () => {
    const condA = signal(true);
    const condB = signal(false);
    const dirty = vi.fn();

    const el = h(
      Switch,
      { fallback: h(Text, {}, "none") },
      h(Match, { when: condA }, h(Text, {}, "A")),
      h(Match, { when: condB }, h(Text, {}, "B")),
    );
    const node = mount(el);
    registerRoot(node, dirty);

    for (let i = 0; i < 1000; i++) {
      if (i % 3 === 0) {
        condA.value = !condA.peek();
      } else {
        condB.value = !condB.peek();
      }
    }

    expect(_getSubscriberCount(condA)).toBeLessThanOrEqual(2);
    expect(_getSubscriberCount(condB)).toBeLessThanOrEqual(2);

    unmount(node);
    unregisterRoot(node);

    expect(_getSubscriberCount(condA)).toBe(0);
    expect(_getSubscriberCount(condB)).toBe(0);
  });
});
