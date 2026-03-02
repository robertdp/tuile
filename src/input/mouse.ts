// ---------------------------------------------------------------------------
// Mouse Input — SGR extended mode parsing
//
// SGR format: ESC [ < Cb ; Cx ; Cy M (press) or m (release)
// where Cb encodes button + modifiers as a bitmask:
//   bits 0-1: button (0=left, 1=middle, 2=right, 3=release)
//   bit 2:    Shift
//   bit 3:    Alt/Meta
//   bit 4:    Ctrl
//   bit 5:    motion (drag event)
//   bit 6:    scroll (button bits 0-1: 0=up, 1=down)
//
// Cx/Cy are 1-based; converted to 0-based on output.
//
// SGR mode (1006) is used over legacy X10 mode because it supports
// coordinates beyond column 223 and distinguishes press from release.
// ---------------------------------------------------------------------------

export interface MouseEvent {
  /** 0=left, 1=middle, 2=right, 3=release */
  button: number;
  x: number;
  y: number;
  type: "press" | "release" | "move" | "scroll";
  /** Scroll direction (only for scroll events) */
  scrollDirection?: "up" | "down";
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export type MouseHandler = (event: MouseEvent) => void;

/**
 * Enable SGR mouse reporting on the terminal.
 * Returns ANSI sequences to enable and a function to disable.
 */
export function enableMouse(stdout: NodeJS.WriteStream): () => void {
  // Enable mouse tracking:
  // 1000 = button events
  // 1002 = button + motion events
  // 1003 = all events (including motion without buttons)
  // 1006 = SGR extended mode (supports coordinates > 223)
  stdout.write("\x1b[?1000h"); // button events
  stdout.write("\x1b[?1002h"); // motion events while button pressed
  stdout.write("\x1b[?1006h"); // SGR mode

  return () => {
    stdout.write("\x1b[?1006l");
    stdout.write("\x1b[?1002l");
    stdout.write("\x1b[?1000l");
  };
}

/**
 * Try to parse an SGR mouse event from raw input data.
 * SGR format: ESC [ < Cb ; Cx ; Cy M  (press) or ESC [ < Cb ; Cx ; Cy m (release)
 * Returns the event and how many characters were consumed, or null.
 */
export function parseSgrMouse(data: string, start: number): { event: MouseEvent; end: number } | null {
  // Must start with ESC [ <
  if (data[start] !== "\x1b" || data[start + 1] !== "[" || data[start + 2] !== "<") {
    return null;
  }

  let i = start + 3;
  let params = "";

  while (i < data.length && data[i] !== "M" && data[i] !== "m") {
    params += data[i];
    i++;
  }

  if (i >= data.length) return null;

  const isRelease = data[i] === "m";
  const parts = params.split(";").map(Number);
  if (parts.length !== 3) return null;

  const [cb, cx, cy] = parts;
  // cx, cy are 1-based in SGR mode
  const x = cx - 1;
  const y = cy - 1;

  const shift = !!(cb & 4);
  const alt = !!(cb & 8);
  const ctrl = !!(cb & 16);
  const motion = !!(cb & 32);

  const buttonBits = cb & 3;
  const isScroll = !!(cb & 64);

  let type: MouseEvent["type"];
  let button: number;
  let scrollDirection: "up" | "down" | undefined;

  if (isScroll) {
    type = "scroll";
    button = buttonBits;
    scrollDirection = buttonBits === 0 ? "up" : "down";
  } else if (isRelease) {
    type = "release";
    button = buttonBits;
  } else if (motion) {
    type = "move";
    button = buttonBits;
  } else {
    type = "press";
    button = buttonBits;
  }

  return {
    event: { button, x, y, type, scrollDirection, ctrl, alt, shift },
    end: i + 1,
  };
}
