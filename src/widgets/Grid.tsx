/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Grid Widget — CSS Grid-like layout with merged borders
// ---------------------------------------------------------------------------

import { h } from "../element/h.js";
import type { TuileElement, TuileChild, SizeValue, BorderStyle, Color, Align, MaybeSignal, PaintContext } from "../element/types.js";
import type { CellStyle } from "../renderer/buffer.js";
import { Box } from "../primitives/Box.js";
import { BORDER_CHARS, GRID_JUNCTION_CHARS } from "../layout/constraints.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Grid track size: fixed character count or fractional unit */
export type GridTrackSize = number | `${number}fr`;

export interface GridProps {
  /** Column track definitions */
  columns: GridTrackSize[];
  /** Row track definitions (optional; rows auto-size by default) */
  rows?: GridTrackSize[];
  /** Border style for grid lines — borders are shared/merged between cells */
  border?: BorderStyle;
  /** Border line color */
  borderColor?: Color;
  /** Space between cells when borderless (default: 0) */
  gap?: number;
  /** Column gap override (borderless only) */
  columnGap?: number;
  /** Row gap override (borderless only) */
  rowGap?: number;
  /** Space between bordered cells — each cell gets its own border with this
   *  much empty space between them (default: 0, meaning shared/merged borders) */
  spacing?: number;
  /** Grid width */
  width?: SizeValue;
  /** Grid height */
  height?: SizeValue;
  /** Background color */
  bgColor?: Color;
  /** Cross-axis alignment of cells within rows (default: "stretch") */
  align?: Align;
  /** Flex grow factor — allows the grid to expand within a flex container */
  flexGrow?: MaybeSignal<number>;
  /** Flex shrink factor */
  flexShrink?: MaybeSignal<number>;
  /** Flex basis */
  flexBasis?: MaybeSignal<number>;
  /** GridItem children */
  children?: any;
}

export interface GridItemProps {
  /** Column position (1-indexed) */
  col: number;
  /** Row position (1-indexed) */
  row: number;
  /** Number of columns to span (default: 1) */
  colSpan?: number;
  /** Cell content */
  children?: any;
}

/** Grid border metadata for the paint callback */
interface GridBorderInfo {
  style: string;
  color?: Color;
  numCols: number;
  numRows: number;
  /** Cell placements for span-aware junction rendering */
  cells: { col: number; row: number; colSpan: number }[];
}

/** Column placement for a single cell in the element tree */
interface CellPlacement {
  col: number;
  colSpan: number;
}

// ---------------------------------------------------------------------------
// GridItem — placement wrapper
// ---------------------------------------------------------------------------

/**
 * Placement wrapper for Grid children.
 *
 * ```tsx
 * <Grid columns={[10, "1fr", "1fr"]} border="single">
 *   <GridItem col={1} row={1}><Text>A</Text></GridItem>
 *   <GridItem col={2} row={1} colSpan={2}><Text>B (spans 2 cols)</Text></GridItem>
 *   <GridItem col={1} row={2}><Text>C</Text></GridItem>
 *   <GridItem col={2} row={2}><Text>D</Text></GridItem>
 *   <GridItem col={3} row={2}><Text>E</Text></GridItem>
 * </Grid>
 * ```
 */
export function GridItem(props: GridItemProps): TuileElement {
  const children = props.children == null ? []
    : Array.isArray(props.children) ? props.children : [props.children];
  return <Box>{children}</Box>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseFr(size: GridTrackSize): number | null {
  if (typeof size === "string" && size.endsWith("fr")) {
    return parseFloat(size);
  }
  return null;
}

interface CellInfo {
  col: number;    // 0-indexed
  row: number;    // 0-indexed
  colSpan: number;
  content: TuileChild[];
}

function parseGridItems(rawChildren: any): CellInfo[] {
  const childArray = rawChildren == null ? []
    : Array.isArray(rawChildren) ? rawChildren : [rawChildren];

  const cells: CellInfo[] = [];
  for (const child of childArray) {
    if (child && typeof child === "object" && "type" in child && child.type === GridItem) {
      const p = child.props || {};
      cells.push({
        col: (p.col ?? 1) - 1,
        row: (p.row ?? 1) - 1,
        colSpan: p.colSpan ?? 1,
        content: child.children ?? [],
      });
    }
  }
  return cells;
}

/** Check if position (r, c) is covered by a span from another cell */
function isCoveredBySpan(cells: CellInfo[], row: number, col: number): boolean {
  for (const cell of cells) {
    if (row === cell.row &&
        col >= cell.col && col < cell.col + cell.colSpan &&
        col !== cell.col) {
      return true;
    }
  }
  return false;
}

/** Get the cell whose origin is at (row, col) */
function getCellAt(cells: CellInfo[], row: number, col: number): CellInfo | null {
  for (const cell of cells) {
    if (cell.row === row && cell.col === col) return cell;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Grid border painting (via onPaint callback)
// ---------------------------------------------------------------------------

/**
 * Paint internal grid lines via the onPaint callback (after the outer
 * border is already drawn by the normal Box border painting).
 *
 * Draws horizontal separators between rows, vertical separators between
 * columns, and proper junction characters (T-pieces, crosses) where
 * lines meet the outer border or each other.
 *
 * Span-aware: when a cell spans multiple columns, the vertical
 * separators it covers are suppressed and junctions degrade gracefully
 * (cross → T-piece → horizontal line). Column positions are derived
 * from actual cell layout coordinates rather than computed from track
 * definitions, so they stay correct after flex distribution.
 */
function paintGridBorders(
  ctx: PaintContext,
  borderInfo: GridBorderInfo,
  cellPlacements: CellPlacement[][],
): void {
  const { node, write, offsetX, offsetY } = ctx;
  const { layout } = node;

  const chars = BORDER_CHARS[borderInfo.style];
  const junctions = GRID_JUNCTION_CHARS[borderInfo.style];
  if (!chars || !junctions) return;

  const cs: CellStyle = {};
  if (borderInfo.color) cs.fg = borderInfo.color;

  const rows = node.children;
  if (rows.length === 0) return;

  const gridX = layout.x + offsetX;
  const gridY = layout.y + offsetY;
  const gridRight = gridX + layout.width - 1;
  const gridBottom = gridY + layout.height - 1;

  // --- Collect column separator x-positions from cell layouts ---
  const colSepX: (number | undefined)[] = new Array(borderInfo.numCols - 1);

  // Pass 1: collect from non-spanning cells (span === 1) for canonical widths
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let ci = 0; ci < row.children.length; ci++) {
      const cell = row.children[ci];
      const placement = cellPlacements[r]?.[ci];
      if (!placement || placement.colSpan !== 1) continue;
      if (placement.col < borderInfo.numCols - 1 && colSepX[placement.col] == null) {
        colSepX[placement.col] = cell.layout.x + cell.layout.width + offsetX;
      }
    }
  }

  // Pass 2: fill remaining from spanning cells as fallback
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let ci = 0; ci < row.children.length; ci++) {
      const cell = row.children[ci];
      const placement = cellPlacements[r]?.[ci];
      if (!placement) continue;
      const endCol = placement.col + placement.colSpan - 1;
      if (endCol < borderInfo.numCols - 1 && colSepX[endCol] == null) {
        colSepX[endCol] = cell.layout.x + cell.layout.width + offsetX;
      }
    }
  }

  // --- Collect row separator y-positions ---
  const rowSepY: number[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    rowSepY.push(rows[i].layout.y + rows[i].layout.height + offsetY);
  }

  // --- Build span-awareness tables ---
  const hasVertSep: boolean[][] = [];
  for (let r = 0; r < borderInfo.numRows; r++) {
    const rowSeps: boolean[] = [];
    for (let c = 0; c < borderInfo.numCols - 1; c++) {
      let isSep = true;
      for (const cell of borderInfo.cells) {
        if (r === cell.row && c >= cell.col && c + 1 < cell.col + cell.colSpan) {
          isSep = false;
          break;
        }
      }
      rowSeps.push(isSep);
    }
    hasVertSep.push(rowSeps);
  }

  // --- Compute column widths from separator positions ---
  const colStart: number[] = new Array(borderInfo.numCols);
  const colWidth: number[] = new Array(borderInfo.numCols);

  colStart[0] = gridX + 1;
  for (let c = 0; c < borderInfo.numCols; c++) {
    if (c > 0) {
      colStart[c] = (colSepX[c - 1] ?? colStart[c - 1]) + 1;
    }
    if (c < borderInfo.numCols - 1 && colSepX[c] != null) {
      colWidth[c] = colSepX[c]! - colStart[c];
    } else {
      colWidth[c] = gridRight - colStart[c];
    }
  }

  // --- Draw horizontal separator lines (between rows) ---
  for (let rs = 0; rs < rowSepY.length; rs++) {
    const y = rowSepY[rs];

    write(gridX, y, junctions.teeRight, cs);

    for (let c = 0; c < borderInfo.numCols; c++) {
      const w = colWidth[c];
      if (w > 0) {
        write(colStart[c], y, chars.horizontal.repeat(w), cs);
      }

      if (c < borderInfo.numCols - 1 && colSepX[c] != null) {
        const above = hasVertSep[rs]?.[c] ?? true;
        const below = hasVertSep[rs + 1]?.[c] ?? true;

        let junction: string;
        if (above && below) {
          junction = junctions.cross;
        } else if (above) {
          junction = junctions.teeUp;
        } else if (below) {
          junction = junctions.teeDown;
        } else {
          junction = chars.horizontal;
        }
        write(colSepX[c]!, y, junction, cs);
      }
    }

    write(gridRight, y, junctions.teeLeft, cs);
  }

  // --- Draw vertical separator lines (between columns, within each row) ---
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    const rowTop = row.layout.y + offsetY;
    const rowBottom = rowTop + row.layout.height;

    for (let c = 0; c < borderInfo.numCols - 1; c++) {
      if (!hasVertSep[r][c]) continue;
      if (colSepX[c] == null) continue;

      const x = colSepX[c]!;
      for (let y = rowTop; y < rowBottom; y++) {
        write(x, y, chars.vertical, cs);
      }
    }
  }

  // --- Fix outer border junctions ---
  for (let c = 0; c < borderInfo.numCols - 1; c++) {
    if (colSepX[c] != null && hasVertSep[0]?.[c] !== false) {
      write(colSepX[c]!, gridY, junctions.teeDown, cs);
    }
  }
  for (let c = 0; c < borderInfo.numCols - 1; c++) {
    if (colSepX[c] != null && hasVertSep[borderInfo.numRows - 1]?.[c] !== false) {
      write(colSepX[c]!, gridBottom, junctions.teeUp, cs);
    }
  }
}

// ---------------------------------------------------------------------------
// Grid Component
// ---------------------------------------------------------------------------

/**
 * Grid layout component with optional merged borders.
 *
 * Columns are defined with fixed widths or fractional units (`fr`).
 * Children are placed using `GridItem` wrappers with explicit `col`/`row`
 * positions (1-indexed). Adjacent cell borders are shared, not doubled.
 *
 * ```tsx
 * <Grid columns={[15, "1fr", "1fr"]} border="single" width={50}>
 *   <GridItem col={1} row={1}><Text>Name</Text></GridItem>
 *   <GridItem col={2} row={1}><Text>Value</Text></GridItem>
 *   <GridItem col={3} row={1}><Text>Status</Text></GridItem>
 * </Grid>
 * ```
 */
export function Grid(props: GridProps): TuileElement {
  const {
    columns,
    rows,
    border,
    borderColor,
    gap = 0,
    columnGap,
    rowGap,
    spacing = 0,
    width,
    height,
    bgColor,
    align,
    flexGrow,
    flexShrink,
    flexBasis,
    children: rawChildren,
  } = props;

  const cells = parseGridItems(rawChildren);
  const numCols = columns.length;
  let numRows = rows?.length ?? 0;
  for (const cell of cells) {
    numRows = Math.max(numRows, cell.row + 1);
  }
  if (numRows === 0) numRows = 1;

  const hasBorder = border != null && border !== "none";
  // spacing > 0: each cell gets its own border, with space between them
  const spaced = hasBorder && spacing > 0;
  // merged: shared border lines drawn via onPaint
  const merged = hasBorder && !spaced;

  // Spaced mode: spacing=1 means borders touching (gap=0),
  // spacing=2 means 1 empty char between borders, etc.
  const cGap = merged ? 1 : spaced ? spacing - 1 : (columnGap ?? gap);
  const rGap = merged ? 1 : spaced ? spacing - 1 : (rowGap ?? gap);

  // Build cell Box props for a given grid position
  function buildCellProps(col: number, colSpan: number): Record<string, any> {
    const cellProps: Record<string, any> = {};

    let fixedSum = 0;
    let frSum = 0;

    for (let c = col; c < col + colSpan; c++) {
      const fr = parseFr(columns[c]);
      if (fr !== null) {
        frSum += fr;
      } else {
        fixedSum += columns[c] as number;
      }
    }

    // Add gap space absorbed by the span (colSpan - 1 internal gaps)
    const absorbedGaps = (colSpan - 1) * cGap;

    if (frSum === 0) {
      // All fixed columns
      cellProps.width = fixedSum + absorbedGaps;
    } else if (fixedSum === 0) {
      // All fr columns — flexBasis: 0 ensures equal distribution of total space
      // (not just leftover space). Absorbed gaps are included in the basis so
      // spanning cells align with non-spanning rows.
      cellProps.flexBasis = absorbedGaps;
      cellProps.flexGrow = frSum;
    } else {
      // Mixed fixed + fr: fixed portion baked into basis, fr portion grows
      cellProps.flexBasis = fixedSum + absorbedGaps;
      cellProps.flexGrow = frSum;
    }

    return cellProps;
  }

  // Build row elements and collect cell placements for the paint callback
  const rowElements: TuileElement[] = [];
  const cellPlacements: CellPlacement[][] = [];

  for (let r = 0; r < numRows; r++) {
    const cellElements: TuileElement[] = [];
    const rowPlacements: CellPlacement[] = [];

    for (let c = 0; c < numCols;) {
      // Skip positions covered by a span
      if (isCoveredBySpan(cells, r, c)) {
        c++;
        continue;
      }

      const cell = getCellAt(cells, r, c);
      const colSpan = cell?.colSpan ?? 1;
      const cellProps = buildCellProps(c, colSpan);

      // Spaced mode: each cell gets its own border
      if (spaced) {
        cellProps.border = border;
        if (borderColor) cellProps.bgColor = borderColor;
      }

      // Track placement for merged border painting
      if (merged) {
        rowPlacements.push({ col: c, colSpan });
      }

      const content = cell?.content ?? [];
      cellElements.push(h(Box, cellProps, ...content));

      c += colSpan;
    }

    cellPlacements.push(rowPlacements);

    // Row props — rows stretch to fill the grid via the default cross-axis
    // stretch alignment, which is required for fr columns to distribute correctly.
    const rowProps: Record<string, any> = {
      direction: "horizontal" as const,
      gap: cGap,
      align,
    };

    // Row height from rows template
    if (rows && rows[r] !== undefined) {
      const fr = parseFr(rows[r]);
      if (fr !== null) {
        rowProps.flexGrow = fr;
      } else {
        rowProps.height = rows[r] as number;
      }
    }

    rowElements.push(h(Box, rowProps, ...cellElements));
  }

  // Outer grid props
  const gridProps: Record<string, any> = {
    direction: "vertical" as const,
    gap: rGap,
    width,
    height,
    bgColor,
    flexGrow,
    flexShrink,
    flexBasis,
  };

  if (merged) {
    gridProps.border = border;
    const borderInfo: GridBorderInfo = {
      style: border!,
      color: borderColor,
      numCols,
      numRows,
      cells: cells.map(c => ({
        col: c.col,
        row: c.row,
        colSpan: c.colSpan,
      })),
    };
    gridProps.onPaint = (ctx: PaintContext) => {
      paintGridBorders(ctx, borderInfo, cellPlacements);
    };
  }

  return h(Box, gridProps, ...rowElements);
}
