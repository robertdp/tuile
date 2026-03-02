import { describe, it, expect } from "vitest";
import { Grid, GridItem } from "../../src/widgets/Grid.js";
import { mount, TEXT_NODE, TEXT, BOX } from "../../src/element/reconciler.js";
import { h } from "../../src/element/h.js";
import { computeLayout } from "../../src/layout/engine.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";
import { CellBuffer } from "../../src/renderer/buffer.js";
import { BORDER_CHARS } from "../../src/layout/constraints.js";
import type { LayoutNode } from "../../src/layout/types.js";

describe("Grid", () => {
  describe("element structure", () => {
    it("returns a box element", () => {
      const el = Grid({ columns: [10, 10], children: [] });
      expect(el.type).toBe(Box);
    });

    it("creates row boxes for each grid row", () => {
      const el = Grid({
        columns: [10, 10],
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "C")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "D")),
        ],
      });
      const node = mount(el);
      expect(node.type).toBe(BOX);
      // Outer box should have 2 children (rows)
      expect(node.children.length).toBe(2);
      // Each row should have 2 children (cells)
      expect(node.children[0].children.length).toBe(2);
      expect(node.children[1].children.length).toBe(2);
    });

    it("handles GridItem children detection", () => {
      const el = Grid({
        columns: [10],
        children: h(GridItem, { col: 1, row: 1 }, h(Text, {}, "Solo")),
      });
      const node = mount(el);
      expect(node.children.length).toBe(1);
      expect(node.children[0].children.length).toBe(1);
    });
  });

  describe("layout — borderless", () => {
    it("lays out fixed-width columns", () => {
      const el = Grid({
        columns: [10, 20],
        width: 30,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      // First cell should be 10 wide
      expect(row.children[0].layout.width).toBe(10);
      // Second cell should be 20 wide
      expect(row.children[1].layout.width).toBe(20);
    });

    it("distributes fr columns via flex", () => {
      const el = Grid({
        columns: ["1fr", "2fr"],
        width: 30,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      // 1fr : 2fr in 30 chars → 10 : 20 (total space distribution via flexBasis: 0)
      expect(row.children[0].layout.width).toBe(10);
      expect(row.children[1].layout.width).toBe(20);
    });

    it("equal fr columns have equal width regardless of content", () => {
      const el = Grid({
        columns: ["1fr", "1fr"],
        width: 20,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "Hello World")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      expect(row.children[0].layout.width).toBe(10);
      expect(row.children[1].layout.width).toBe(10);
    });

    it("fr columns align across rows with different content", () => {
      const el = Grid({
        columns: ["1fr", "1fr"],
        width: 20,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "Short")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "X")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "LongerText")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row1 = layoutRoot.children[0];
      const row2 = layoutRoot.children[1];
      expect(row1.children[0].layout.width).toBe(10);
      expect(row1.children[1].layout.width).toBe(10);
      expect(row2.children[0].layout.width).toBe(10);
      expect(row2.children[1].layout.width).toBe(10);
    });

    it("mixed fixed and fr columns", () => {
      const el = Grid({
        columns: [10, "1fr", "1fr"],
        width: 30,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "Fixed")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 3, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      expect(row.children[0].layout.width).toBe(10);
      expect(row.children[1].layout.width).toBe(10);
      expect(row.children[2].layout.width).toBe(10);
    });

    it("spanning cells with fr columns get combined width", () => {
      const el = Grid({
        columns: ["1fr", "1fr", "1fr"],
        gap: 1,
        width: 32, // 10 + 1 + 10 + 1 + 10
        children: [
          h(GridItem, { col: 1, row: 1, colSpan: 2 }, h(Text, {}, "Span")),
          h(GridItem, { col: 3, row: 1 }, h(Text, {}, "C")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "B")),
          h(GridItem, { col: 3, row: 2 }, h(Text, {}, "C")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row1 = layoutRoot.children[0];
      const row2 = layoutRoot.children[1];
      // Spanning cell: 10 + 1(gap) + 10 = 21
      expect(row1.children[0].layout.width).toBe(21);
      expect(row1.children[1].layout.width).toBe(10);
      // Normal row: each 10
      expect(row2.children[0].layout.width).toBe(10);
      expect(row2.children[1].layout.width).toBe(10);
      expect(row2.children[2].layout.width).toBe(10);
    });

    it("applies gap between cells", () => {
      const el = Grid({
        columns: [10, 10],
        gap: 2,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "C")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "D")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      // Row gap: row 2 should start 2 rows below row 1's bottom
      const row1 = layoutRoot.children[0];
      const row2 = layoutRoot.children[1];
      expect(row2.layout.y - (row1.layout.y + row1.layout.height)).toBe(2);
      // Column gap: cell 2 should start 2 cols after cell 1's right edge
      const cell1 = row1.children[0];
      const cell2 = row1.children[1];
      expect(cell2.layout.x - (cell1.layout.x + cell1.layout.width)).toBe(2);
    });

    it("applies separate columnGap and rowGap", () => {
      const el = Grid({
        columns: [10, 10],
        columnGap: 3,
        rowGap: 1,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "C")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "D")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row1 = layoutRoot.children[0];
      const row2 = layoutRoot.children[1];
      // Column gap = 3
      expect(row1.children[1].layout.x - (row1.children[0].layout.x + row1.children[0].layout.width)).toBe(3);
      // Row gap = 1
      expect(row2.layout.y - (row1.layout.y + row1.layout.height)).toBe(1);
    });
  });

  describe("layout — bordered", () => {
    it("applies border to outer box", () => {
      const el = Grid({
        columns: [10, 10],
        border: "single",
        width: 23, // 10 + 1 (sep) + 10 + 2 (border)
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      expect(node.props.border).toBe("single");
      expect(typeof node.props.onPaint).toBe("function");
    });

    it("uses gap=1 for bordered grids regardless of gap prop", () => {
      const el = Grid({
        columns: [10, 10],
        border: "single",
        gap: 5, // should be overridden to 1
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "C")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "D")),
        ],
      });
      const node = mount(el);
      // The outer box should have gap=1
      expect(node.props.gap).toBe(1);
      // Each row should have gap=1
      expect(node.children[0].props.gap).toBe(1);
    });

    it("computes correct layout with border and separator", () => {
      const el = Grid({
        columns: [10, 10],
        border: "single",
        width: 23, // border(1) + 10 + sep(1) + 10 + border(1)
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      // Grid outer: x=0, width=23
      expect(layoutRoot.layout.width).toBe(23);
      // Row inside border: inner width = 23-2 = 21, gap=1 between 2 cells
      const row = layoutRoot.children[0];
      // Cell 1: width=10
      expect(row.children[0].layout.width).toBe(10);
      // Cell 2: width=10
      expect(row.children[1].layout.width).toBe(10);
      // Gap between: cell2.x - (cell1.x + cell1.width) = 1
      expect(row.children[1].layout.x - (row.children[0].layout.x + row.children[0].layout.width)).toBe(1);
    });

    it("supports all border styles", () => {
      for (const style of ["single", "double", "round", "bold"] as const) {
        const el = Grid({
          columns: [10],
          border: style,
          children: [h(GridItem, { col: 1, row: 1 }, h(Text, {}, "X"))],
        });
        const node = mount(el);
        expect(node.props.border).toBe(style);
        expect(typeof node.props.onPaint).toBe("function");
      }
    });
  });

  describe("colSpan", () => {
    it("creates spanning cells with combined width", () => {
      const el = Grid({
        columns: [10, 10, 10],
        border: "single",
        width: 34, // 1 + 10 + 1 + 10 + 1 + 10 + 1
        children: [
          h(GridItem, { col: 1, row: 1, colSpan: 2 }, h(Text, {}, "Span")),
          h(GridItem, { col: 3, row: 1 }, h(Text, {}, "C")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "B")),
          h(GridItem, { col: 3, row: 2 }, h(Text, {}, "C")),
        ],
      });
      const node = mount(el);
      // Row 1: 2 cells (spanning + normal)
      expect(node.children[0].children.length).toBe(2);
      // Row 2: 3 cells
      expect(node.children[1].children.length).toBe(3);

      const layoutRoot = computeLayout(node, 80, 24);
      const row1 = layoutRoot.children[0];
      // Spanning cell should be 10 + 1(gap) + 10 = 21 wide
      expect(row1.children[0].layout.width).toBe(21);
    });

  });

  describe("row sizing", () => {
    it("applies fixed row heights", () => {
      const el = Grid({
        columns: [10],
        rows: [3, 5],
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      expect(layoutRoot.children[0].layout.height).toBe(3);
      expect(layoutRoot.children[1].layout.height).toBe(5);
    });

    it("applies fr row heights with flex", () => {
      const el = Grid({
        columns: [10],
        rows: ["1fr", "2fr"],
        height: 12,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      // 12 total, intrinsic=1 each, free=10, 1:2 ratio = 3+1r:6 extra → heights 5:7
      expect(layoutRoot.children[0].layout.height).toBe(5);
      expect(layoutRoot.children[1].layout.height).toBe(7);
    });
  });

  describe("cell alignment", () => {
    it("stretches cells to tallest in row by default", () => {
      const el = Grid({
        columns: [10, 10],
        width: 20,
        children: [
          // Row 1: first cell has 3 lines of text, second has 1
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "Line1\nLine2\nLine3")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "Short")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      // Both cells should have the same height as the tallest (3)
      expect(row.children[0].layout.height).toBe(3);
      expect(row.children[1].layout.height).toBe(3);
    });

    it("does not stretch when align is start", () => {
      const el = Grid({
        columns: [10, 10],
        width: 20,
        align: "start",
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "Line1\nLine2\nLine3")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "Short")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      expect(row.children[0].layout.height).toBe(3);
      expect(row.children[1].layout.height).toBe(1);
    });

    it("centers cells when align is center", () => {
      const el = Grid({
        columns: [10, 10],
        width: 20,
        align: "center",
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "Line1\nLine2\nLine3")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "Short")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      // Short cell: height=1, row height=3, offset = floor((3-1)/2) = 1
      expect(row.children[1].layout.height).toBe(1);
      expect(row.children[1].layout.y - row.layout.y).toBe(1);
    });

    it("aligns cells to end when align is end", () => {
      const el = Grid({
        columns: [10, 10],
        width: 20,
        align: "end",
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "Line1\nLine2\nLine3")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "Short")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      // Short cell: height=1, row height=3, offset = 3-1 = 2
      expect(row.children[1].layout.height).toBe(1);
      expect(row.children[1].layout.y - row.layout.y).toBe(2);
    });
  });

  describe("empty cells", () => {
    it("creates empty boxes for positions without GridItem", () => {
      const el = Grid({
        columns: [10, 10],
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          // col 2, row 1 has no GridItem
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "C")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "D")),
        ],
      });
      const node = mount(el);
      // Row 1 should still have 2 cells (second is empty)
      expect(node.children[0].children.length).toBe(2);
      // Row 2 has 2 cells
      expect(node.children[1].children.length).toBe(2);
    });
  });

  describe("spacing (separated borders)", () => {
    it("applies border to each cell, not the grid", () => {
      const el = Grid({
        columns: [10, 10],
        border: "single",
        spacing: 2,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      // Outer grid should NOT have border or onPaint (no merged border)
      expect(node.props.border).toBeUndefined();
      expect(node.props.onPaint).toBeUndefined();
      // Each cell should have its own border
      const row = node.children[0];
      expect(row.children[0].props.border).toBe("single");
      expect(row.children[1].props.border).toBe("single");
    });

    it("uses spacing-1 as gap between cells (spacing=1 means touching)", () => {
      const el = Grid({
        columns: [10, 10],
        border: "round",
        spacing: 3, // 2 empty chars between borders
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "C")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "D")),
        ],
      });
      const node = mount(el);
      // spacing=3 → gap=2 (2 empty chars between borders)
      expect(node.props.gap).toBe(2);
      expect(node.children[0].props.gap).toBe(2);
    });

    it("spacing=1 means borders are adjacent (gap=0)", () => {
      const el = Grid({
        columns: [10, 10],
        border: "single",
        spacing: 1,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      expect(node.props.gap).toBe(0);
      expect(node.children[0].props.gap).toBe(0);

      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      // Cell borders should be touching: no space between them
      expect(row.children[1].layout.x).toBe(row.children[0].layout.x + row.children[0].layout.width);
    });

    it("lays out spaced cells with correct positions", () => {
      const el = Grid({
        columns: [10, 10],
        border: "single",
        spacing: 2, // 1 empty char between borders
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const row = layoutRoot.children[0];
      const cell1 = row.children[0];
      const cell2 = row.children[1];
      // spacing=2 → gap=1 (1 empty char between borders)
      expect(cell2.layout.x - (cell1.layout.x + cell1.layout.width)).toBe(1);
    });

    it("does not use onPaint for spaced grids", () => {
      const el = Grid({
        columns: [10, 10],
        border: "single",
        spacing: 1,
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      expect(node.props.onPaint).toBeUndefined();
    });
  });

  describe("GridItem", () => {
    it("returns a box wrapping its children", () => {
      const el = GridItem({ col: 1, row: 1, children: h(Text, {}, "Hi") });
      expect(el.type).toBe(Box);
    });

    it("handles no children", () => {
      const el = GridItem({ col: 1, row: 1 });
      expect(el.type).toBe(Box);
    });
  });

  describe("border rendering via onPaint", () => {
    // Mini paint helper that draws borders and invokes onPaint callbacks
    function paintNode(node: LayoutNode, buffer: CellBuffer, offsetX: number, offsetY: number): void {
      const { renderNode, layout } = node;
      const paintX = layout.x + offsetX;
      const paintY = layout.y + offsetY;

      if (renderNode.type === TEXT_NODE) {
        const text = renderNode.text ?? "";
        if (text.length > 0) buffer.write(paintX, paintY, text);
        return;
      }
      if (renderNode.type === TEXT) {
        let text = "";
        for (const child of renderNode.children) {
          if (child.type === TEXT_NODE) text += child.text ?? "";
        }
        if (text) buffer.write(paintX, paintY, text);
        return;
      }

      // Draw box border
      const borderStyle = renderNode.props.border;
      if (borderStyle && borderStyle !== "none") {
        const chars = BORDER_CHARS[borderStyle];
        if (chars && layout.width >= 2 && layout.height >= 2) {
          buffer.write(paintX, paintY, chars.topLeft);
          buffer.write(paintX + layout.width - 1, paintY, chars.topRight);
          buffer.write(paintX, paintY + layout.height - 1, chars.bottomLeft);
          buffer.write(paintX + layout.width - 1, paintY + layout.height - 1, chars.bottomRight);
          buffer.write(paintX + 1, paintY, chars.horizontal.repeat(layout.width - 2));
          buffer.write(paintX + 1, paintY + layout.height - 1, chars.horizontal.repeat(layout.width - 2));
          for (let row = paintY + 1; row < paintY + layout.height - 1; row++) {
            buffer.write(paintX, row, chars.vertical);
            buffer.write(paintX + layout.width - 1, row, chars.vertical);
          }
        }
      }

      // Invoke onPaint (grid border drawing)
      const onPaint = renderNode.props.onPaint;
      if (typeof onPaint === "function") {
        onPaint({
          node,
          write: (x: number, y: number, text: string, style?: any) => buffer.write(x, y, text, style ?? {}),
          offsetX,
          offsetY,
        });
      }

      for (const child of node.children) {
        paintNode(child, buffer, offsetX, offsetY);
      }
    }

    it("draws merged borders with correct junctions", () => {
      const el = Grid({
        columns: [3, 3],
        border: "single",
        width: 9, // 1 + 3 + 1 + 3 + 1
        children: [
          h(GridItem, { col: 1, row: 1 }, h(Text, {}, "AB")),
          h(GridItem, { col: 2, row: 1 }, h(Text, {}, "CD")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "EF")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "GH")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const buf = new CellBuffer(80, 24);
      paintNode(layoutRoot, buf, 0, 0);

      // Expected:
      // ┌───┬───┐  (row 0: outer top border with teeDown at col separator)
      // │AB │CD │  (row 1: content with vertical separators)
      // ├───┼───┤  (row 2: horizontal separator with junctions)
      // │EF │GH │  (row 3: content with vertical separators)
      // └───┴───┘  (row 4: outer bottom border with teeUp at col separator)

      // Check top border junction
      expect(buf.getLine(0).slice(0, 9)).toBe("┌───┬───┐");
      // Check horizontal separator
      expect(buf.getLine(2).slice(0, 9)).toBe("├───┼───┤");
      // Check bottom border junction
      expect(buf.getLine(4).slice(0, 9)).toBe("└───┴───┘");
      // Check vertical separators in content rows
      const line1 = buf.getLine(1).slice(0, 9);
      expect(line1[4]).toBe("│");
      const line3 = buf.getLine(3).slice(0, 9);
      expect(line3[4]).toBe("│");
    });

    it("handles column spans in border rendering", () => {
      const el = Grid({
        columns: [3, 3],
        border: "single",
        width: 9,
        children: [
          h(GridItem, { col: 1, row: 1, colSpan: 2 }, h(Text, {}, "SPAN")),
          h(GridItem, { col: 1, row: 2 }, h(Text, {}, "A")),
          h(GridItem, { col: 2, row: 2 }, h(Text, {}, "B")),
        ],
      });
      const node = mount(el);
      const layoutRoot = computeLayout(node, 80, 24);
      const buf = new CellBuffer(80, 24);
      paintNode(layoutRoot, buf, 0, 0);

      // Top border: no teeDown because first row spans across
      expect(buf.getLine(0).slice(0, 9)).toBe("┌───────┐");
      // Separator: teeDown at column boundary (no vert line above due to span)
      expect(buf.getLine(2).slice(0, 9)).toBe("├───┬───┤");
      // Bottom border: teeUp at column boundary
      expect(buf.getLine(4).slice(0, 9)).toBe("└───┴───┘");
    });
  });
});
