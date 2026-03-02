import type { Color } from "../element/types.js";

// ---------------------------------------------------------------------------
// ANSI Escape Code Generation
// ---------------------------------------------------------------------------

const ESC = "\x1b";
const CSI = `${ESC}[`;

// --- Cursor ---

export function cursorTo(x: number, y: number): string {
  return `${CSI}${y + 1};${x + 1}H`;
}

export function cursorHide(): string {
  return `${CSI}?25l`;
}

export function cursorShow(): string {
  return `${CSI}?25h`;
}

export function cursorUp(n: number): string {
  return n > 0 ? `${CSI}${n}A` : "";
}

export function saveCursor(): string {
  return `${ESC}7`;
}

export function restoreCursor(): string {
  return `${ESC}8`;
}

// --- Screen ---

export function enterAltScreen(): string {
  return `${CSI}?1049h`;
}

export function exitAltScreen(): string {
  return `${CSI}?1049l`;
}

export function clearScreen(): string {
  return `${CSI}2J`;
}

export function clearLine(): string {
  return `${CSI}2K`;
}

export function eraseToEndOfLine(): string {
  return `${CSI}K`;
}

// --- Colors ---

export function fgColor(color: Color): string {
  if (typeof color === "number") {
    return `${CSI}38;5;${color}m`;
  }
  if (typeof color === "object" && "r" in color) {
    return `${CSI}38;2;${color.r};${color.g};${color.b}m`;
  }
  // Named or hex color
  const named = NAMED_COLORS[color as string];
  if (named !== undefined) {
    return `${CSI}${named}m`;
  }
  // Hex color
  if ((color as string).startsWith("#")) {
    const rgb = hexToRgb(color as string);
    if (rgb) {
      return `${CSI}38;2;${rgb.r};${rgb.g};${rgb.b}m`;
    }
  }
  return "";
}

export function bgColor(color: Color): string {
  if (typeof color === "number") {
    return `${CSI}48;5;${color}m`;
  }
  if (typeof color === "object" && "r" in color) {
    return `${CSI}48;2;${color.r};${color.g};${color.b}m`;
  }
  const named = NAMED_BG_COLORS[color as string];
  if (named !== undefined) {
    return `${CSI}${named}m`;
  }
  if ((color as string).startsWith("#")) {
    const rgb = hexToRgb(color as string);
    if (rgb) {
      return `${CSI}48;2;${rgb.r};${rgb.g};${rgb.b}m`;
    }
  }
  return "";
}

// --- Styles ---

export function bold(on: boolean): string {
  return on ? `${CSI}1m` : `${CSI}22m`;
}

export function dim(on: boolean): string {
  return on ? `${CSI}2m` : `${CSI}22m`;
}

export function italic(on: boolean): string {
  return on ? `${CSI}3m` : `${CSI}23m`;
}

export function underline(on: boolean): string {
  return on ? `${CSI}4m` : `${CSI}24m`;
}

export function strikethrough(on: boolean): string {
  return on ? `${CSI}9m` : `${CSI}29m`;
}

export function inverse(on: boolean): string {
  return on ? `${CSI}7m` : `${CSI}27m`;
}

export function resetStyle(): string {
  return `${CSI}0m`;
}

export function resetFg(): string {
  return `${CSI}39m`;
}

export function resetBg(): string {
  return `${CSI}49m`;
}

// --- Named colors ---

const NAMED_COLORS: Record<string, number> = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  gray: 90,
  grey: 90,
  brightRed: 91,
  brightGreen: 92,
  brightYellow: 93,
  brightBlue: 94,
  brightMagenta: 95,
  brightCyan: 96,
  brightWhite: 97,
};

const NAMED_BG_COLORS: Record<string, number> = {
  black: 40,
  red: 41,
  green: 42,
  yellow: 43,
  blue: 44,
  magenta: 45,
  cyan: 46,
  white: 47,
  gray: 100,
  grey: 100,
  brightRed: 101,
  brightGreen: 102,
  brightYellow: 103,
  brightBlue: 104,
  brightMagenta: 105,
  brightCyan: 106,
  brightWhite: 107,
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match6 = hex.match(/^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/);
  if (match6) {
    return {
      r: parseInt(match6[1], 16),
      g: parseInt(match6[2], 16),
      b: parseInt(match6[3], 16),
    };
  }
  const match3 = hex.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/);
  if (match3) {
    return {
      r: parseInt(match3[1] + match3[1], 16),
      g: parseInt(match3[2] + match3[2], 16),
      b: parseInt(match3[3] + match3[3], 16),
    };
  }
  return null;
}
