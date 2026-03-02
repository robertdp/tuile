import { describe, it, expect, vi, beforeEach } from "vitest";
import { h } from "../../src/element/h.js";
import { mount, TEXT_NODE, TEXT, PORTAL } from "../../src/element/reconciler.js";
import { computeLayout } from "../../src/layout/engine.js";
import { CellBuffer } from "../../src/renderer/buffer.js";
import { hitTest } from "../../src/input/events.js";
import { Portal } from "../../src/element/portal.js";
import { createFocusManager } from "../../src/focus/manager.js";
import { render } from "../../src/renderer/screen.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";

// Replicate paint logic for testing (paintTree is not exported)
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
    if (text.length > 0 && layout.y >= clip.y && layout.y < clip.y + clip.height) {
      buffer.write(layout.x, layout.y, text);
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

  // Paint background fill
  const bgColor = renderNode.props.bgColor;
  if (bgColor != null) {
    const fill = " ".repeat(layout.width);
    for (let row = 0; row < layout.height; row++) {
      const py = layout.y + row;
      if (py >= clip.y && py < clip.y + clip.height) {
        buffer.write(layout.x, py, fill, { bg: bgColor });
      }
    }
  }

  let childClip = clip;
  if (renderNode.props.overflow === "hidden") {
    const x = Math.max(clip.x, layout.x);
    const y = Math.max(clip.y, layout.y);
    const right = Math.min(clip.x + clip.width, layout.x + layout.width);
    const bottom = Math.min(clip.y + clip.height, layout.y + layout.height);
    if (right <= x || bottom <= y) return;
    childClip = { x, y, width: right - x, height: bottom - y };
  }

  for (const child of node.children) {
    paintNode(child, buffer, childClip, portals);
  }
}

// --- Mock helpers for screen.ts tests ---

function createMockStdout() {
  const { EventEmitter } = require("events");
  const em = new EventEmitter() as any;
  em.columns = 40;
  em.rows = 12;
  em.write = vi.fn(() => true);
  return em as NodeJS.WriteStream;
}

function createMockStdin() {
  const { EventEmitter } = require("events");
  const em = new EventEmitter() as any;
  em.isTTY = true;
  em.setRawMode = vi.fn();
  em.resume = vi.fn();
  em.pause = vi.fn();
  em.setEncoding = vi.fn();
  return em as NodeJS.ReadStream;
}

// =========================================================================
// 1. Box background painting
// =========================================================================

describe("box bgColor", () => {
  it("fills box interior with background color", () => {
    const el = h(Box, { width: 5, height: 3, bgColor: "red" });
    const root = mount(el);
    const layout = computeLayout(root, 20, 10);
    const buf = new CellBuffer(20, 10);
    paintTree(layout, buf);

    // Every cell within the box area should have bg = "red"
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 5; x++) {
        const cell = buf.get(x, y);
        expect(cell?.bg).toBe("red");
      }
    }

    // Cell outside box should NOT have bg
    const outside = buf.get(6, 0);
    expect(outside?.bg).toBeNull();
  });

  it("children paint on top of background", () => {
    const el = h(Box, { width: 10, height: 1, bgColor: "blue" },
      h(Text, {}, "hi"),
    );
    const root = mount(el);
    const layout = computeLayout(root, 20, 10);
    const buf = new CellBuffer(20, 10);
    paintTree(layout, buf);

    // Text cells at (0,0) and (1,0) should have the text content
    expect(buf.get(0, 0)?.char).toBe("h");
    expect(buf.get(1, 0)?.char).toBe("i");

    // Cells after text but within box should have bg from the fill
    expect(buf.get(5, 0)?.bg).toBe("blue");
  });
});

// =========================================================================
// 2. Portal hit-testing
// =========================================================================

describe("portal hit-testing", () => {
  it("hits portal content at its painted position", () => {
    // Parent is a small box at (0,0,10,5).
    // Portal inside it should be positioned at (0,0) with root constraints.
    const portalHandler = vi.fn();

    const el = h(Box, { width: 10, height: 5 },
      h(Text, {}, "behind"),
      h(Portal, { zIndex: 10 },
        h(Box, { width: 20, height: 10, onClick: portalHandler }),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 10);

    // Hit at (15, 7) — outside the parent box bounds but within portal bounds
    const hit = hitTest(layout, 15, 7);
    expect(hit).not.toBeNull();
    expect(hit!.renderNode.props.onClick).toBe(portalHandler);
  });

  it("portal takes priority over normal content at same position", () => {
    const normalHandler = vi.fn();
    const portalHandler = vi.fn();

    const el = h(Box, { width: 20, height: 10, onClick: normalHandler },
      h(Portal, { zIndex: 10 },
        h(Box, { width: 20, height: 10, onClick: portalHandler }),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 10);

    // Click in the overlapping area — portal should win
    const hit = hitTest(layout, 5, 5);
    expect(hit).not.toBeNull();
    expect(hit!.renderNode.props.onClick).toBe(portalHandler);
  });

  it("falls through to normal content when click is outside portal", () => {
    const normalHandler = vi.fn();

    const el = h(Box, { width: 20, height: 10, onClick: normalHandler },
      h(Portal, { zIndex: 10 },
        h(Box, { width: 5, height: 5 }),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 10);

    // Click at (15, 8) — outside the 5x5 portal box but inside the 20x10 normal box
    const hit = hitTest(layout, 15, 8);
    expect(hit).not.toBeNull();
    expect(hit!.renderNode.props.onClick).toBe(normalHandler);
  });

  it("higher zIndex portal wins over lower zIndex portal", () => {
    const handlerLow = vi.fn();
    const handlerHigh = vi.fn();

    const el = h(Box, { width: 20, height: 10 },
      h(Portal, { zIndex: 1 },
        h(Box, { width: 20, height: 10, onClick: handlerLow }),
      ),
      h(Portal, { zIndex: 5 },
        h(Box, { width: 20, height: 10, onClick: handlerHigh }),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 10);

    const hit = hitTest(layout, 5, 5);
    expect(hit).not.toBeNull();
    expect(hit!.renderNode.props.onClick).toBe(handlerHigh);
  });
});

// =========================================================================
// 3. Focus trapping
// =========================================================================

describe("focus trapping", () => {
  it("constrains Tab navigation to focusTrap scope", () => {
    const el = h(Box, { width: 40, height: 12 },
      // Outside trap
      h(Box, { tabIndex: 0 }),
      // Inside trap
      h(Box, { focusTrap: true },
        h(Box, { tabIndex: 0 }),
        h(Box, { tabIndex: 0 }),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 40, 12);
    const fm = createFocusManager();
    fm.updateFocusableList(layout);

    // Focus should auto-capture into the trap
    const focused = fm.focused.peek();
    expect(focused).not.toBeNull();

    // Identify the two nodes inside the trap
    // The trap box has 2 focusable children
    const trapChildren = root.children[1].children;
    expect(trapChildren.length).toBe(2);

    // Focus should be on first trap element
    expect(fm.focused.peek()).toBe(trapChildren[0]);

    // Tab forward — should go to second trap element
    fm.focusNext();
    expect(fm.focused.peek()).toBe(trapChildren[1]);

    // Tab forward again — should wrap to first trap element (not escape)
    fm.focusNext();
    expect(fm.focused.peek()).toBe(trapChildren[0]);

    // Tab backward — should wrap to last trap element
    fm.focusPrev();
    expect(fm.focused.peek()).toBe(trapChildren[1]);
  });

  it("auto-focuses into trap when trap appears", () => {
    const el = h(Box, { width: 40, height: 12 },
      h(Box, { tabIndex: 0 }),
      h(Box, { focusTrap: true },
        h(Box, { tabIndex: 0 }),
      ),
    );

    const root = mount(el);
    const layout = computeLayout(root, 40, 12);
    const fm = createFocusManager();

    // Before any update, nothing is focused
    expect(fm.focused.peek()).toBeNull();

    // After update, trap should capture focus
    fm.updateFocusableList(layout);
    expect(fm.focused.peek()).not.toBeNull();
    // Should be the trap's child, not the outside element
    expect(fm.focused.peek()).toBe(root.children[1].children[0]);
  });

  it("navigates globally when no focus trap is active", () => {
    const el = h(Box, { width: 40, height: 12 },
      h(Box, { tabIndex: 0 }),
      h(Box, { tabIndex: 0 }),
      h(Box, { tabIndex: 0 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 40, 12);
    const fm = createFocusManager();
    fm.updateFocusableList(layout);

    // No trap — Tab should cycle through all 3 elements
    fm.focusNext();
    expect(fm.focused.peek()).toBe(root.children[0]);

    fm.focusNext();
    expect(fm.focused.peek()).toBe(root.children[1]);

    fm.focusNext();
    expect(fm.focused.peek()).toBe(root.children[2]);

    fm.focusNext();
    expect(fm.focused.peek()).toBe(root.children[0]); // wraps
  });

  it("traps focus with Tab key through render()", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();

    const onFocusTrap1 = vi.fn();
    const onFocusTrap2 = vi.fn();
    const onFocusOutside = vi.fn();

    const el = h(Box, {},
      h(Box, { tabIndex: 0, onFocus: onFocusOutside }),
      h(Box, { focusTrap: true },
        h(Box, { tabIndex: 0, onFocus: onFocusTrap1 }),
        h(Box, { tabIndex: 0, onFocus: onFocusTrap2 }),
      ),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Focus should auto-capture into trap on first render
    // The trap's first element should be focused
    expect(onFocusTrap1).toHaveBeenCalled();
    expect(onFocusOutside).not.toHaveBeenCalled();

    // Tab should cycle within trap
    onFocusTrap1.mockClear();
    onFocusTrap2.mockClear();

    stdin.emit("data", "\t"); // Tab -> second trap element
    expect(onFocusTrap2).toHaveBeenCalledTimes(1);

    stdin.emit("data", "\t"); // Tab -> wraps to first trap element
    expect(onFocusTrap1).toHaveBeenCalledTimes(1);

    // Outside element should never be focused
    expect(onFocusOutside).not.toHaveBeenCalled();

    handle.unmount();
  });
});
