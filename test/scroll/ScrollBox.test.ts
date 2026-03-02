import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { h } from "../../src/element/h.js";
import { mount, TEXT_NODE, TEXT } from "../../src/element/reconciler.js";
import { computeLayout } from "../../src/layout/engine.js";
import { CellBuffer } from "../../src/renderer/buffer.js";
import { createScrollState, ScrollBox } from "../../src/scroll/container.js";
import { render } from "../../src/renderer/screen.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";

function key(k: string) {
  return { key: k, ctrl: false, alt: false, shift: false };
}

// ---------------------------------------------------------------------------
// Mini paint helper (mirrors screen.ts logic, with scroll offset support)
// ---------------------------------------------------------------------------

interface ClipRect { x: number; y: number; width: number; height: number }

function paintTree(root: any, buffer: CellBuffer): void {
  const clip: ClipRect = { x: 0, y: 0, width: buffer.width, height: buffer.height };
  paintNode(root, buffer, clip, 0);
}

function paintNode(node: any, buffer: CellBuffer, clip: ClipRect, offsetY: number): void {
  const { renderNode, layout } = node;
  const paintY = layout.y + offsetY;

  if (renderNode.type === TEXT_NODE) {
    const text = renderNode.text ?? "";
    if (text.length > 0 && paintY >= clip.y && paintY < clip.y + clip.height) {
      buffer.write(layout.x, paintY, text);
    }
    return;
  }

  if (renderNode.type === TEXT) {
    let text = "";
    for (const child of renderNode.children) {
      if (child.type === TEXT_NODE) text += child.text ?? "";
    }
    if (text && paintY >= clip.y && paintY < clip.y + clip.height) {
      buffer.write(layout.x, paintY, text);
    }
    return;
  }

  // Determine child clip
  let childClip = clip;
  const overflow = renderNode.props.overflow;
  if (overflow === "hidden" || overflow === "scroll") {
    const x = Math.max(clip.x, layout.x);
    const y = Math.max(clip.y, paintY);
    const right = Math.min(clip.x + clip.width, layout.x + layout.width);
    const bottom = Math.min(clip.y + clip.height, paintY + layout.height);
    if (right <= x || bottom <= y) return;
    childClip = { x, y, width: right - x, height: bottom - y };
  }

  // Apply scroll offset
  let childOffsetY = offsetY;
  if (renderNode.props.scrollOffsetY != null) {
    const sig = renderNode.props.scrollOffsetY;
    childOffsetY = offsetY - (typeof sig === "object" && sig !== null && "peek" in sig ? sig.peek() : sig);
  }

  for (const child of node.children) {
    paintNode(child, buffer, childClip, childOffsetY);
  }
}

// Fire onLayout callbacks (mirrors screen.ts fireOnLayout for scroll containers)
function fireOnLayoutCallbacks(node: any): void {
  const cb = node.renderNode.props.onLayout;
  if (typeof cb === "function") {
    const props = node.renderNode.props;
    const w = node.layout.width;
    const h = node.layout.height;

    let contentWidth: number | undefined;
    let contentHeight: number | undefined;
    if (props.overflow === "scroll") {
      const direction = props.direction ?? "vertical";
      const gap = props.gap ?? 0;
      let cw = 0;
      let ch = 0;
      let inFlowIndex = 0;
      for (const child of node.children) {
        if (direction === "vertical") {
          cw = Math.max(cw, child.layout.width);
          ch += child.layout.height;
          if (inFlowIndex > 0) ch += gap;
        } else {
          cw += child.layout.width;
          ch = Math.max(ch, child.layout.height);
          if (inFlowIndex > 0) cw += gap;
        }
        inFlowIndex++;
      }
      contentWidth = cw;
      contentHeight = ch;
    }

    cb({ width: w, height: h, contentWidth, contentHeight });
  }
  for (const child of node.children) {
    fireOnLayoutCallbacks(child);
  }
}

// ---------------------------------------------------------------------------
// Mock streams for render() tests
// ---------------------------------------------------------------------------

function createMockStdout() {
  const em = new EventEmitter() as any;
  em.columns = 80;
  em.rows = 24;
  em.write = vi.fn(() => true);
  return em as NodeJS.WriteStream;
}

function createMockStdin() {
  const em = new EventEmitter() as any;
  em.isTTY = true;
  em.setRawMode = vi.fn();
  em.resume = vi.fn();
  em.pause = vi.fn();
  em.setEncoding = vi.fn();
  return em as NodeJS.ReadStream;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ScrollBox layout", () => {
  it("children are unconstrained in scroll container", () => {
    const scroll = createScrollState();
    const el = h(ScrollBox, {
      height: 5,
      width: 20,
      scrollState: scroll,
    },
      h(Box, { height: 3 }),
      h(Box, { height: 3 }),
      h(Box, { height: 3 }),
      h(Box, { height: 3 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 24);

    // Viewport is 5 rows
    expect(layout.layout.height).toBe(5);

    // Children should have their natural heights (12 total > viewport 5)
    let totalChildHeight = 0;
    for (const child of layout.children) {
      totalChildHeight += child.layout.height;
    }
    expect(totalChildHeight).toBe(12);
  });

  it("flex is skipped inside scroll containers", () => {
    const scroll = createScrollState();
    const el = h(ScrollBox, {
      height: 10,
      width: 20,
      scrollState: scroll,
    },
      h(Box, { height: 3 }),
      h(Box, { height: 3, flexGrow: 1 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 24);

    // flexGrow should NOT distribute free space in scroll container
    expect(layout.children[0].layout.height).toBe(3);
    expect(layout.children[1].layout.height).toBe(3);
  });
});

describe("ScrollBox dimensions", () => {
  it("updateScrollDimensions sets content and viewport sizes", () => {
    const scroll = createScrollState();
    const el = h(ScrollBox, {
      height: 5,
      width: 20,
      scrollState: scroll,
    },
      h(Box, { height: 3 }),
      h(Box, { height: 3 }),
      h(Box, { height: 3 }),
    );

    const root = mount(el);
    const layout = computeLayout(root, 20, 24);
    fireOnLayoutCallbacks(layout);

    expect(scroll.contentSize).toBe(9);
    expect(scroll.viewportSize).toBe(5);
    expect(scroll.maxOffset()).toBe(4);
  });
});

describe("ScrollBox painting", () => {
  it("paints visible content at offset 0", () => {
    const scroll = createScrollState();
    const el = h(ScrollBox, {
      height: 3,
      width: 10,
      scrollState: scroll,
    },
      h(Text, {}, "Line1"),
      h(Text, {}, "Line2"),
      h(Text, {}, "Line3"),
      h(Text, {}, "Line4"),
      h(Text, {}, "Line5"),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 24);
    fireOnLayoutCallbacks(layout);

    const buf = new CellBuffer(10, 24);
    paintTree(layout, buf);

    // At offset 0, first 3 lines should be visible
    expect(buf.getLine(0).trim()).toBe("Line1");
    expect(buf.getLine(1).trim()).toBe("Line2");
    expect(buf.getLine(2).trim()).toBe("Line3");
    // Line4 should not be visible (outside viewport)
    expect(buf.getLine(3).trim()).toBe("");
  });

  it("scroll offset shifts visible content", () => {
    const scroll = createScrollState();
    const el = h(ScrollBox, {
      height: 3,
      width: 10,
      scrollState: scroll,
    },
      h(Text, {}, "Line1"),
      h(Text, {}, "Line2"),
      h(Text, {}, "Line3"),
      h(Text, {}, "Line4"),
      h(Text, {}, "Line5"),
    );

    const root = mount(el);
    const layout = computeLayout(root, 10, 24);
    fireOnLayoutCallbacks(layout);

    // Scroll down by 2
    scroll.scrollTo(2);

    const buf = new CellBuffer(10, 24);
    paintTree(layout, buf);

    // At offset 2, lines 3-5 should be visible
    expect(buf.getLine(0).trim()).toBe("Line3");
    expect(buf.getLine(1).trim()).toBe("Line4");
    expect(buf.getLine(2).trim()).toBe("Line5");
  });
});

describe("ScrollBox keyboard handling", () => {
  it("arrow keys scroll content", () => {
    const scroll = createScrollState();
    scroll.setDimensions(20, 5); // 20 content rows, 5 viewport

    const onKeyPress = vi.fn();
    const el = h(ScrollBox, {
      height: 5,
      width: 20,
      scrollState: scroll,
      onKeyPress,
      keyboardScroll: true,
    },
      h(Box, { height: 20 }),
    );

    const root = mount(el);
    // Get the onKeyPress handler from the mounted node
    const handler = root.props.onKeyPress;

    handler(key("down"));
    expect(scroll.offset.peek()).toBe(1);

    handler(key("down"));
    expect(scroll.offset.peek()).toBe(2);

    handler(key("up"));
    expect(scroll.offset.peek()).toBe(1);

    // Scroll keys are handled — custom handler not called for them
    expect(onKeyPress).toHaveBeenCalledTimes(0);

    // Unhandled keys are forwarded to custom handler
    handler(key("a"));
    expect(onKeyPress).toHaveBeenCalledTimes(1);
  });

  it("pageup/pagedown scroll by viewport height", () => {
    const scroll = createScrollState();
    scroll.setDimensions(20, 5);

    const el = h(ScrollBox, {
      height: 5,
      width: 20,
      scrollState: scroll,
    },
      h(Box, { height: 20 }),
    );

    const root = mount(el);
    const handler = root.props.onKeyPress;

    handler(key("pagedown"));
    expect(scroll.offset.peek()).toBe(5);

    handler(key("pageup"));
    expect(scroll.offset.peek()).toBe(0);
  });

  it("home/end scroll to extremes", () => {
    const scroll = createScrollState();
    scroll.setDimensions(20, 5);

    const el = h(ScrollBox, {
      height: 5,
      width: 20,
      scrollState: scroll,
    },
      h(Box, { height: 20 }),
    );

    const root = mount(el);
    const handler = root.props.onKeyPress;

    handler(key("end"));
    expect(scroll.offset.peek()).toBe(15); // maxOffset = 20 - 5

    handler(key("home"));
    expect(scroll.offset.peek()).toBe(0);
  });
});

describe("ScrollBox with render()", () => {
  it("integrates with the full render pipeline", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const scroll = createScrollState();

    const el = h(ScrollBox, {
      height: 5,
      width: 20,
      scrollState: scroll,
    },
      h(Text, {}, "Line1"),
      h(Text, {}, "Line2"),
      h(Text, {}, "Line3"),
      h(Text, {}, "Line4"),
      h(Text, {}, "Line5"),
      h(Text, {}, "Line6"),
      h(Text, {}, "Line7"),
      h(Text, {}, "Line8"),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // After render, scroll dimensions should be updated
    expect(scroll.contentSize).toBe(8);
    expect(scroll.viewportSize).toBe(5);

    handle.unmount();
  });
});
