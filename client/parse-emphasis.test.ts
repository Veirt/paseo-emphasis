import { describe, expect, test } from "vitest";
import { parseEmphasis } from "./parse-emphasis";
import { emphasisDataSchema } from "../shared/emphasis";

describe("parseEmphasis pills", () => {
  test("classifies tone, icon, and canonical word from the core vocabulary", () => {
    const data = parseEmphasis("[[Done]] [[Failed]] [[Needs you]] [[Investigate]]", "complete");
    expect(data?.blocks).toEqual([
      {
        type: "chunk",
        lines: [
          {
            segments: [
              { type: "pill", label: "Done", tone: "success", icon: "Check" },
              { type: "text", text: " ", bold: false },
              { type: "pill", label: "Failed", tone: "error", icon: "X" },
              { type: "text", text: " ", bold: false },
              { type: "pill", label: "Needs you", tone: "warning", icon: "User" },
              { type: "text", text: " ", bold: false },
              { type: "pill", label: "Investigate", tone: "mode", icon: "Search" },
            ],
          },
        ],
      },
    ]);
  });

  test("keeps detail after a known word and canonicalizes synonyms", () => {
    const data = parseEmphasis("[[Passed 12/12]] [[completed]] [[Custom label]]", "complete");
    const pills = segmentsOf(data).filter((segment) => segment.type === "pill");
    expect(pills).toEqual([
      { type: "pill", label: "Passed 12/12", tone: "success", icon: "Check" },
      { type: "pill", label: "Done", tone: "success", icon: "Check" },
      { type: "pill", label: "Custom label", tone: "neutral" },
    ]);
  });

  test("returns an empty pill's brackets as literal text", () => {
    const data = parseEmphasis("[[  ]] after", "complete");
    expect(segmentsOf(data)).toEqual([{ type: "text", text: "[[  ]] after", bold: false }]);
  });
});

describe("parseEmphasis inline styling", () => {
  test("splits bold runs and keeps surrounding text plain", () => {
    const data = parseEmphasis("keep **main loop** safe", "complete");
    expect(segmentsOf(data)).toEqual([
      { type: "text", text: "keep ", bold: false },
      { type: "text", text: "main loop", bold: true },
      { type: "text", text: " safe", bold: false },
    ]);
  });

  test("treats an unclosed bold span as bold to the end of the line", () => {
    const data = parseEmphasis("still **typing", "complete");
    expect(segmentsOf(data)).toEqual([
      { type: "text", text: "still ", bold: false },
      { type: "text", text: "typing", bold: true },
    ]);
  });

  test("keeps an escaped marker literal", () => {
    const data = parseEmphasis("a \\** b", "complete");
    expect(segmentsOf(data)).toEqual([{ type: "text", text: "a \\** b", bold: false }]);
  });

  test("classifies arrows, marks, and tree connectors", () => {
    const data = parseEmphasis("build → test ✓ ✗ ├── root", "complete");
    expect(segmentsOf(data)).toEqual([
      { type: "text", text: "build ", bold: false },
      { type: "arrow" },
      { type: "text", text: " test ", bold: false },
      { type: "mark", pass: true },
      { type: "text", text: " ", bold: false },
      { type: "mark", pass: false },
      { type: "text", text: " ", bold: false },
      { type: "tree", text: "├──" },
      { type: "text", text: " root", bold: false },
    ]);
  });

  test("leaves inline code untouched", () => {
    const data = parseEmphasis("run `npm [[Done]] test` now", "complete");
    expect(segmentsOf(data)).toEqual([
      { type: "text", text: "run ", bold: false },
      { type: "code", text: "npm [[Done]] test" },
      { type: "text", text: " now", bold: false },
    ]);
  });
});

describe("parseEmphasis labels and headings", () => {
  test("gives a line-leading bold label its icon", () => {
    const data = parseEmphasis("- **Plan:** do it", "complete");
    expect(segmentsOf(data)).toEqual([
      { type: "text", text: "- ", bold: false },
      { type: "icon", name: "ClipboardList" },
      { type: "text", text: "Plan:", bold: true },
      { type: "text", text: " do it", bold: false },
    ]);
  });

  test("gives an action lead-in an icon mid-line", () => {
    const data = parseEmphasis("waiting **Check:** the logs", "complete");
    expect(segmentsOf(data)).toEqual([
      { type: "text", text: "waiting ", bold: false },
      { type: "icon", name: "SquareCheck" },
      { type: "text", text: "Check:", bold: true },
      { type: "text", text: " the logs", bold: false },
    ]);
  });

  test("icons a known heading and strips marks at level two", () => {
    const data = parseEmphasis("## Status", "complete");
    expect(data?.blocks).toEqual([
      {
        type: "chunk",
        lines: [
          {
            heading: 2,
            segments: [
              { type: "icon", name: "Gauge" },
              { type: "text", text: "Status", bold: true },
            ],
          },
        ],
      },
    ]);
  });

  test("strips hash marks on headings deeper than two", () => {
    const data = parseEmphasis("### Untitled", "complete");
    expect(data?.blocks).toEqual([
      {
        type: "chunk",
        lines: [{ heading: 3, segments: [{ type: "text", text: "Untitled", bold: true }] }],
      },
    ]);
  });
});

describe("parseEmphasis block layout", () => {
  test("reads a gauge bar as structured data", () => {
    const data = parseEmphasis("progress ▰▰▱▱▱", "complete");
    expect(segmentsOf(data)).toEqual([
      { type: "text", text: "progress ", bold: false },
      { type: "gauge", filled: 2, total: 5 },
    ]);
  });

  test("returns null when nothing needs decorating", () => {
    expect(parseEmphasis("plain text\n\n- a\n- b", "complete")).toBeNull();
  });

  test("leaves fenced code to the host renderer", () => {
    const data = parseEmphasis('[[Done]] shipped\n\n```bash\necho "[[Done]]"\n```', "complete");
    expect(data?.blocks.map((block) => block.type)).toEqual(["chunk", "markdown"]);
    const markdown = data?.blocks[1]?.type === "markdown" ? data.blocks[1].text : "(not markdown)";
    expect(markdown).toContain('echo "[[Done]]"');
  });

  test("round-trips its output through the timeline item schema", () => {
    const source = "## Result\n\n[[Passed 3]] checks ✓\n- **Fix:** loop\nplain tail";
    const data = parseEmphasis(source, "streaming");
    expect(() => emphasisDataSchema.parse(data)).not.toThrow();
    expect(data?.text).toBe(source);
    expect(data?.phase).toBe("streaming");
  });
});

function segmentsOf(data: ReturnType<typeof parseEmphasis>) {
  expect(data).not.toBeNull();
  const chunks = data?.blocks.filter((block) => block.type === "chunk") ?? [];
  const lines = chunks.flatMap((block) => (block.type === "chunk" ? block.lines : []));
  return lines.flatMap((line) => line.segments);
}
