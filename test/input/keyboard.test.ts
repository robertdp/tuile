import { describe, it, expect } from "vitest";
import { parseInput } from "../../src/input/keyboard.js";

describe("parseInput", () => {
  it("parses regular characters", () => {
    const events = parseInput("a");
    expect(events).toHaveLength(1);
    expect(events[0].key).toBe("a");
    expect(events[0].ctrl).toBe(false);
    expect(events[0].alt).toBe(false);
  });

  it("parses uppercase as shift", () => {
    const events = parseInput("A");
    expect(events[0].key).toBe("A");
    expect(events[0].shift).toBe(true);
  });

  it("parses enter (CR)", () => {
    const events = parseInput("\r");
    expect(events[0].key).toBe("enter");
  });

  it("parses enter (LF)", () => {
    const events = parseInput("\n");
    expect(events[0].key).toBe("enter");
  });

  it("parses tab", () => {
    const events = parseInput("\t");
    expect(events[0].key).toBe("tab");
  });

  it("parses escape", () => {
    const events = parseInput("\x1b");
    expect(events[0].key).toBe("escape");
  });

  it("parses backspace (DEL)", () => {
    const events = parseInput("\x7f");
    expect(events[0].key).toBe("backspace");
  });

  it("parses Ctrl+C", () => {
    const events = parseInput("\x03");
    expect(events[0].key).toBe("c");
    expect(events[0].ctrl).toBe(true);
  });

  it("parses Ctrl+A", () => {
    const events = parseInput("\x01");
    expect(events[0].key).toBe("a");
    expect(events[0].ctrl).toBe(true);
  });

  it("parses arrow keys", () => {
    expect(parseInput("\x1b[A")[0].key).toBe("up");
    expect(parseInput("\x1b[B")[0].key).toBe("down");
    expect(parseInput("\x1b[C")[0].key).toBe("right");
    expect(parseInput("\x1b[D")[0].key).toBe("left");
  });

  it("parses home/end", () => {
    expect(parseInput("\x1b[H")[0].key).toBe("home");
    expect(parseInput("\x1b[F")[0].key).toBe("end");
  });

  it("parses delete", () => {
    expect(parseInput("\x1b[3~")[0].key).toBe("delete");
  });

  it("parses page up/down", () => {
    expect(parseInput("\x1b[5~")[0].key).toBe("pageup");
    expect(parseInput("\x1b[6~")[0].key).toBe("pagedown");
  });

  it("parses F-keys", () => {
    expect(parseInput("\x1b[11~")[0].key).toBe("f1");
    expect(parseInput("\x1b[15~")[0].key).toBe("f5");
    expect(parseInput("\x1b[24~")[0].key).toBe("f12");
  });

  it("parses F-keys via SS3", () => {
    expect(parseInput("\x1bOP")[0].key).toBe("f1");
    expect(parseInput("\x1bOQ")[0].key).toBe("f2");
  });

  it("parses Alt+key", () => {
    const events = parseInput("\x1ba");
    expect(events[0].key).toBe("a");
    expect(events[0].alt).toBe(true);
  });

  it("parses multiple characters", () => {
    const events = parseInput("abc");
    expect(events).toHaveLength(3);
    expect(events[0].key).toBe("a");
    expect(events[1].key).toBe("b");
    expect(events[2].key).toBe("c");
  });

  it("parses Shift+Tab (CSI Z)", () => {
    const events = parseInput("\x1b[Z");
    expect(events).toHaveLength(1);
    expect(events[0].key).toBe("tab");
    expect(events[0].shift).toBe(true);
  });

  it("parses modified arrow keys (e.g. Shift+Up)", () => {
    const events = parseInput("\x1b[1;2A");
    expect(events[0].key).toBe("up");
    expect(events[0].shift).toBe(true);
  });

  it("parses Ctrl+Shift+arrow", () => {
    // modifier 6 = shift(1) + ctrl(4) + 1 = 6
    const events = parseInput("\x1b[1;6A");
    expect(events[0].key).toBe("up");
    expect(events[0].ctrl).toBe(true);
    expect(events[0].shift).toBe(true);
  });
});
