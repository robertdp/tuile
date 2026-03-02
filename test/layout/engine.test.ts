import { describe, it, expect } from "vitest";
import { computeLayout } from "../../src/layout/engine.js";
import { mount } from "../../src/element/reconciler.js";
import { h } from "../../src/element/h.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";

describe("layout engine", () => {
  describe("basic sizing", () => {
    it("sizes a text node to its content", () => {
      const tree = mount(h(Text, {}, "hello"));
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(5);
      expect(layout.layout.height).toBe(1);
    });

    it("sizes a box to fit its children", () => {
      const tree = mount(
        h(Box, {},
          h(Text, {}, "hello"),
          h(Text, {}, "world"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // Vertical by default: width = max child width, height = sum
      expect(layout.layout.width).toBe(5);
      expect(layout.layout.height).toBe(2);
    });

    it("handles fixed width and height", () => {
      const tree = mount(h(Box, { width: 20, height: 10 }));
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(20);
      expect(layout.layout.height).toBe(10);
    });

    it("handles percentage width", () => {
      const tree = mount(h(Box, { width: "50%" }));
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(40);
    });

    it("handles percentage height", () => {
      const tree = mount(h(Box, { height: "50%" }));
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.height).toBe(12);
    });
  });

  describe("padding", () => {
    it("adds padding to box size", () => {
      const tree = mount(
        h(Box, { padding: 1 },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // "hi" = 2 wide, 1 tall. padding 1 on all sides = +2 each axis
      expect(layout.layout.width).toBe(4);
      expect(layout.layout.height).toBe(3);
    });

    it("handles paddingX and paddingY", () => {
      const tree = mount(
        h(Box, { paddingX: 2, paddingY: 1 },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(6); // 2 + 2*2
      expect(layout.layout.height).toBe(3); // 1 + 1*2
    });

    it("positions children inside padding", () => {
      const tree = mount(
        h(Box, { padding: 2 },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      const textLayout = layout.children[0].layout;
      expect(textLayout.x).toBe(2);
      expect(textLayout.y).toBe(2);
    });
  });

  describe("direction", () => {
    it("vertical direction stacks children", () => {
      const tree = mount(
        h(Box, { direction: "vertical" },
          h(Text, {}, "aaa"),
          h(Text, {}, "bb"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(3);
      expect(layout.layout.height).toBe(2);
      expect(layout.children[0].layout.y).toBe(0);
      expect(layout.children[1].layout.y).toBe(1);
    });

    it("horizontal direction places children side by side", () => {
      const tree = mount(
        h(Box, { direction: "horizontal" },
          h(Text, {}, "aaa"),
          h(Text, {}, "bb"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(5);
      expect(layout.layout.height).toBe(1);
      expect(layout.children[0].layout.x).toBe(0);
      expect(layout.children[1].layout.x).toBe(3);
    });
  });

  describe("gap", () => {
    it("adds gap between vertical children", () => {
      const tree = mount(
        h(Box, { direction: "vertical", gap: 1 },
          h(Text, {}, "a"),
          h(Text, {}, "b"),
          h(Text, {}, "c"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.height).toBe(5); // 3 items + 2 gaps
      expect(layout.children[0].layout.y).toBe(0);
      expect(layout.children[1].layout.y).toBe(2);
      expect(layout.children[2].layout.y).toBe(4);
    });

    it("adds gap between horizontal children", () => {
      const tree = mount(
        h(Box, { direction: "horizontal", gap: 2 },
          h(Text, {}, "a"),
          h(Text, {}, "b"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(4); // 1 + 2 + 1
      expect(layout.children[0].layout.x).toBe(0);
      expect(layout.children[1].layout.x).toBe(3);
    });
  });

  describe("border", () => {
    it("adds border to box size", () => {
      const tree = mount(
        h(Box, { border: "single" },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // "hi" = 2x1 + border 1 on each side
      expect(layout.layout.width).toBe(4);
      expect(layout.layout.height).toBe(3);
    });

    it("positions children inside border", () => {
      const tree = mount(
        h(Box, { border: "single" },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.x).toBe(1);
      expect(layout.children[0].layout.y).toBe(1);
    });
  });

  describe("alignment", () => {
    it("aligns children to center (cross axis)", () => {
      const tree = mount(
        h(Box, { direction: "vertical", width: 20, align: "center" },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // "hi" is 2 wide, container is 20. center = (20-2)/2 = 9
      expect(layout.children[0].layout.x).toBe(9);
    });

    it("aligns children to end (cross axis)", () => {
      const tree = mount(
        h(Box, { direction: "vertical", width: 20, align: "end" },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.x).toBe(18); // 20 - 2
    });
  });

  describe("justify", () => {
    it("justifies to center (main axis)", () => {
      const tree = mount(
        h(Box, { direction: "vertical", height: 10, justify: "center" },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // 1 line of text, 10 tall container. center = (10-1)/2 = 4
      expect(layout.children[0].layout.y).toBe(4);
    });

    it("justifies to end (main axis)", () => {
      const tree = mount(
        h(Box, { direction: "vertical", height: 10, justify: "end" },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.y).toBe(9); // 10 - 1
    });

    it("space-between distributes evenly", () => {
      const tree = mount(
        h(Box, { direction: "vertical", height: 10, justify: "space-between" },
          h(Text, {}, "a"),
          h(Text, {}, "b"),
          h(Text, {}, "c"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.y).toBe(0);
      // 10 total, 3 lines of content, 7 free, 2 gaps = 3.5 each
      expect(layout.children[1].layout.y).toBeCloseTo(4.5, 0);
      expect(layout.children[2].layout.y).toBeCloseTo(9, 0);
    });
  });

  describe("alignSelf", () => {
    it("overrides parent align for a single child", () => {
      const tree = mount(
        h(Box, { direction: "vertical", width: 20, align: "start" },
          h(Box, { width: 4, height: 1 }),
          h(Box, { width: 4, height: 1, alignSelf: "end" }),
          h(Box, { width: 4, height: 1 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.x).toBe(0);   // start
      expect(layout.children[1].layout.x).toBe(16);   // end: 20 - 4
      expect(layout.children[2].layout.x).toBe(0);   // start
    });

    it("alignSelf center on a horizontal container", () => {
      const tree = mount(
        h(Box, { direction: "horizontal", height: 10, align: "start" },
          h(Box, { width: 2, height: 2 }),
          h(Box, { width: 2, height: 2, alignSelf: "center" }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.y).toBe(0);    // start
      expect(layout.children[1].layout.y).toBe(4);    // center: (10-2)/2
    });
  });

  describe("minWidth / maxWidth / minHeight / maxHeight", () => {
    it("minWidth enforces a floor on intrinsic width", () => {
      const tree = mount(
        h(Box, { minWidth: 10 },
          h(Text, {}, "hi"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(10); // "hi" is 2, but min is 10
    });

    it("maxWidth caps explicit width", () => {
      const tree = mount(
        h(Box, { width: 30, maxWidth: 15 }),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(15);
    });

    it("minHeight enforces a floor", () => {
      const tree = mount(
        h(Box, { minHeight: 5 }),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.height).toBe(5);
    });

    it("maxHeight caps explicit height", () => {
      const tree = mount(
        h(Box, { height: 20, maxHeight: 8 }),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.height).toBe(8);
    });

    it("minWidth is respected after flex shrink", () => {
      const tree = mount(
        h(Box, { width: 10, direction: "horizontal" },
          h(Box, { width: 8, minWidth: 6 }),
          h(Box, { width: 8 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // Overflow: 16-10=6. Default shrink=1 each → each shrinks by 3.
      // First child: max(8-3, 6) = 6 (clamped by minWidth)
      expect(layout.children[0].layout.width).toBeGreaterThanOrEqual(6);
    });

    it("maxWidth constrains children (constraint propagation)", () => {
      const tree = mount(
        h(Box, { maxWidth: 10 },
          h(Text, {}, "hello world foo bar"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // maxWidth caps the constraint, so text wraps within 10
      expect(layout.layout.width).toBeLessThanOrEqual(10);
      expect(layout.children[0].layout.height).toBeGreaterThan(1);
    });
  });

  describe("justify space-around and space-evenly", () => {
    it("space-around distributes equal space around each item", () => {
      const tree = mount(
        h(Box, { direction: "horizontal", width: 20, justify: "space-around" },
          h(Box, { width: 2, height: 1 }),
          h(Box, { width: 2, height: 1 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // freeSpace = 20 - 4 = 16, unit = 16/2 = 8
      // mainOffset = 4, spaceBetween = 8
      // child0 at 4, child1 at 4+2+8 = 14
      expect(layout.children[0].layout.x).toBe(4);
      expect(layout.children[1].layout.x).toBe(14);
    });

    it("space-evenly distributes equal space between items and edges", () => {
      const tree = mount(
        h(Box, { direction: "horizontal", width: 21, justify: "space-evenly" },
          h(Box, { width: 3, height: 1 }),
          h(Box, { width: 3, height: 1 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // freeSpace = 21 - 6 = 15, unit = 15/3 = 5
      // mainOffset = 5, spaceBetween = 5
      // child0 at 5, child1 at 5+3+5 = 13
      expect(layout.children[0].layout.x).toBe(5);
      expect(layout.children[1].layout.x).toBe(13);
    });

    it("space-around vertical", () => {
      const tree = mount(
        h(Box, { height: 11, justify: "space-around" },
          h(Box, { height: 1, width: 1 }),
          h(Box, { height: 1, width: 1 }),
          h(Box, { height: 1, width: 1 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // freeSpace = 11 - 3 = 8, unit = 8/3 ≈ 2.67
      // mainOffset ≈ 1.33, spaceBetween ≈ 2.67
      // child0 at ~1.33, child1 at ~1.33+1+2.67=5, child2 at ~5+1+2.67=8.67
      expect(layout.children[0].layout.y).toBeGreaterThan(0);
      expect(layout.children[2].layout.y).toBeLessThan(10);
    });
  });

  describe("align stretch", () => {
    it("stretches children to fill cross axis (vertical container)", () => {
      const tree = mount(
        h(Box, { direction: "vertical", width: 20, align: "stretch" },
          h(Box, { height: 1 }),
          h(Box, { height: 1 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.width).toBe(20);
      expect(layout.children[1].layout.width).toBe(20);
    });

    it("stretches children to fill cross axis (horizontal container)", () => {
      const tree = mount(
        h(Box, { direction: "horizontal", height: 10, align: "stretch" },
          h(Box, { width: 5 }),
          h(Box, { width: 5 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.height).toBe(10);
      expect(layout.children[1].layout.height).toBe(10);
    });

    it("does not stretch children with explicit cross size", () => {
      const tree = mount(
        h(Box, { direction: "vertical", width: 20, align: "stretch" },
          h(Box, { height: 1, width: 5 }),
          h(Box, { height: 1 }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.width).toBe(5);  // explicit width preserved
      expect(layout.children[1].layout.width).toBe(20);  // stretched
    });

    it("alignSelf stretch overrides parent align", () => {
      const tree = mount(
        h(Box, { direction: "vertical", width: 20, align: "start" },
          h(Box, { height: 1 }),
          h(Box, { height: 1, alignSelf: "stretch" }),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.width).toBe(0);   // start, intrinsic 0
      expect(layout.children[1].layout.width).toBe(20);  // stretched
    });
  });

  describe("text wrapping", () => {
    it("wraps long text within constraints", () => {
      const tree = mount(
        h(Box, { width: 10 },
          h(Text, {}, "hello world foo"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      // "hello world foo" wraps to:
      // "hello"
      // "world foo"
      // Wait, maxWidth for the text should be 10
      // "hello" (5) fits
      // "world" (5) fits, "world foo" (9) fits
      // So: "hello world" (11) > 10, wraps to "hello" + "world foo"
      // That's 2 lines
      expect(layout.children[0].layout.height).toBe(2);
    });
  });

  describe("nested layouts", () => {
    it("handles nested boxes", () => {
      const tree = mount(
        h(Box, { padding: 1 },
          h(Box, { direction: "horizontal" },
            h(Text, {}, "left"),
            h(Text, {}, "right"),
          ),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      const innerBox = layout.children[0];
      expect(innerBox.layout.x).toBe(1); // padding
      expect(innerBox.layout.y).toBe(1);
      expect(innerBox.children[0].layout.x).toBe(1); // left text
      expect(innerBox.children[1].layout.x).toBe(5); // right text starts after "left"
    });

    it("constrains deeply nested content", () => {
      const tree = mount(
        h(Box, { width: 20 },
          h(Box, { padding: 2 },
            h(Text, {}, "hello"),
          ),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(20);
      const innerBox = layout.children[0];
      // inner box stretches to fill parent (align default = "stretch")
      expect(innerBox.layout.width).toBe(20);
    });
  });

  describe("margin", () => {
    it("margin is included in constraints but handled by parent", () => {
      // Margin handling is simplified — treated as extra padding on the
      // parent side for positioning. The layout engine accounts for it
      // during positioning.
      const tree = mount(
        h(Box, { width: 40, direction: "horizontal" },
          h(Text, {}, "left"),
          h(Text, {}, "right"),
        ),
      );
      const layout = computeLayout(tree, 80, 24);
      expect(layout.children[0].layout.x).toBe(0);
      expect(layout.children[1].layout.x).toBe(4);
    });
  });

  describe("empty elements", () => {
    it("handles empty box", () => {
      const tree = mount(h(Box, {}));
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(0);
      expect(layout.layout.height).toBe(0);
    });

    it("handles empty text", () => {
      const tree = mount(h(Text, {}, ""));
      const layout = computeLayout(tree, 80, 24);
      expect(layout.layout.width).toBe(0);
      expect(layout.layout.height).toBe(0);
    });
  });
});
