import type { TuileElement } from "../element/types.js";
import type { RenderNode } from "../element/reconciler.js";
import type { LayoutNode } from "../layout/types.js";
import type { Cell, CellStyle } from "./buffer.js";
import { mount, unmount, registerRoot, unregisterRoot, BOX, TEXT, PORTAL, TEXT_NODE } from "../element/reconciler.js";
import { signal } from "../reactive/signal.js";
import type { ReadSignal } from "../reactive/signal.js";
import { computeLayout, collectText } from "../layout/engine.js";
import { CellBuffer } from "./buffer.js";
import { diff, renderFull } from "./differ.js";
import { BORDER_CHARS, resolveEdges, borderSize } from "../layout/constraints.js";
import * as ansi from "./ansi.js";
import { stringWidth, sliceByWidth, wrapText, graphemeWidth } from "../text/width.js";
import { peekValue } from "../reactive/utils.js";
import { parseInput, createParseState } from "../input/keyboard.js";
import { parseSgrMouse, enableMouse } from "../input/mouse.js";
import { dispatchKeyEvent, dispatchMouseEvent, getInstanceKeyHandlers } from "../input/events.js";
import { createFocusManager } from "../focus/manager.js";
import type { FocusManager } from "../focus/manager.js";
import { createRenderInstance, setActiveInstance } from "../instance.js";
import { getScheduler } from "../animation/scheduler.js";

/** Module-level Intl.Segmenter for grapheme-aware clipping */
const clipSegmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// ---------------------------------------------------------------------------
// Process signal handler registry — singleton across all render() instances
// ---------------------------------------------------------------------------

const activeCleanups = new Set<() => void>();
let processHandlersInstalled = false;

function installProcessHandlers(): void {
  if (processHandlersInstalled) return;
  processHandlersInstalled = true;

  const runCleanups = () => {
    // Snapshot — cleanup may remove from the set
    for (const fn of [...activeCleanups]) fn();
  };

  process.on("exit", runCleanups);
  process.on("SIGINT", () => { runCleanups(); process.exit(130); });
  process.on("SIGTERM", () => { runCleanups(); process.exit(143); });
}

// ---------------------------------------------------------------------------
// Screen Manager — render loop & terminal management
// ---------------------------------------------------------------------------

export interface ScreenOptions {
  /** Target output stream (default: process.stdout) */
  stdout?: NodeJS.WriteStream;
  /** Target input stream (default: process.stdin) */
  stdin?: NodeJS.ReadStream;
  /** Use alternate screen buffer (default: true unless inline) */
  altScreen?: boolean;
  /** Maximum frames per second (default: 60) */
  fps?: number;
  /** Input handling (default: true = keyboard only, no mouse) */
  input?: boolean | { keyboard?: boolean; mouse?: boolean };
  /** Inline mode: render at current cursor position without alt screen */
  inline?: boolean | { height: number };
  /** Cursor visibility (default: false for fullscreen, true for inline) */
  cursor?: boolean;
  /** Called when a component error is caught (with or without an ErrorBoundary) */
  onError?: (error: Error) => void;
}

export interface RenderHandle {
  /** Unmount the app and restore the terminal */
  unmount(): void;
  /** Force a re-render */
  rerender(): void;
  /** Wait for the app to exit */
  waitUntilExit(): Promise<void>;
  /** Focus manager for this render instance */
  focus: FocusManager;
  /** Reactive terminal size */
  termSize: ReadSignal<{ width: number; height: number }>;
}

/**
 * Mount a Tuile element tree to the terminal.
 *
 * ```ts
 * import { render } from "tuile";
 * const handle = render(<App />);
 * ```
 */
export function render(element: TuileElement, options: ScreenOptions = {}): RenderHandle {
  const stdout = options.stdout ?? process.stdout;
  const stdin = options.stdin ?? process.stdin;
  const fps = options.fps ?? 60;
  const minFrameTime = 1000 / fps;

  // Inline mode config
  const inlineMode = options.inline !== undefined && options.inline !== false;
  const inlineHeight = typeof options.inline === "object" ? options.inline.height : 0;

  // Alt screen: default true unless inline mode
  const useAltScreen = options.altScreen ?? !inlineMode;

  // Cursor: default hidden for fullscreen, visible for inline
  const showCursor = options.cursor ?? inlineMode;

  let width = stdout.columns ?? 80;
  let height = inlineMode
    ? (inlineHeight > 0 ? inlineHeight : stdout.rows ?? 24)
    : (stdout.rows ?? 24);

  // Reactive terminal size signal
  const termSize = signal({ width, height: stdout.rows ?? 24 });

  // Create a render instance for isolated per-session state
  const instance = createRenderInstance();
  setActiveInstance(instance);

  // Mount the element tree
  let rootNode: ReturnType<typeof mount>;
  try {
    rootNode = mount(element);
  } catch (err) {
    setActiveInstance(null);
    if (options.onError) {
      options.onError(err instanceof Error ? err : new Error(String(err)));
    }
    throw err;
  }

  setActiveInstance(null);

  // Create buffers
  let prevBuffer = new CellBuffer(width, height);
  let nextBuffer = new CellBuffer(width, height);

  // Render scheduling
  let renderQueued = false;
  let renderTimer: ReturnType<typeof setTimeout> | null = null;
  let lastRenderTime = 0;
  let generation = 0;
  let exited = false;
  let exitResolve: (() => void) | null = null;
  const exitPromise = new Promise<void>((resolve) => {
    exitResolve = resolve;
  });

  // Track lines rendered in inline mode (for cleanup)
  let inlineRenderedLines = 0;

  // --- Input handling ---
  const inputConfig =
    options.input === undefined || options.input === true
      ? { keyboard: true, mouse: false }
      : options.input === false
        ? { keyboard: false, mouse: false }
        : { keyboard: options.input.keyboard ?? true, mouse: options.input.mouse ?? false };

  const focusManager = createFocusManager();
  let lastLayoutTree: LayoutNode | null = null;
  let cleanupKeyboard: (() => void) | null = null;
  let cleanupMouse: (() => void) | null = null;

  if (inputConfig.keyboard || inputConfig.mouse) {
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    stdin.resume();
    stdin.setEncoding("utf8");

    const keyParseState = createParseState();

    const handleKeyboardData = (raw: string): void => {
      const events = parseInput(raw, keyParseState);
      for (const event of events) {
        // Tab/Shift+Tab consumed by focus manager
        if (focusManager.handleKey(event)) continue;

        // Dispatch to focused element → ancestors → global handlers
        const handled = dispatchKeyEvent(event, focusManager.focused.peek(), getInstanceKeyHandlers(instance));

        // If unhandled by components, try group navigation/exit
        if (!handled) {
          focusManager.handleGroupKey(event);
        }
      }
    };

    const onStdinData = (data: string): void => {
      if (inputConfig.mouse) {
        let i = 0;
        let keyStart = 0;

        while (i < data.length) {
          if (
            data[i] === "\x1b" &&
            i + 2 < data.length &&
            data[i + 1] === "[" &&
            data[i + 2] === "<"
          ) {
            if (inputConfig.keyboard && i > keyStart) {
              handleKeyboardData(data.slice(keyStart, i));
            }
            const mouse = parseSgrMouse(data, i);
            if (mouse) {
              if (lastLayoutTree) {
                dispatchMouseEvent(mouse.event, lastLayoutTree);
              }
              i = mouse.end;
              keyStart = i;
              continue;
            }
          }
          i++;
        }

        if (inputConfig.keyboard && keyStart < data.length) {
          handleKeyboardData(data.slice(keyStart));
        }
      } else if (inputConfig.keyboard) {
        handleKeyboardData(data);
      }
    };

    stdin.on("data", onStdinData);

    cleanupKeyboard = () => {
      stdin.off("data", onStdinData);
      if (stdin.isTTY) {
        stdin.setRawMode(false);
      }
      stdin.pause();
    };

    if (inputConfig.mouse) {
      cleanupMouse = enableMouse(stdout);
    }
  }

  // Set up dirty callback for this render root
  registerRoot(rootNode, () => {
    scheduleRender();
  });

  // Terminal setup
  if (useAltScreen) {
    stdout.write(ansi.enterAltScreen());
  } else if (inlineMode) {
    stdout.write(ansi.saveCursor());
  }
  if (!showCursor) {
    stdout.write(ansi.cursorHide());
  }
  // Enable bracketed paste mode so pasted text arrives as a single event
  if (inputConfig.keyboard) {
    stdout.write("\x1b[?2004h");
  }

  // Handle terminal resize
  function onResize() {
    const newWidth = stdout.columns ?? 80;
    const newHeight = stdout.rows ?? 24;
    width = newWidth;
    if (!inlineMode || inlineHeight === 0) {
      height = newHeight;
    }
    termSize.value = { width: newWidth, height: newHeight };
    generation++;
    prevBuffer = new CellBuffer(width, height);
    nextBuffer = new CellBuffer(width, height);
    // Clear the terminal so stale content from the old layout doesn't persist
    // at positions where the new layout is blank
    stdout.write(ansi.clearScreen());
    scheduleRender();
  }
  stdout.on("resize", onResize);

  // Register with the singleton process handler registry
  installProcessHandlers();
  activeCleanups.add(cleanup);

  // Do initial render
  doRender();

  function scheduleRender(): void {
    if (exited || renderQueued) return;
    renderQueued = true;

    const now = Date.now();
    const elapsed = now - lastRenderTime;
    const delay = Math.max(0, minFrameTime - elapsed);

    if (delay === 0) {
      queueMicrotask(() => {
        if (renderQueued && !exited) {
          doRender();
        }
      });
    } else {
      renderTimer = setTimeout(() => {
        if (renderQueued && !exited) {
          doRender();
        }
      }, delay);
    }
  }

  function doRender(): void {
    renderQueued = false;
    lastRenderTime = Date.now();
    const renderGeneration = generation;

    // Clear the next buffer
    nextBuffer.clear();

    // Compute layout — loop until onLayout callbacks stabilise (max 3 extra passes)
    let layoutTree = computeLayout(rootNode, width, height);
    let layoutIterations = 0;
    let layoutConverged = true;
    while (fireOnLayout(layoutTree)) {
      if (layoutIterations >= 3) {
        layoutConverged = false;
        break;
      }
      layoutTree = computeLayout(rootNode, width, height);
      layoutIterations++;
    }
    if (!layoutConverged && process.env.NODE_ENV !== "production") {
      console.warn("tuile: onLayout did not converge after 4 passes — possible layout oscillation");
    }

    lastLayoutTree = layoutTree;
    focusManager.updateFocusableList(layoutTree);

    // Paint the layout tree into the buffer
    paintTree(layoutTree, nextBuffer);

    // Bail if a resize happened during layout/paint (buffers are stale)
    if (renderGeneration !== generation) {
      scheduleRender();
      return;
    }

    if (inlineMode) {
      // Inline: move cursor back to start of rendered area, then write
      if (inlineRenderedLines > 0) {
        stdout.write(ansi.cursorUp(inlineRenderedLines));
        stdout.write("\r");
      }
      const output = renderFull(nextBuffer);
      stdout.write(output);
      inlineRenderedLines = height;
    } else {
      // Fullscreen: diff and write
      const output = diff(prevBuffer, nextBuffer);
      if (output.length > 0) {
        stdout.write(output);
      }
    }

    // Swap buffers
    const tmp = prevBuffer;
    prevBuffer = nextBuffer;
    nextBuffer = tmp;
  }

  function cleanup(): void {
    if (exited) return;
    exited = true;

    // Deregister from the singleton process handler registry
    activeCleanups.delete(cleanup);

    if (renderTimer) {
      clearTimeout(renderTimer);
      renderTimer = null;
    }

    if (cleanupMouse) cleanupMouse();
    if (cleanupKeyboard) cleanupKeyboard();

    // Stop the global animation scheduler to prevent keeping the event loop alive
    try { getScheduler().stop(); } catch { /* scheduler may not exist */ }

    unregisterRoot(rootNode);
    unmount(rootNode);
    stdout.off("resize", onResize);

    // Restore terminal
    if (inputConfig.keyboard) {
      stdout.write("\x1b[?2004l"); // Disable bracketed paste mode
    }
    stdout.write(ansi.resetStyle());
    if (!showCursor) {
      stdout.write(ansi.cursorShow());
    }
    if (useAltScreen) {
      stdout.write(ansi.exitAltScreen());
    } else if (inlineMode) {
      // Move cursor below the rendered content
      stdout.write("\n");
    }

    exitResolve?.();
  }

  return {
    unmount: cleanup,
    rerender: () => {
      if (!exited) doRender();
    },
    waitUntilExit: () => exitPromise,
    focus: focusManager,
    termSize,
  };
}

// ---------------------------------------------------------------------------
// Paint — render layout nodes into the cell buffer
// ---------------------------------------------------------------------------

/** Clip rectangle for overflow: hidden */
interface ClipRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Portal entry collected during the first paint pass */
interface PortalEntry {
  node: LayoutNode;
  zIndex: number;
}

/** Intersect two clip rects, returning the overlapping region (or null if empty) */
function intersectClip(a: ClipRect, b: ClipRect): ClipRect | null {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

function paintTree(root: LayoutNode, buffer: CellBuffer): void {
  const portals: PortalEntry[] = [];
  const fullClip: ClipRect = { x: 0, y: 0, width: buffer.width, height: buffer.height };

  paintNode(root, buffer, fullClip, portals, 0, 0);

  // Second pass: paint portals (sorted by zIndex, stable)
  if (portals.length > 0) {
    portals.sort((a, b) => a.zIndex - b.zIndex);
    for (const portal of portals) {
      paintNode(portal.node, buffer, fullClip, null, 0, 0);
    }
  }
}

function paintNode(
  node: LayoutNode,
  buffer: CellBuffer,
  clip: ClipRect,
  portals: PortalEntry[] | null,
  offsetX: number,
  offsetY: number,
): void {
  const { renderNode, layout } = node;
  const paintX = layout.x + offsetX;
  const paintY = layout.y + offsetY;

  // Check if this is a portal — defer to second pass
  if (portals && renderNode.type === PORTAL) {
    portals.push({ node, zIndex: renderNode.props.zIndex ?? 0 });
    return;
  }

  if (renderNode.type === TEXT_NODE) {
    // Paint text content (clipped)
    const text = renderNode.text ?? "";
    if (text.length > 0) {
      const parentProps = node.parent?.renderNode.props ?? {};
      const style = propsToStyle(parentProps);
      writeClipped(buffer, paintX, paintY, text, style, clip);
    }
    return;
  }

  if (renderNode.type === TEXT) {
    const text = collectText(renderNode);
    const style = propsToStyle(renderNode.props);
    const wrap = renderNode.props.wrap ?? "word";

    if (layout.width <= 0) return;
    const lines = wrapText(text, layout.width, wrap);
    for (let i = 0; i < lines.length; i++) {
      writeClipped(buffer, paintX, paintY + i, lines[i], style, clip);
    }
    return;
  }

  if (renderNode.type === BOX) {
    // Paint background fill before border and children
    const bgColor = renderNode.props.bgColor;
    const bgStyle: CellStyle | undefined = bgColor != null ? { bg: bgColor } : undefined;
    if (bgStyle) {
      const fill = " ".repeat(layout.width);
      for (let row = 0; row < layout.height; row++) {
        writeClipped(buffer, paintX, paintY + row, fill, bgStyle, clip);
      }
    }

    const borderStyle = renderNode.props.border;
    if (borderStyle && borderStyle !== "none") {
      const borderColor = renderNode.props.borderColor;
      const borderCellStyle: CellStyle = { ...bgStyle };
      if (borderColor != null) borderCellStyle.fg = borderColor;
      paintBorder(buffer, paintX, paintY, layout.width, layout.height, borderStyle, borderCellStyle, clip);
    }

    const onPaint = renderNode.props.onPaint;
    if (typeof onPaint === "function") {
      onPaint({
        node,
        write: (x: number, y: number, text: string, style?: CellStyle) =>
          writeClipped(buffer, x, y, text, style ?? {}, clip),
        offsetX,
        offsetY,
      });
    }
  }

  // Determine clip for children
  let childClip = clip;
  const overflow = renderNode.props.overflow;
  if (overflow === "hidden" || overflow === "scroll") {
    const nodeRect: ClipRect = { x: paintX, y: paintY, width: layout.width, height: layout.height };
    const clipped = intersectClip(clip, nodeRect);
    if (!clipped) return; // entirely clipped
    childClip = clipped;
  }

  // Apply scroll offset for children
  let childOffsetX = offsetX;
  let childOffsetY = offsetY;
  if (renderNode.props.scrollOffsetX != null) {
    childOffsetX = offsetX - peekValue(renderNode.props.scrollOffsetX);
  }
  if (renderNode.props.scrollOffsetY != null) {
    childOffsetY = offsetY - peekValue(renderNode.props.scrollOffsetY);
  }

  // Sort children by zIndex for paint order (stable sort, tree order breaks ties)
  const children = getSortedChildren(node);

  for (const child of children) {
    paintNode(child, buffer, childClip, portals, childOffsetX, childOffsetY);
  }
}

/** Apply CellStyle to a Cell */
function applyStyle(cell: Cell, style: CellStyle): void {
  if (style.fg !== undefined) cell.fg = style.fg;
  if (style.bg !== undefined) cell.bg = style.bg;
  if (style.bold !== undefined) cell.bold = style.bold;
  if (style.dim !== undefined) cell.dim = style.dim;
  if (style.italic !== undefined) cell.italic = style.italic;
  if (style.underline !== undefined) cell.underline = style.underline;
  if (style.strikethrough !== undefined) cell.strikethrough = style.strikethrough;
  if (style.inverse !== undefined) cell.inverse = style.inverse;
}

/** Write text to buffer, respecting clip rect on both axes */
function writeClipped(
  buffer: CellBuffer,
  x: number,
  y: number,
  text: string,
  style: CellStyle,
  clip: ClipRect,
): void {
  if (y < clip.y || y >= clip.y + clip.height) return;

  const clipRight = clip.x + clip.width;
  if (x >= clipRight) return;

  let cx = x;
  for (const { segment } of clipSegmenter.segment(text)) {
    const w = graphemeWidth(segment);
    if (w === 0) continue;

    if (cx >= clipRight) break;

    // Entirely before the left clip edge — skip
    if (cx + w <= clip.x) {
      cx += w;
      continue;
    }

    // Wide character straddling the left clip edge
    if (cx < clip.x) {
      const spaceCell = buffer.get(clip.x, y);
      if (spaceCell) {
        spaceCell.char = " ";
        applyStyle(spaceCell, style);
      }
      cx += w;
      continue;
    }

    // Wide character straddling the right clip edge
    if (cx + w > clipRight) {
      const spaceCell = buffer.get(cx, y);
      if (spaceCell) {
        spaceCell.char = " ";
        applyStyle(spaceCell, style);
      }
      break;
    }

    // Fully within clip — write directly
    const cell = buffer.get(cx, y);
    if (cell) {
      // Clean up orphaned wide-character halves before writing
      if (cell.char === "" && cx > 0) {
        const prev = buffer.get(cx - 1, y);
        if (prev) prev.char = " ";
      }
      if (graphemeWidth(cell.char) === 2) {
        const next = buffer.get(cx + 1, y);
        if (next && next.char === "") next.char = " ";
      }
      if (w === 2) {
        const over = buffer.get(cx + 1, y);
        if (over && graphemeWidth(over.char) === 2) {
          const overNext = buffer.get(cx + 2, y);
          if (overNext && overNext.char === "") overNext.char = " ";
        }
      }

      cell.char = segment;
      applyStyle(cell, style);

      if (w === 2) {
        const cont = buffer.get(cx + 1, y);
        if (cont) {
          cont.char = "";
          applyStyle(cont, style);
        }
      }
    }
    cx += w;
  }
}

/** Return children sorted by zIndex (stable, tree-order for ties) */
function getSortedChildren(node: LayoutNode): LayoutNode[] {
  let hasZIndex = false;
  for (const child of node.children) {
    if (child.renderNode.props.zIndex !== undefined) {
      hasZIndex = true;
      break;
    }
  }
  if (!hasZIndex) return node.children;

  // Stable sort by zIndex
  const sorted = [...node.children];
  sorted.sort((a, b) => {
    const za = a.renderNode.props.zIndex ?? 0;
    const zb = b.renderNode.props.zIndex ?? 0;
    return za - zb;
  });
  return sorted;
}

function paintBorder(
  buffer: CellBuffer,
  x: number,
  y: number,
  width: number,
  height: number,
  style: string,
  cellStyle: CellStyle | undefined,
  clip: ClipRect,
): void {
  const chars = BORDER_CHARS[style];
  if (!chars || width < 2 || height < 2) return;
  const cs = cellStyle ?? {};

  // Corners
  writeClipped(buffer, x, y, chars.topLeft, cs, clip);
  writeClipped(buffer, x + width - 1, y, chars.topRight, cs, clip);
  writeClipped(buffer, x, y + height - 1, chars.bottomLeft, cs, clip);
  writeClipped(buffer, x + width - 1, y + height - 1, chars.bottomRight, cs, clip);

  // Horizontal edges
  const hBar = chars.horizontal.repeat(width - 2);
  writeClipped(buffer, x + 1, y, hBar, cs, clip);
  writeClipped(buffer, x + 1, y + height - 1, hBar, cs, clip);

  // Vertical edges
  for (let row = y + 1; row < y + height - 1; row++) {
    writeClipped(buffer, x, row, chars.vertical, cs, clip);
    writeClipped(buffer, x + width - 1, row, chars.vertical, cs, clip);
  }
}

/** Cache of last reported inner dimensions per RenderNode, for change detection. */
const layoutCache = new WeakMap<RenderNode, { width: number; height: number; contentWidth?: number; contentHeight?: number }>();

/** Walk the layout tree and fire onLayout callbacks. Returns true if any were called. */
function fireOnLayout(node: LayoutNode): boolean {
  let anyFired = false;
  const cb = node.renderNode.props.onLayout;
  if (typeof cb === "function") {
    const props = node.renderNode.props;
    const padding = resolveEdges(props, "padding");
    const border = borderSize(props.border);
    const w = node.layout.width - padding.left - padding.right - border.left - border.right;
    const h = node.layout.height - padding.top - padding.bottom - border.top - border.bottom;

    // Compute content dimensions for scroll containers
    let contentWidth: number | undefined;
    let contentHeight: number | undefined;
    if (props.overflow === "scroll") {
      const direction = props.direction ?? "vertical";
      const gap = props.gap ?? 0;
      let cw = 0;
      let ch = 0;
      let inFlowIndex = 0;
      for (const child of node.children) {
        if (child.renderNode.type === PORTAL) continue;
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

    const prev = layoutCache.get(node.renderNode);
    if (!prev || prev.width !== w || prev.height !== h || prev.contentWidth !== contentWidth || prev.contentHeight !== contentHeight) {
      layoutCache.set(node.renderNode, { width: w, height: h, contentWidth, contentHeight });
      cb({ width: w, height: h, contentWidth, contentHeight });
      anyFired = true;
    }
  }
  for (const child of node.children) {
    if (fireOnLayout(child)) anyFired = true;
  }
  return anyFired;
}

function propsToStyle(props: Record<string, any>): CellStyle {
  const style: CellStyle = {};
  if (props.color !== undefined) style.fg = props.color;
  if (props.bgColor !== undefined) style.bg = props.bgColor;
  if (props.bold) style.bold = true;
  if (props.dim) style.dim = true;
  if (props.italic) style.italic = true;
  if (props.underline) style.underline = true;
  if (props.strikethrough) style.strikethrough = true;
  if (props.inverse) style.inverse = true;
  return style;
}


