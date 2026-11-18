import { describe, expect, test } from "vitest";
import { parseTableAt, splitTableCells } from "./parse-table";

describe("splitTableCells", () => {
  test("respects escaped pipes and pipes inside inline code spans", () => {
    expect(splitTableCells("| `a | b` | left \\| right | [[Done]] |")).toEqual([
      "`a | b`",
      "left | right",
      "[[Done]]",
    ]);
  });
});

describe("parseTableAt", () => {
  test("returns null for plain GFM tables so host Markdown handles them natively", () => {
    const lines = [
      "| Module | Lines |",
      "| --- | ---: |",
      "| emphasis-message.tsx | 99 |",
      "| parse-emphasis.ts | 180 |",
    ];
    expect(parseTableAt(lines, 0)).toBeNull();
  });

  test("parses tables containing pills, gauges, marks, and Markdown prose cells", () => {
    const lines = [
      "| Module | State | Progress | Checks |",
      "| --- | :---: | --- | ---: |",
      "| [parse.ts](file:///repo/parse.ts) | [[Done]] | ▰▰▰▰▱ | 36/36 ✓ |",
      "| `ui.tsx` | [[Needs you]] | ▰▱▱▱▱ | **Pending** |",
    ];
    const parsed = parseTableAt(lines, 0);
    expect(parsed).not.toBeNull();
    expect(parsed?.next).toBe(4);
    expect(parsed?.table.aligns).toEqual(["none", "center", "none", "right"]);
    expect(parsed?.table.rows[0]).toEqual([
      { kind: "markdown", text: "[parse.ts](file:///repo/parse.ts)" },
      { kind: "chips", chips: [{ label: "Done", tone: "success", icon: "Check" }] },
      { kind: "gauge", gauge: { filled: 4, total: 5 } },
      { kind: "mark", pass: true, text: "36/36" },
    ]);
    expect(parsed?.table.rows[1]?.[0]).toEqual({ kind: "markdown", text: "`ui.tsx`" });
  });
});
