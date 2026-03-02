/** @jsxImportSource tuile */
// ---------------------------------------------------------------------------
// Table Widget
// ---------------------------------------------------------------------------

import { computed } from "../reactive/signal.js";
import type { TuileElement, MaybeSignal, Color } from "../element/types.js";
import { readValue } from "../reactive/utils.js";
import { Box } from "../primitives/Box.js";
import { Text } from "../primitives/Text.js";
import { For } from "../reactive/control-flow.js";
import { stringWidth, sliceByWidth } from "../text/width.js";

export interface TableColumn {
  /** Column header text */
  header: string;
  /** Key to access in row data */
  key: string;
  /** Fixed width (if not set, auto-sized from content) */
  width?: number;
  /** Text alignment within column (default: "left") */
  align?: "left" | "center" | "right";
}

export interface TableProps {
  /** Column definitions */
  columns: TableColumn[];
  /** Row data (array of objects, or a signal thereof) */
  data: MaybeSignal<Record<string, any>[]>;
  /** Show borders between cells (default: true) */
  border?: boolean;
  /** Header text style color */
  headerColor?: MaybeSignal<Color>;
  /** Border character color */
  borderColor?: MaybeSignal<Color>;
  /** Padding between columns when borderless (default: 2) */
  columnGap?: number;
}

function padCell(text: string, width: number, align: "left" | "center" | "right" = "left"): string {
  const str = String(text);
  const sw = stringWidth(str);
  if (sw >= width) return sliceByWidth(str, width);
  const padding = width - sw;
  switch (align) {
    case "right":
      return " ".repeat(padding) + str;
    case "center": {
      const left = Math.floor(padding / 2);
      return " ".repeat(left) + str + " ".repeat(padding - left);
    }
    default:
      return str + " ".repeat(padding);
  }
}

/**
 * Table component with column definitions and row data.
 *
 * ```tsx
 * <Table
 *   columns={[
 *     { header: "Name", key: "name", width: 15 },
 *     { header: "Age", key: "age", width: 5, align: "right" },
 *   ]}
 *   data={[
 *     { name: "Alice", age: 30 },
 *     { name: "Bob", age: 25 },
 *   ]}
 * />
 * ```
 */
export function Table(props: TableProps): TuileElement {
  const {
    columns,
    data,
    border = true,
    headerColor,
    borderColor,
    columnGap = 2,
  } = props;

  const gap = " ".repeat(columnGap);

  const widths = computed(() => {
    const rows = readValue(data);
    return columns.map((col) => {
      if (col.width) return col.width;
      let max = stringWidth(col.header);
      for (const row of rows) {
        const sw = stringWidth(String(row[col.key] ?? ""));
        if (sw > max) max = sw;
      }
      return max;
    });
  });

  function formatDataRow(row: Record<string, any>, ws: number[]): string {
    if (border) {
      return "│" + columns.map((col, i) =>
        " " + padCell(String(row[col.key] ?? ""), ws[i], col.align) + " "
      ).join("│") + "│";
    }
    return columns.map((col, i) =>
      padCell(String(row[col.key] ?? ""), ws[i], col.align)
    ).join(gap);
  }

  const headerText = computed(() => {
    const ws = widths.value;
    if (border) {
      return "│" + columns.map((col, i) =>
        " " + padCell(col.header, ws[i], col.align) + " "
      ).join("│") + "│";
    }
    return columns.map((col, i) =>
      padCell(col.header, ws[i], col.align)
    ).join(gap);
  });

  const separatorText = computed(() => {
    const ws = widths.value;
    if (border) {
      return "├" + ws.map(w => "─".repeat(w + 2)).join("┼") + "┤";
    }
    return ws.map(w => "─".repeat(w)).join(gap);
  });

  if (border) {
    const topText = computed(() =>
      "┌" + widths.value.map(w => "─".repeat(w + 2)).join("┬") + "┐"
    );
    const bottomText = computed(() =>
      "└" + widths.value.map(w => "─".repeat(w + 2)).join("┴") + "┘"
    );

    const headerCells = columns.map((col, i) =>
      computed(() => " " + padCell(col.header, widths.value[i], col.align) + " ")
    );

    return (
      <Box direction="vertical">
        <Text color={borderColor}>{topText}</Text>
        <Box direction="horizontal">
          <Text color={borderColor}>│</Text>
          {columns.map((_, i) => [
            <Text color={headerColor}>{headerCells[i]}</Text>,
            <Text color={borderColor}>│</Text>,
          ])}
        </Box>
        <Text color={borderColor}>{separatorText}</Text>
        <For each={data}>
          {(row) => {
            const cells = columns.map((col, i) =>
              computed(() => " " + padCell(String(row[col.key] ?? ""), widths.value[i], col.align) + " ")
            );
            return (
              <Box direction="horizontal">
                <Text color={borderColor}>│</Text>
                {columns.map((_, i) => [
                  <Text>{cells[i]}</Text>,
                  <Text color={borderColor}>│</Text>,
                ])}
              </Box>
            );
          }}
        </For>
        <Text color={borderColor}>{bottomText}</Text>
      </Box>
    );
  }

  return (
    <Box direction="vertical">
      <Text color={headerColor}>{headerText}</Text>
      <Text color={borderColor}>{separatorText}</Text>
      <For each={data}>
        {(row) => {
          const line = computed(() => formatDataRow(row, widths.value));
          return <Text>{line}</Text>;
        }}
      </For>
    </Box>
  );
}
