import { describe, it, expect } from "vitest";
import { parseSgrMouse } from "../../src/input/mouse.js";

describe("parseSgrMouse", () => {
  it("parses left button press", () => {
    // ESC [ < 0 ; 10 ; 5 M
    const result = parseSgrMouse("\x1b[<0;10;5M", 0);
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe("press");
    expect(result!.event.button).toBe(0);
    expect(result!.event.x).toBe(9); // 1-based to 0-based
    expect(result!.event.y).toBe(4);
  });

  it("parses left button release", () => {
    const result = parseSgrMouse("\x1b[<0;10;5m", 0);
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe("release");
  });

  it("parses right button press", () => {
    const result = parseSgrMouse("\x1b[<2;1;1M", 0);
    expect(result).not.toBeNull();
    expect(result!.event.button).toBe(2);
  });

  it("parses scroll up", () => {
    // 64 = scroll flag, 0 = up
    const result = parseSgrMouse("\x1b[<64;5;5M", 0);
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe("scroll");
    expect(result!.event.scrollDirection).toBe("up");
  });

  it("parses scroll down", () => {
    // 65 = scroll flag + 1
    const result = parseSgrMouse("\x1b[<65;5;5M", 0);
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe("scroll");
    expect(result!.event.scrollDirection).toBe("down");
  });

  it("parses motion events", () => {
    // 32 = motion flag
    const result = parseSgrMouse("\x1b[<32;10;20M", 0);
    expect(result).not.toBeNull();
    expect(result!.event.type).toBe("move");
  });

  it("parses modifier keys", () => {
    // 4 = shift, 8 = alt, 16 = ctrl
    const result = parseSgrMouse("\x1b[<20;1;1M", 0); // 16 + 4 = ctrl + shift
    expect(result).not.toBeNull();
    expect(result!.event.ctrl).toBe(true);
    expect(result!.event.shift).toBe(true);
  });

  it("returns null for non-SGR data", () => {
    expect(parseSgrMouse("hello", 0)).toBeNull();
    expect(parseSgrMouse("\x1b[A", 0)).toBeNull();
  });

  it("handles large coordinates", () => {
    const result = parseSgrMouse("\x1b[<0;300;200M", 0);
    expect(result).not.toBeNull();
    expect(result!.event.x).toBe(299);
    expect(result!.event.y).toBe(199);
  });
});
