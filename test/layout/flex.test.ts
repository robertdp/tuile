import { describe, it, expect } from "vitest";
import { h } from "../../src/element/h.js";
import { mount } from "../../src/element/reconciler.js";
import { computeLayout } from "../../src/layout/engine.js";
import { Box } from "../../src/primitives/Box.js";

describe("flex layout", () => {
  it("flexGrow distributes free space proportionally (vertical)", () => {
    const el = h(Box, { height: 10, width: 10 },
      h(Box, { flexGrow: 1 }),     // should grow to fill
      h(Box, { height: 2 }),         // fixed height
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 10);

    // Parent height=10, fixed child=2, so 8 free space
    // flexGrow child gets all 8
    expect(layout.children[0].layout.height).toBe(8);
    expect(layout.children[1].layout.height).toBe(2);
  });

  it("flexGrow distributes space between multiple growers", () => {
    const el = h(Box, { height: 12, width: 10 },
      h(Box, { flexGrow: 1 }),
      h(Box, { flexGrow: 2 }),
      h(Box, { height: 3 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 12);

    // Free space: 12 - 3 = 9 (growers have 0 intrinsic)
    // flexGrow=1: 9 * 1/3 = 3
    // flexGrow=2: 9 * 2/3 = 6
    expect(layout.children[0].layout.height).toBe(3);
    expect(layout.children[1].layout.height).toBe(6);
    expect(layout.children[2].layout.height).toBe(3);
  });

  it("flexGrow works in horizontal direction", () => {
    const el = h(Box, { width: 20, height: 5, direction: "horizontal" },
      h(Box, { width: 5 }),
      h(Box, { flexGrow: 1 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 5);

    // Free space: 20 - 5 = 15
    expect(layout.children[0].layout.width).toBe(5);
    expect(layout.children[1].layout.width).toBe(15);
  });

  it("flex shorthand works like flexGrow", () => {
    const el = h(Box, { height: 10, width: 10 },
      h(Box, { flex: 1 }),
      h(Box, { flex: 3 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 10);

    // Free space: 10 (both have 0 intrinsic)
    // flex=1: floor(10 * 1/4) = 2, flex=3: floor(10 * 3/4) = 7
    // Remainder: 10 - 9 = 1, goes to first child
    expect(layout.children[0].layout.height).toBe(3);
    expect(layout.children[1].layout.height).toBe(7);
  });

  it("flexShrink reduces overflowing children", () => {
    const el = h(Box, { height: 10, width: 10 },
      h(Box, { height: 8, flexShrink: 1 }),
      h(Box, { height: 8, flexShrink: 1 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 10);

    // Total intrinsic: 16, container: 10, overflow: 6
    // Each shrinks by 3 (6/2)
    expect(layout.children[0].layout.height).toBe(5);
    expect(layout.children[1].layout.height).toBe(5);
  });

  it("flexShrink weighted proportionally", () => {
    const el = h(Box, { height: 10, width: 10 },
      h(Box, { height: 8, flexShrink: 1 }),
      h(Box, { height: 8, flexShrink: 3 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 10);

    // Overflow: 16 - 10 = 6
    // shrink=1: floor(6 * 1/4) = 1, shrink=3: floor(6 * 3/4) = 4
    // Remainder: 6 - 5 = 1, extra shrink to first child
    expect(layout.children[0].layout.height).toBe(6);
    expect(layout.children[1].layout.height).toBe(4);
  });

  it("no flex defaults — children do not grow or shrink", () => {
    const el = h(Box, { height: 20, width: 10 },
      h(Box, { height: 3 }),
      h(Box, { height: 5 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 20);

    // No flex props — sizes stay at intrinsic
    expect(layout.children[0].layout.height).toBe(3);
    expect(layout.children[1].layout.height).toBe(5);
  });

  it("flexGrow with gap", () => {
    const el = h(Box, { height: 10, width: 10, gap: 2 },
      h(Box, { flexGrow: 1 }),
      h(Box, { height: 2 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 10);

    // Free space: 10 - 0 - 2 - 2(gap) = 6
    expect(layout.children[0].layout.height).toBe(6);
    expect(layout.children[1].layout.height).toBe(2);
  });

  it("flex rounding remainder is distributed to first N children", () => {
    const el = h(Box, { height: 10, width: 10 },
      h(Box, { flexGrow: 1 }),
      h(Box, { flexGrow: 1 }),
      h(Box, { flexGrow: 1 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 10);

    // 10 / 3 = 3 each, remainder 1 → first child gets 4
    expect(layout.children[0].layout.height).toBe(4);
    expect(layout.children[1].layout.height).toBe(3);
    expect(layout.children[2].layout.height).toBe(3);
    // Total: 4+3+3 = 10 (no pixel loss)
  });

  it("nested flex: inner flex receives correct size from outer flex", () => {
    const el = h(Box, { height: 20, width: 10 },
      h(Box, { flex: 1 },
        h(Box, { flex: 1 }),
        h(Box, { flex: 1 }),
      ),
      h(Box, { height: 10 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 20);

    // Outer flex: 20 - 10(fixed) = 10 free, all to first child → height 10
    expect(layout.children[0].layout.height).toBe(10);
    // Inner flex: 10 space, 2 children with flex:1 → 5 each
    expect(layout.children[0].children[0].layout.height).toBe(5);
    expect(layout.children[0].children[1].layout.height).toBe(5);
  });

  it("flexShrink does not reduce below 0", () => {
    const el = h(Box, { height: 2, width: 10 },
      h(Box, { height: 10, flexShrink: 1 }),
      h(Box, { height: 10, flexShrink: 1 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 2);

    // Overflow: 20 - 2 = 18. Each shrinks by 9 → max(0, 10-9) = 1
    expect(layout.children[0].layout.height).toBeGreaterThanOrEqual(0);
    expect(layout.children[1].layout.height).toBeGreaterThanOrEqual(0);
  });
});
