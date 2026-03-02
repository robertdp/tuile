import { describe, it, expect } from "vitest";
import { Table } from "../../src/widgets/Table.js";
import { mount, BOX, TEXT, TEXT_NODE } from "../../src/element/reconciler.js";
import { signal } from "../../src/reactive/signal.js";
import { Box } from "../../src/primitives/Box.js";
import { collectText } from "../../src/layout/engine.js";

const columns = [
  { header: "Name", key: "name", width: 10 },
  { header: "Age", key: "age", width: 5, align: "right" as const },
];

const data = [
  { name: "Alice", age: 30 },
  { name: "Bob", age: 25 },
];

/** Collect all visible text from a mounted node tree, joining children with newlines */
function allText(node: ReturnType<typeof mount>): string {
  return node.children.map(c => collectText(c)).join("\n");
}

describe("Table", () => {
  it("returns a box element", () => {
    const el = Table({ columns, data });
    expect(el.type).toBe(Box);
  });

  it("mounts with static data", () => {
    const el = Table({ columns, data });
    const node = mount(el);
    expect(node.type).toBe(BOX);
    // Bordered: top + header + separator + For(fragment) + bottom = 5 children
    expect(node.children.length).toBe(5);
  });

  it("renders bordered table text", () => {
    const el = Table({ columns, data, border: true });
    const node = mount(el);
    const text = allText(node);
    expect(text).toContain("┌");
    expect(text).toContain("┐");
    expect(text).toContain("└");
    expect(text).toContain("┘");
    expect(text).toContain("Alice");
    expect(text).toContain("Bob");
  });

  it("renders borderless table", () => {
    const el = Table({ columns, data, border: false });
    const node = mount(el);
    const text = allText(node);
    expect(text).not.toContain("┌");
    expect(text).toContain("Alice");
    expect(text).toContain("Name");
  });

  it("mounts with signal data", () => {
    const reactiveData = signal(data);
    const el = Table({ columns, data: reactiveData });
    const node = mount(el);
    expect(node.type).toBe(BOX);
  });

  it("auto-sizes columns when width not specified", () => {
    const cols = [
      { header: "Name", key: "name" },
      { header: "Score", key: "score" },
    ];
    const rows = [
      { name: "A", score: "100" },
      { name: "Longname", score: "5" },
    ];
    const el = Table({ columns: cols, data: rows });
    const node = mount(el);
    const text = allText(node);
    // "Longname" should be fully visible (8 chars > header "Name" 4 chars)
    expect(text).toContain("Longname");
  });

  it("right-aligns columns", () => {
    const el = Table({ columns, data, border: false });
    const node = mount(el);
    const text = allText(node);
    const lines = text.split("\n").filter(Boolean);
    // Data row for Alice: age "30" should be right-aligned in 5-char column
    const aliceLine = lines.find((l) => l.includes("Alice"))!;
    expect(aliceLine).toContain("   30"); // right-aligned "30" in 5 chars
  });
});
