import { describe, expect, test } from "vitest";
import { emphasisDataSchema } from "../shared/emphasis";
import { parseEmphasis } from "./parse-emphasis";

describe("parseEmphasis block delegation", () => {
  test("returns null for plain markdown, bold-only prose, rules, quotes, and intraword underscores", () => {
    const plain = [
      "### 1. Summary",
      "",
      "- **Why:** In [SPEC.md](file:///repo/SPEC.md) and `__init__.py`, `gen = nil` works.",
      "- **NICE:** Covering notes anyway.",
      "",
      "***",
      "",
      "> **Risk:** check `foo__bar` before deploy.",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
    ].join("\n");
    expect(parseEmphasis(plain, "complete")).toBeNull();
  });

  test("preserves links, inline code, and nested lists in screenshot 1 finding structure", () => {
    const source = [
      "### 4. Interactions missed between PDF ingestion and Simplify",
      "",
      "- BLOCKER — [[Broken]] **`content.PlainText` strips paragraph structure before simplification, compounding PDF layout loss.**",
      "  - `simplify.go` passes `source.SourceHTML` through `content.PlainText` (`sanitize.go`).",
      "  - **Do:** Extract block-delimited plain text (`\\n\\n` at block closing tags).",
      "- SHOULD-FIX — [[Broken]] **Scanned/corrupt PDFs lack clear reader affordances.**",
      "  - When `ExtractPDF` fails, [ReaderArticle.tsx](file:///repo/ReaderArticle.tsx#L10) still shows an error.",
    ].join("\n");

    const data = parseEmphasis(source, "complete");
    expect(data).not.toBeNull();
    expect(() => emphasisDataSchema.parse(data)).not.toThrow();

    expect(data?.blocks.map((block) => block.type)).toEqual(["markdown", "list"]);
    const heading = data?.blocks[0];
    expect(heading?.type === "markdown" && heading.text).toBe(
      "### 4. Interactions missed between PDF ingestion and Simplify",
    );

    const list = data?.blocks[1];
    expect(list?.type).toBe("list");
    if (list?.type === "list") {
      expect(list.omitMarkers).toBe(true);
      expect(list.items).toHaveLength(2);
      expect(list.items[0]?.tag).toEqual({ label: "BLOCKER", tone: "neutral" });
      expect(list.items[0]?.chips).toEqual([{ label: "Broken", tone: "error", icon: "Unlink" }]);
      expect(list.items[0]?.body).toContain("- `simplify.go` passes");
      expect(list.items[0]?.body).toContain("- **Do:** Extract block-delimited plain text");
      expect(list.items[1]?.body).toContain(
        "[ReaderArticle.tsx](file:///repo/ReaderArticle.tsx#L10)",
      );
    }
  });

  test("preserves bullet alignment and links in screenshot 2 mixed review list", () => {
    const source = [
      "[[Investigate]] [[Observed]] static code, git commit `c8e00bd`; [[Unverified]] live runtime (`adb` absent).",
      "",
      "---",
      "",
      "### 1. Interpretation call (Content vs. Librarian Notes)",
      "",
      "- FINE — [[Keep]] [[Recommended]] **Content simplification is the right call.**",
      "- **Why:** In [SPEC.md](file:///home/veirt/dev/reading-room/SPEC.md#L109-L119), `gen = nil` runs on templates.",
      "- **NICE:** Align [ReaderArticle.tsx](file:///home/veirt/dev/reading-room/ReaderArticle.tsx#L115-L120).",
    ].join("\n");

    const data = parseEmphasis(source, "complete");
    expect(data).not.toBeNull();
    expect(() => emphasisDataSchema.parse(data)).not.toThrow();
    expect(data?.blocks.map((block) => block.type)).toEqual(["chips", "markdown", "list"]);

    const lead = data?.blocks[0];
    if (lead?.type === "chips") {
      expect(lead.chips.map((c) => c.label)).toEqual(["Investigate", "Observed"]);
      expect(lead.inline).toBeUndefined();
      expect(lead.body).toContain("**⚠ Unverified**");
      expect(lead.body).toContain("`c8e00bd`");
    }

    const md = data?.blocks[1];
    expect(md?.type === "markdown" && md.text).toContain("### 1. Interpretation call");

    const list = data?.blocks[2];
    if (list?.type === "list") {
      expect(list.omitMarkers).toBe(false);
      expect(list.items).toHaveLength(3);
      expect(list.items[0]?.chips.map((c) => c.label)).toEqual(["Keep", "Recommended"]);
      expect(list.items[1]?.chips).toEqual([]);
      expect(list.items[1]?.body).toContain(
        "[SPEC.md](file:///home/veirt/dev/reading-room/SPEC.md#L109-L119)",
      );
      expect(list.items[2]?.body).toContain("[ReaderArticle.tsx]");
    }
  });

  test("keeps nested loose sub-lists inside their parent list item", () => {
    const source = [
      "- [[Broken]] **First issue**",
      "  - sub one",
      "",
      "  - sub two",
      "- [[Done]] **Second item**",
    ].join("\n");

    const data = parseEmphasis(source, "complete");
    expect(data?.blocks).toHaveLength(1);
    const list = data?.blocks[0];
    if (list?.type === "list") {
      expect(list.items).toHaveLength(2);
      expect(list.items[0]?.body).toContain("- sub one\n\n- sub two");
    }
  });

  test("renders icon headings, scoreboards, steppers, trees, gauges, and action badges", () => {
    const source = [
      "## Status",
      "",
      "[[Done 6]] [[Failed 0]] [[Needs you 1]]",
      "",
      "[[Passed 27/27]] full suite green",
      "",
      "setup → build → test ✓",
      "",
      "├── client/",
      "│   └── emphasis-message.tsx",
      "└── shared/",
      "",
      "▰▰▰▰▱ 4 of 5 checks done",
      "",
      "**Next:** reload the plugin",
      "**Fix:** escape `[[word]]` with a backslash",
    ].join("\n");

    const data = parseEmphasis(source, "complete");
    expect(data).not.toBeNull();
    expect(() => emphasisDataSchema.parse(data)).not.toThrow();
    expect(data?.blocks.map((b) => b.type)).toEqual([
      "heading",
      "chips",
      "chips",
      "stepper",
      "tree",
      "gauge",
      "chips",
      "chips",
    ]);

    const shortRow = data?.blocks[2];
    if (shortRow?.type === "chips") {
      expect(shortRow.inline).toBe(true);
      expect(shortRow.body).toBe("full suite green");
    }
    const nextRow = data?.blocks[6];
    if (nextRow?.type === "chips") {
      expect(nextRow.inline).toBe(true);
      expect(nextRow.chips[0]?.tone).toBe("action");
    }
    const fixRow = data?.blocks[7];
    if (fixRow?.type === "chips") {
      expect(fixRow.inline).toBeUndefined();
      expect(fixRow.body).toBe("escape `[[word]]` with a backslash");
    }
  });

  test("protects fences and streaming incomplete syntax cleanly", () => {
    const fenced = "[[Done]] shipped\n\n```md\n[[Failed]]\n├── tree\n```";
    const data = parseEmphasis(fenced, "complete");
    expect(data?.blocks.map((b) => b.type)).toEqual(["chips", "markdown"]);

    const streaming = "[[Done]] ok\n\n[[Unclosed";
    expect(() => emphasisDataSchema.parse(parseEmphasis(streaming, "streaming"))).not.toThrow();

    const unclosedFence = "[[Done]] ok\n\n```ts\nconst x = '[[Broken]]'";
    const streamedFence = parseEmphasis(unclosedFence, "streaming");
    expect(streamedFence?.blocks.map((b) => b.type)).toEqual(["chips", "markdown"]);
  });

  test("leaves plain GFM tables in Markdown and promotes pill tables to table blocks", () => {
    const source = [
      "| Plain | Table |",
      "| --- | --- |",
      "| a | b |",
      "",
      "| Module | State |",
      "| --- | :---: |",
      "| parser | [[Done]] |",
    ].join("\n");
    const data = parseEmphasis(source, "complete");
    expect(data?.blocks.map((b) => b.type)).toEqual(["markdown", "table"]);
  });
});
