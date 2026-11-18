import { describe, expect, test } from "vitest";
import {
  extractLeadPrefix,
  normalizeInlinePills,
  parseActionBadge,
  parseGaugePrefix,
  parseIconHeading,
  parsePill,
  parseStepperLine,
} from "./parse-tokens";

describe("parsePill", () => {
  test("classifies vocabulary tones, synonyms, details, and unknown labels", () => {
    expect(parsePill("Done")).toEqual({ label: "Done", tone: "success", icon: "Check" });
    expect(parsePill("completed")).toEqual({ label: "Done", tone: "success", icon: "Check" });
    expect(parsePill("Passed 12/12")).toEqual({
      label: "Passed 12/12",
      tone: "success",
      icon: "Check",
    });
    expect(parsePill("Needs you")).toEqual({
      label: "Needs you",
      tone: "warning",
      icon: "User",
    });
    expect(parsePill("Broken")).toEqual({ label: "Broken", tone: "error", icon: "Unlink" });
    expect(parsePill("Costs money")).toEqual({
      label: "Costs money",
      tone: "danger",
      icon: "CircleDollarSign",
    });
    expect(parsePill("Investigate")).toEqual({
      label: "Investigate",
      tone: "mode",
      icon: "Search",
    });
    expect(parsePill("Custom label")).toEqual({ label: "Custom label", tone: "neutral" });
  });
});

describe("extractLeadPrefix", () => {
  test("lifts action asks as action badges while leaving prose labels like Why and NICE in markdown", () => {
    expect(extractLeadPrefix("**Next:** restart the worker")).toEqual({
      chips: [{ label: "Next", tone: "action", icon: "ArrowRight" }],
      rest: "restart the worker",
    });
    expect(extractLeadPrefix("**Fix:** escape `[[word]]`")).toEqual({
      chips: [{ label: "Fix", tone: "action", icon: "Wrench" }],
      rest: "escape `[[word]]`",
    });
    expect(extractLeadPrefix("**Why:** In [SPEC.md](file:///repo/SPEC.md)")).toBeNull();
    expect(extractLeadPrefix("**NICE:** Covering notes anyway")).toBeNull();
  });

  test("extracts pre-pill tags and balances bold spans across stripped prefixes", () => {
    expect(
      extractLeadPrefix("BLOCKER — [[Broken]] **content.PlainText strips paragraph structure.**"),
    ).toEqual({
      chips: [{ label: "Broken", tone: "error", icon: "Unlink" }],
      tag: { label: "BLOCKER", tone: "neutral" },
      rest: "**content.PlainText strips paragraph structure.**",
    });

    expect(
      extractLeadPrefix("**BLOCKER — [[Broken]] content.PlainText strips structure.**"),
    ).toEqual({
      chips: [{ label: "Broken", tone: "error", icon: "Unlink" }],
      tag: { label: "BLOCKER", tone: "neutral" },
      rest: "**content.PlainText strips structure.**",
    });

    expect(extractLeadPrefix("**Status:** [[Done 6]] [[Failed 1]] shipped")).toEqual({
      chips: [
        { label: "Done 6", tone: "success", icon: "Check" },
        { label: "Failed 1", tone: "error", icon: "X" },
      ],
      tag: { label: "Status", tone: "neutral" },
      rest: "shipped",
    });

    expect(extractLeadPrefix("FINE — [[Keep]] [[Recommended]] **Good call.**")).toEqual({
      chips: [
        { label: "Keep", tone: "success", icon: "Pin" },
        { label: "Recommended", tone: "success", icon: "Star" },
      ],
      tag: { label: "FINE", tone: "neutral" },
      rest: "**Good call.**",
    });
  });
});

describe("parseIconHeading", () => {
  test("lifts plain headings with known icons and leaves numbered or rich headings to Markdown", () => {
    expect(parseIconHeading("## Status")).toEqual({ level: 2, icon: "Gauge", title: "Status" });
    expect(parseIconHeading("## Pipeline")).toEqual({
      level: 2,
      icon: "GitBranch",
      title: "Pipeline",
    });
    expect(parseIconHeading("### 1. Interpretation call (Content vs. Librarian Notes)")).toBeNull();
    expect(parseIconHeading("## Status with [link](https://example.com)")).toBeNull();
    expect(parseIconHeading("## Status `code`")).toBeNull();
  });
});

describe("parseStepperLine & parseGaugePrefix", () => {
  test("parses arrow chains of short tokens and rejects prose", () => {
    expect(parseStepperLine("setup → build → test ✓ → deploy")).toEqual([
      { label: "setup", tone: "neutral" },
      { label: "build", tone: "neutral" },
      { label: "test", tone: "neutral", pass: true },
      { label: "deploy", tone: "neutral" },
    ]);
    expect(parseStepperLine("wait for the → build")).toBeNull();
    expect(parseStepperLine("`a → b`")).toBeNull();
  });

  test("parses leading gauge bars", () => {
    expect(parseGaugePrefix("▰▰▰▰▱ 4 of 5 checks done")).toEqual({
      gauge: { filled: 4, total: 5 },
      rest: "4 of 5 checks done",
    });
  });

  test("maps fix into action badges", () => {
    expect(parseActionBadge("Fix")).toEqual({ label: "Fix", tone: "action", icon: "Wrench" });
  });
});

describe("normalizeInlinePills", () => {
  test("replaces mid-prose pills while skipping code spans, fences, and escapes", () => {
    const input = [
      "saw a; [[Unverified]] runtime and **the [[Done]] build**.",
      "keep `[[Done]]` and ``a ` [[Failed]]` `` and \\[[Literal]] intact.",
      "```ts",
      "const x = '[[Broken]]';",
      "```",
    ].join("\n");
    const result = normalizeInlinePills(input);
    expect(result.changed).toBe(true);
    expect(result.text).toBe(
      [
        "saw a; **⚠ Unverified** runtime and **the ✓ Done build**.",
        "keep `[[Done]]` and ``a ` [[Failed]]` `` and \\[[Literal]] intact.",
        "```ts",
        "const x = '[[Broken]]';",
        "```",
      ].join("\n"),
    );
  });
});
