// ---------------------------------------------------------------------------
// Keyboard Input — raw mode stdin parsing
//
// Parses raw bytes from stdin (in raw mode) into structured KeyEvents.
// Supports:
//   - CSI sequences (ESC [ params final): arrow keys, function keys,
//     insert/delete/home/end/pgup/pgdn. Modifier encoding follows
//     xterm convention: parameter 2 = 1 + bitmask where bit 0 = Shift,
//     bit 1 = Alt, bit 2 = Ctrl (e.g. modifier 6 = Ctrl+Shift).
//   - SS3 sequences (ESC O final): historical terminal compatibility
//     for arrow keys and F1-F4 on some emulators.
//   - Bracketed paste (ESC[200~ ... ESC[201~): captured as a single
//     "paste" event. If the end marker spans a chunk boundary,
//     ParseState buffers across data events.
//   - Alt+key (ESC followed by a character).
//   - Control characters (0x00-0x1F) mapped to named keys.
// ---------------------------------------------------------------------------

export interface KeyEvent {
  /** The key name (e.g. "a", "enter", "up", "f1") */
  key: string;
  /** Raw input bytes */
  raw: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
}

export type KeyHandler = (event: KeyEvent) => void;

/**
 * Start listening for keyboard input on stdin.
 * Returns a cleanup function.
 */
export function startKeyboardInput(
  stdin: NodeJS.ReadStream,
  handler: KeyHandler,
): () => void {
  if (stdin.isTTY) {
    stdin.setRawMode(true);
  }
  stdin.resume();
  stdin.setEncoding("utf8");

  const parseState = createParseState();

  function onData(data: string) {
    const events = parseInput(data, parseState);
    for (const event of events) {
      handler(event);
    }
  }

  stdin.on("data", onData);

  return () => {
    stdin.off("data", onData);
    if (stdin.isTTY) {
      stdin.setRawMode(false);
    }
    stdin.pause();
  };
}

/**
 * Mutable state for cross-chunk input buffering (e.g. bracketed paste
 * split across multiple data events). Create one per input session and
 * pass it to every `parseInput` call.
 */
export interface ParseState {
  /** Accumulated paste content when the end marker hasn't arrived yet */
  pasteBuffer: string | null;
}

/** Create a fresh parse state for a new input session. */
export function createParseState(): ParseState {
  return { pasteBuffer: null };
}

/**
 * Parse raw input bytes into key events.
 *
 * If `state` is provided, incomplete bracketed paste sequences are
 * buffered across calls. Without it, an incomplete paste is emitted
 * immediately (legacy behaviour).
 */
export function parseInput(data: string, state?: ParseState): KeyEvent[] {
  const events: KeyEvent[] = [];
  let i = 0;

  // If we're in the middle of a bracketed paste from a previous chunk,
  // look for the end marker in this chunk.
  if (state?.pasteBuffer != null) {
    const pasteEnd = data.indexOf("\x1b[201~");
    if (pasteEnd !== -1) {
      events.push({
        key: "paste",
        raw: state.pasteBuffer + data.slice(0, pasteEnd),
        ctrl: false,
        alt: false,
        shift: false,
      });
      state.pasteBuffer = null;
      i = pasteEnd + 6; // after ESC[201~
    } else {
      // Still no end marker — buffer the entire chunk
      state.pasteBuffer += data;
      return events;
    }
  }

  while (i < data.length) {
    // Bracketed paste: ESC[200~ ... ESC[201~
    if (data[i] === "\x1b" && data.startsWith("\x1b[200~", i)) {
      const pasteStart = i + 6; // after ESC[200~
      const pasteEnd = data.indexOf("\x1b[201~", pasteStart);
      if (pasteEnd !== -1) {
        const content = data.slice(pasteStart, pasteEnd);
        events.push({
          key: "paste",
          raw: content,
          ctrl: false,
          alt: false,
          shift: false,
        });
        i = pasteEnd + 6; // after ESC[201~
        continue;
      }
      // No end marker in this chunk
      if (state) {
        // Buffer for next chunk
        state.pasteBuffer = data.slice(pasteStart);
        return events;
      }
      // No state — emit immediately (legacy behaviour)
      events.push({
        key: "paste",
        raw: data.slice(pasteStart),
        ctrl: false,
        alt: false,
        shift: false,
      });
      i = data.length;
      continue;
    }

    // ESC sequence
    if (data[i] === "\x1b") {
      // CSI sequence: ESC [
      if (data[i + 1] === "[") {
        const seq = parseCsiSequence(data, i);
        if (seq) {
          events.push(seq.event);
          i = seq.end;
          continue;
        }
      }

      // SS3 sequence: ESC O (function keys on some terminals)
      if (data[i + 1] === "O") {
        const seq = parseSs3Sequence(data, i);
        if (seq) {
          events.push(seq.event);
          i = seq.end;
          continue;
        }
      }

      // Alt+key: ESC followed by a character
      if (i + 1 < data.length && data[i + 1] !== "\x1b") {
        const charCode = data.charCodeAt(i + 1);
        events.push({
          key: data[i + 1],
          raw: data.slice(i, i + 2),
          ctrl: false,
          alt: true,
          shift: charCode >= 65 && charCode <= 90,
        });
        i += 2;
        continue;
      }

      // Bare ESC
      events.push({
        key: "escape",
        raw: "\x1b",
        ctrl: false,
        alt: false,
        shift: false,
      });
      i++;
      continue;
    }

    // Control characters
    const code = data.charCodeAt(i);
    if (code < 32) {
      const event = parseControlChar(code, data[i]);
      events.push(event);
      i++;
      continue;
    }

    // DEL (backspace on some terminals)
    if (code === 127) {
      events.push({
        key: "backspace",
        raw: data[i],
        ctrl: false,
        alt: false,
        shift: false,
      });
      i++;
      continue;
    }

    // Regular character
    events.push({
      key: data[i],
      raw: data[i],
      ctrl: false,
      alt: false,
      shift: code >= 65 && code <= 90,
    });
    i++;
  }

  return events;
}

// ---------------------------------------------------------------------------
// CSI Sequence parser (ESC [ ...)
// ---------------------------------------------------------------------------

interface ParseResult {
  event: KeyEvent;
  end: number;
}

function parseCsiSequence(data: string, start: number): ParseResult | null {
  // Start after ESC [
  let i = start + 2;
  let params = "";

  // Collect parameter bytes (digits and semicolons)
  while (i < data.length && ((data[i] >= "0" && data[i] <= "9") || data[i] === ";")) {
    params += data[i];
    i++;
  }

  if (i >= data.length) return null;

  const final = data[i];
  const raw = data.slice(start, i + 1);
  const parts = params.split(";").map(Number);

  // Parse modifier: CSI 1;modifier key
  const modifier = parts.length >= 2 ? parts[1] : 0;
  const ctrl = !!(modifier && (modifier - 1) & 4);
  const alt = !!(modifier && (modifier - 1) & 2);
  const shift = !!(modifier && (modifier - 1) & 1);

  const key = CSI_KEYS[`${params}${final}`] ?? CSI_KEYS[final] ?? null;

  if (key) {
    // CSI Z is Shift+Tab (no modifier parameter in the sequence)
    const actualShift = shift || (final === "Z" && params === "");
    return {
      event: { key, raw, ctrl, alt, shift: actualShift },
      end: i + 1,
    };
  }

  // Unknown sequence — return as-is
  return {
    event: { key: `unknown:${raw}`, raw, ctrl: false, alt: false, shift: false },
    end: i + 1,
  };
}

function parseSs3Sequence(data: string, start: number): ParseResult | null {
  if (start + 2 >= data.length) return null;
  const final = data[start + 2];
  const raw = data.slice(start, start + 3);
  const key = SS3_KEYS[final];
  if (key) {
    return {
      event: { key, raw, ctrl: false, alt: false, shift: false },
      end: start + 3,
    };
  }
  return null;
}

function parseControlChar(code: number, raw: string): KeyEvent {
  const name = CONTROL_KEYS[code];
  if (name) {
    return { key: name, raw, ctrl: name !== "tab" && name !== "enter" && name !== "backspace", alt: false, shift: false };
  }
  // Ctrl+letter (a=1, b=2, ..., z=26)
  if (code >= 1 && code <= 26) {
    return { key: String.fromCharCode(code + 96), raw, ctrl: true, alt: false, shift: false };
  }
  return { key: `ctrl+${code}`, raw, ctrl: true, alt: false, shift: false };
}

// ---------------------------------------------------------------------------
// Key maps
// ---------------------------------------------------------------------------

const CONTROL_KEYS: Record<number, string> = {
  0: "space",      // Ctrl+Space on some terminals
  8: "backspace",  // Ctrl+H
  9: "tab",
  10: "enter",     // Ctrl+J / LF
  13: "enter",     // CR
  27: "escape",
};

const CSI_KEYS: Record<string, string> = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
  // With parameter prefix
  "2~": "insert",
  "3~": "delete",
  "5~": "pageup",
  "6~": "pagedown",
  "1~": "home",
  "4~": "end",
  "7~": "home",
  "8~": "end",
  // F-keys
  "11~": "f1",
  "12~": "f2",
  "13~": "f3",
  "14~": "f4",
  "15~": "f5",
  "17~": "f6",
  "18~": "f7",
  "19~": "f8",
  "20~": "f9",
  "21~": "f10",
  "23~": "f11",
  "24~": "f12",
  Z: "tab", // Shift+Tab
};

const SS3_KEYS: Record<string, string> = {
  A: "up",
  B: "down",
  C: "right",
  D: "left",
  H: "home",
  F: "end",
  P: "f1",
  Q: "f2",
  R: "f3",
  S: "f4",
};
