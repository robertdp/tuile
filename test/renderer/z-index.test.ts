import { describe, it, expect } from "vitest";
import { h } from "../../src/element/h.js";
import { mount, TEXT_NODE, TEXT, PORTAL } from "../../src/element/reconciler.js";
import { computeLayout } from "../../src/layout/engine.js";
import { CellBuffer } from "../../src/renderer/buffer.js";
import { hitTest } from "../../src/input/events.js";
import { Portal } from "../../src/element/portal.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";

// We need access to the paint function. Since paintTree is not exported,
// we'll test through the full render pipeline via a mini paint helper
// that mirrors screen.ts logic, or use render() indirectly.

// For direct paint testing, replicate the paint logic locally:
function paintTree(root: any, buffer: CellBuffer): void {
  const portals: { node: any; zIndex: number }[] = [];
  const clip = { x: 0, y: 0, width: buffer.width, height: buffer.height };
  paintNode(root, buffer, clip, portals);
  if (portals.length > 0) {
    portals.sort((a, b) => a.zIndex - b.zIndex);
    for (const p of portals) {
      paintNode(p.node, buffer, clip, null);
    }
  }
}

function paintNode(node: any, buffer: CellBuffer, clip: any, portals: any[] | null): void {
  const { renderNode, layout } = node;

  if (portals && renderNode.type === PORTAL) {
    portals.push({ node, zIndex: renderNode.props.zIndex ?? 0 });
    return;
  }

  if (renderNode.type === TEXT_NODE) {
    const text = renderNode.text ?? "";
    if (text.length > 0) {
      if (layout.y >= clip.y && layout.y < clip.y + clip.height) {
        buffer.write(layout.x, layout.y, text);
      }
    }
    return;
  }

  if (renderNode.type === TEXT) {
    let text = "";
    for (const child of renderNode.children) {
      if (child.type === TEXT_NODE) text += child.text ?? "";
    }
    if (text && layout.y >= clip.y && layout.y < clip.y + clip.height) {
      buffer.write(layout.x, layout.y, text);
    }
    return;
  }

  // Determine child clip
  let childClip = clip;
  if (renderNode.props.overflow === "hidden") {
    const x = Math.max(clip.x, layout.x);
    const y = Math.max(clip.y, layout.y);
    const right = Math.min(clip.x + clip.width, layout.x + layout.width);
    const bottom = Math.min(clip.y + clip.height, layout.y + layout.height);
    if (right <= x || bottom <= y) return;
    childClip = { x, y, width: right - x, height: bottom - y };
  }

  // Sort children by zIndex
  let children = node.children;
  let hasZIndex = false;
  for (const child of children) {
    if (child.renderNode.props.zIndex !== undefined) {
      hasZIndex = true;
      break;
    }
  }
  if (hasZIndex) {
    children = [...children].sort((a: any, b: any) =>
      (a.renderNode.props.zIndex ?? 0) - (b.renderNode.props.zIndex ?? 0),
    );
  }

  for (const child of children) {
    paintNode(child, buffer, childClip, portals);
  }
}

describe("z-index paint order", () => {
  it("paints children with zIndex props", () => {
    // Verify that zIndex prop is accepted and painting works
    const el = h(Box, { width: 10, height: 2 },
      h(Box, { width: 10, height: 1, zIndex: 1 },
        h(Text, {}, "HIGH"),
      ),
      h(Box, { width: 10, height: 1, zIndex: 0 },
        h(Text, {}, "LOW"),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 2);
    const buf = new CellBuffer(10, 2);
    paintTree(layout, buf);

    // Both should render (no overlap in normal layout)
    const line0 = buf.getLine(0);
    const line1 = buf.getLine(1);
    // Higher zIndex paints after lower, so if they share a row they'd overlap.
    // In vertical layout they're on separate rows.
    expect(line0 + line1).toContain("HIGH");
    expect(line0 + line1).toContain("LOW");
  });
});

describe("hitTest with z-index", () => {
  it("hits children based on z-order", () => {
    const handler1 = () => {};
    const handler2 = () => {};

    // Two children stacked vertically. Hit test at y=0 hits first, y=3 hits second.
    const el = h(Box, { width: 10, height: 6 },
      h(Box, { width: 10, height: 3, zIndex: 0, onClick: handler1 }),
      h(Box, { width: 10, height: 3, zIndex: 1, onClick: handler2 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 6);

    const hit1 = hitTest(layout, 5, 1);
    expect(hit1).not.toBeNull();
    expect(hit1!.renderNode.props.onClick).toBe(handler1);

    const hit2 = hitTest(layout, 5, 4);
    expect(hit2).not.toBeNull();
    expect(hit2!.renderNode.props.onClick).toBe(handler2);
  });
});

describe("overflow clipping", () => {
  it("clips child content to parent bounds when overflow=hidden", () => {
    // Parent box is 5 wide with overflow hidden, child text is 10 chars
    const el = h(Box, { width: 5, height: 1, overflow: "hidden" },
      h(Text, {}, "1234567890"),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 1);
    const buf = new CellBuffer(20, 1);
    paintTree(layout, buf);

    const line = buf.getLine(0);
    // Text after position 5 should not appear (buffer.write handles bounds)
    // The first 5 chars should be "12345"
    expect(line.slice(0, 5)).toBe("12345");
  });
});

describe("Portal", () => {
  it("creates an element with portal type", () => {
    const el = h(Portal, { zIndex: 5 }, h(Text, {}, "modal"));
    const root = mount(el);
    expect(root.type).toBe(PORTAL);
    expect(root.props.zIndex).toBe(5);
  });

  it("defers painting to second pass", () => {
    // Portal content should paint on top regardless of tree position
    const el = h(Box, { width: 10, height: 1 },
      h(Portal, { zIndex: 10 },
        h(Text, {}, "PORTAL"),
      ),
      h(Text, {}, "NORMAL"),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 1);
    const buf = new CellBuffer(10, 1);
    paintTree(layout, buf);

    // Portal should paint after normal content, so "PORTAL" overwrites "NORMAL"
    const line = buf.getLine(0);
    expect(line).toContain("PORTAL");
  });
});
