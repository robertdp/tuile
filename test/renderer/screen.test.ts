import { describe, it, expect, vi, beforeEach } from "vitest";
import { EventEmitter } from "events";
import { render } from "../../src/renderer/screen.js";
import { h } from "../../src/element/h.js";
import { BOX } from "../../src/element/reconciler.js";
import { Box } from "../../src/primitives/Box.js";
import { Text } from "../../src/primitives/Text.js";
import { signal, _getSubscriberCount } from "../../src/reactive/signal.js";

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

describe("render() input wiring", () => {
  let stdout: NodeJS.WriteStream;
  let stdin: ReturnType<typeof createMockStdin>;

  beforeEach(() => {
    stdout = createMockStdout();
    stdin = createMockStdin();
  });

  it("Tab cycles focus through focusable elements", () => {
    const onFocus1 = vi.fn();
    const onFocus2 = vi.fn();
    const onBlur1 = vi.fn();

    const el = h(
      BOX,
      {},
      h(Box, { tabIndex: 0, onFocus: onFocus1, onBlur: onBlur1 }),
      h(Box, { tabIndex: 1, onFocus: onFocus2 }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Initially no focus
    expect(handle.focus.focused.peek()).toBeNull();

    // First Tab -> focus first element
    stdin.emit("data", "\t");
    expect(onFocus1).toHaveBeenCalledTimes(1);
    expect(handle.focus.focused.peek()).not.toBeNull();

    // Second Tab -> focus second element (blurs first)
    stdin.emit("data", "\t");
    expect(onBlur1).toHaveBeenCalledTimes(1);
    expect(onFocus2).toHaveBeenCalledTimes(1);

    // Third Tab -> wraps back to first element
    stdin.emit("data", "\t");
    expect(onFocus1).toHaveBeenCalledTimes(2);

    handle.unmount();
  });

  it("dispatches key events to focused element", () => {
    const onKeyPress = vi.fn();

    const el = h(
      BOX,
      {},
      h(Box, { tabIndex: 0, onKeyPress }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Focus first element
    stdin.emit("data", "\t");

    // Send a key
    stdin.emit("data", "a");
    expect(onKeyPress).toHaveBeenCalledTimes(1);
    expect(onKeyPress.mock.calls[0][0].key).toBe("a");

    handle.unmount();
  });

  it("bubbles key events from focused element to parent", () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn();

    const el = h(
      BOX,
      { onKeyPress: parentHandler },
      h(Box, { tabIndex: 0, onKeyPress: childHandler }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Focus the child
    stdin.emit("data", "\t");

    // Send a key - should bubble from child to parent
    stdin.emit("data", "x");
    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).toHaveBeenCalledTimes(1);

    handle.unmount();
  });

  it("Handled return prevents bubbling", () => {
    const parentHandler = vi.fn();
    const childHandler = vi.fn(() => true);

    const el = h(
      BOX,
      { onKeyPress: parentHandler },
      h(Box, { tabIndex: 0, onKeyPress: childHandler }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Focus the child
    stdin.emit("data", "\t");

    // Send a key - child stops propagation
    stdin.emit("data", "y");
    expect(childHandler).toHaveBeenCalledTimes(1);
    expect(parentHandler).not.toHaveBeenCalled();

    handle.unmount();
  });

  it("Tab is consumed by focus system and not dispatched", () => {
    const onKeyPress = vi.fn();

    const el = h(
      BOX,
      {},
      h(Box, { tabIndex: 0, onKeyPress }),
      h(Box, { tabIndex: 1 }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // Tab should cycle focus, not dispatch
    stdin.emit("data", "\t");
    expect(onKeyPress).not.toHaveBeenCalled();

    handle.unmount();
  });

  it("input: false disables keyboard handling", () => {
    const onKeyPress = vi.fn();

    const el = h(Box, { tabIndex: 0, onKeyPress });
    const handle = render(el, { stdout, stdin, altScreen: false, input: false });

    // No raw mode setup
    expect(stdin.setRawMode).not.toHaveBeenCalled();
    expect(stdin.resume).not.toHaveBeenCalled();

    // Events should not be handled
    stdin.emit("data", "a");
    expect(onKeyPress).not.toHaveBeenCalled();

    handle.unmount();
  });

  it("sets up raw mode on TTY stdin", () => {
    const el = h(Box, {});
    const handle = render(el, { stdout, stdin, altScreen: false });

    expect(stdin.setRawMode).toHaveBeenCalledWith(true);
    expect(stdin.resume).toHaveBeenCalled();
    expect(stdin.setEncoding).toHaveBeenCalledWith("utf8");

    handle.unmount();

    // Cleanup restores stdin
    expect(stdin.setRawMode).toHaveBeenCalledWith(false);
    expect(stdin.pause).toHaveBeenCalled();
  });

  it("exposes focus manager on RenderHandle", () => {
    const el = h(Box, {});
    const handle = render(el, { stdout, stdin, altScreen: false });

    expect(handle.focus).toBeDefined();
    expect(handle.focus.focused).toBeDefined();
    expect(typeof handle.focus.focusNext).toBe("function");
    expect(typeof handle.focus.focusPrev).toBe("function");
    expect(typeof handle.focus.focus).toBe("function");
    expect(typeof handle.focus.blur).toBe("function");

    handle.unmount();
  });

  it("autoFocus focuses element on first render", () => {
    const onFocus = vi.fn();

    const el = h(
      BOX,
      {},
      h(Box, { tabIndex: 0 }),
      h(Box, { tabIndex: 1, autoFocus: true, onFocus }),
    );

    const handle = render(el, { stdout, stdin, altScreen: false });

    // autoFocus should have triggered
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(handle.focus.focused.peek()).not.toBeNull();

    handle.unmount();
  });

  it("dispatches mouse events when mouse input enabled", () => {
    const onClick = vi.fn();

    const el = h(Box, { width: 80, height: 24, onClick });

    const handle = render(el, {
      stdout,
      stdin,
      altScreen: false,
      input: { keyboard: true, mouse: true },
    });

    // SGR mouse press at (5, 3): ESC [ < 0 ; 6 ; 4 M  (1-based coordinates)
    stdin.emit("data", "\x1b[<0;6;4M");
    expect(onClick).toHaveBeenCalledTimes(1);

    handle.unmount();
  });

  it("mouse: true enables SGR mouse reporting on stdout", () => {
    const el = h(Box, {});

    const handle = render(el, {
      stdout,
      stdin,
      altScreen: false,
      input: { mouse: true },
    });

    const writes = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0],
    );
    // Should contain mouse enable sequences
    expect(writes).toContain("\x1b[?1000h");
    expect(writes).toContain("\x1b[?1006h");

    handle.unmount();

    // Should contain mouse disable sequences after unmount
    const allWrites = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0],
    );
    expect(allWrites).toContain("\x1b[?1000l");
    expect(allWrites).toContain("\x1b[?1006l");
  });
});

describe("render() termSize signal", () => {
  it("exposes reactive termSize on RenderHandle", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {});
    const handle = render(el, { stdout, stdin, altScreen: false });

    expect(handle.termSize.value).toEqual({ width: 80, height: 24 });

    handle.unmount();
  });

  it("updates termSize on resize", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {});
    const handle = render(el, { stdout, stdin, altScreen: false });

    // Simulate resize
    (stdout as any).columns = 120;
    (stdout as any).rows = 40;
    stdout.emit("resize");

    expect(handle.termSize.value).toEqual({ width: 120, height: 40 });

    handle.unmount();
  });
});

describe("render() inline mode", () => {
  it("does not enter alt screen in inline mode", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {}, h(Text, {}, "inline"));

    const handle = render(el, { stdout, stdin, inline: true });

    const writes = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0],
    );
    // Should NOT contain alt screen
    expect(writes).not.toContain("\x1b[?1049h");
    // Should contain save cursor
    expect(writes).toContain("\x1b7");

    handle.unmount();
  });

  it("cursor visible by default in inline mode", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {}, h(Text, {}, "inline"));

    const handle = render(el, { stdout, stdin, inline: true });

    const writes = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0],
    );
    // Should NOT hide cursor in inline mode
    expect(writes).not.toContain("\x1b[?25l");

    handle.unmount();
  });

  it("cursor hidden in fullscreen by default", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {});

    const handle = render(el, { stdout, stdin, altScreen: false });

    const writes = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0],
    );
    // Should hide cursor
    expect(writes).toContain("\x1b[?25l");

    handle.unmount();
  });

  it("respects cursor option override", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {});

    // Fullscreen with explicit cursor: true
    const handle = render(el, { stdout, stdin, altScreen: false, cursor: true });

    const writes = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.map(
      (c: any[]) => c[0],
    );
    // Should NOT hide cursor when explicitly set to true
    expect(writes).not.toContain("\x1b[?25l");

    handle.unmount();
  });

  it("uses fixed height in inline mode when specified", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {}, h(Text, {}, "line"));

    const handle = render(el, { stdout, stdin, inline: { height: 5 } });

    // termSize reflects full terminal, inline height is for rendering
    expect(handle.termSize.value.height).toBe(24);

    handle.unmount();
  });
});

describe("screen cleanup", () => {
  it("unmount removes resize listener from stdout", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {});

    const handle = render(el, { stdout, stdin, altScreen: false });

    const listenersBefore = stdout.listenerCount("resize");
    handle.unmount();
    const listenersAfter = stdout.listenerCount("resize");

    expect(listenersAfter).toBeLessThan(listenersBefore);
  });

  it("unmount restores stdin", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {});

    const handle = render(el, { stdout, stdin, altScreen: false });
    handle.unmount();

    expect(stdin.setRawMode).toHaveBeenCalledWith(false);
    expect(stdin.pause).toHaveBeenCalled();
  });

  it("unmount clears signal subscriptions from reactive props", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const color = signal("red");

    const el = h(Box, { bgColor: color }, h(Text, {}, "test"));
    const handle = render(el, { stdout, stdin, altScreen: false });

    expect(_getSubscriberCount(color)).toBeGreaterThan(0);

    handle.unmount();

    expect(_getSubscriberCount(color)).toBe(0);
  });

  it("unmount is idempotent", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const el = h(Box, {});

    const handle = render(el, { stdout, stdin, altScreen: false });

    handle.unmount();
    handle.unmount();
    handle.unmount();
  });

  it("signal changes after unmount do not trigger writes", () => {
    const stdout = createMockStdout();
    const stdin = createMockStdin();
    const text = signal("before");

    const el = h(Text, {}, text);
    const handle = render(el, { stdout, stdin, altScreen: false });

    handle.unmount();

    const writeCountAfterUnmount = (stdout.write as ReturnType<typeof vi.fn>).mock.calls.length;
    text.value = "after";

    expect((stdout.write as ReturnType<typeof vi.fn>).mock.calls.length).toBe(writeCountAfterUnmount);
  });
});
