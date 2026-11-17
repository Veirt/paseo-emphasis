import { describe, expect, it } from "vitest";
import type { EmphasisTone } from "../shared/emphasis";
import type { EmphasisSegment } from "../shared/emphasis";
import { parseEmphasis } from "./parse-emphasis";
import { planLineLayout, type PillSegment } from "./emphasis-layout";

const text = (value: string, bold = false): EmphasisSegment => ({
  type: "text",
  text: value,
  bold,
});
const pill = (label: string, tone: EmphasisTone = "success"): PillSegment => ({
  type: "pill",
  label,
  tone,
});
const icon = (name: string): EmphasisSegment => ({ type: "icon", name });

describe("planLineLayout", () => {
  it("renders a scoreboard of pills as a chip row", () => {
    const layout = planLineLayout([pill("Done 6"), text(" "), pill("Failed 1")]);
    expect(layout).toEqual({
      type: "row",
      chips: [pill("Done 6"), pill("Failed 1")],
    });
  });

  it("keeps a list marker before a leading chip", () => {
    const layout = planLineLayout([text("- "), pill("Done"), text(" shipped the fix")]);
    expect(layout).toEqual({
      type: "row",
      marker: { kind: "bullet" },
      chips: [pill("Done")],
      rest: [text(" shipped the fix")],
    });
  });

  it("renders an icon-anchored line as a leading row", () => {
    const layout = planLineLayout([text("- "), icon("Zap"), text("Cause:", true)]);
    expect(layout).toEqual({
      type: "row",
      marker: { kind: "bullet" },
      icon: "Zap",
      labelText: "Cause:",
      chips: [],
    });
  });

  it("gives a bold lead label its own hanging-indent row", () => {
    const layout = planLineLayout([
      text("- "),
      text("Why neutral:", true),
      text(" numbers never claim a verdict"),
    ]);
    expect(layout).toEqual({
      type: "row",
      marker: { kind: "bullet" },
      labelText: "Why neutral:",
      chips: [],
      rest: [text(" numbers never claim a verdict")],
    });
  });

  it("lifts a trailing mark off the end of the line", () => {
    const layout = planLineLayout([
      text("- "),
      text("rewrite landed", true),
      text(" "),
      { type: "mark", pass: true },
    ]);
    expect(layout.type).toBe("row");
    if (layout.type === "row") {
      expect(layout.marker).toEqual({ kind: "bullet" });
      expect(layout.rest?.map((segment) => segment.type)).toEqual(["text"]);
      expect(layout.trailingMark).toEqual({ pass: true });
    }
  });

  it("degrades mid-sentence pills to inline text", () => {
    const layout = planLineLayout([text("the build is "), pill("Done"), text(" and green")]);
    expect(layout).toEqual({
      type: "inline",
      segments: [text("the build is "), pill("Done"), text(" and green")],
    });
  });

  it("renders plain prose inline", () => {
    const layout = planLineLayout([text("**Cause:** the main loop dropped a frame", true)]);
    expect(layout).toEqual({
      type: "inline",
      segments: [text("**Cause:** the main loop dropped a frame", true)],
    });
  });

  it("plans a parsed arrow chain as a stepper", () => {
    const data = parseEmphasis("setup → build → test ✓", "complete");
    const layout = planLineLayout(
      data?.blocks[0]?.type === "chunk" ? data.blocks[0].lines[0].segments : [],
    );
    expect(layout.type).toBe("stepper");
    if (layout.type === "stepper") {
      expect(layout.steps).toHaveLength(3);
      expect(layout.steps[2].mark).toEqual({ pass: true });
    }
  });

  it("plans a parsed tree line with depth and rails", () => {
    const data = parseEmphasis("│   └── render", "complete");
    const layout = planLineLayout(
      data?.blocks[0]?.type === "chunk" ? data.blocks[0].lines[0].segments : [],
    );
    expect(layout.type).toBe("tree");
    if (layout.type === "tree") {
      expect(layout.depth).toBe(1);
      expect(layout.rails).toEqual([true]);
      expect(layout.glyph).toBe("last");
      expect(layout.rest).toHaveLength(1);
    }
  });

  it("plans a leading gauge as a gauge row", () => {
    const layout = planLineLayout([{ type: "gauge", filled: 2, total: 5 }, text(" done")]);
    expect(layout).toEqual({
      type: "gauge-row",
      gauge: { filled: 2, total: 5 },
      rest: [text(" done")],
    });
  });

  it("falls back to inline when a step token is prose-shaped", () => {
    const data = parseEmphasis("wait for the → build", "complete");
    const layout = planLineLayout(
      data?.blocks[0]?.type === "chunk" ? data.blocks[0].lines[0].segments : [],
    );
    expect(layout.type).toBe("inline");
  });
});

describe("planLineLayout over parsed lines", () => {
  it("plans a real parser output: a bullet with a lead pill", () => {
    const data = parseEmphasis("- **Status:** [[Done 6]] [[Failed 1]] shipped", "complete");
    expect(data).not.toBeNull();
    const chunk = data?.blocks.find((block) => block.type === "chunk");
    const line = chunk && chunk.type === "chunk" ? chunk.lines[0] : undefined;
    const layout = planLineLayout(line?.segments ?? []);
    expect(layout.type).toBe("row");
    if (layout.type === "row") {
      expect(layout.marker).toEqual({ kind: "bullet" });
      expect(layout.labelText).toBe("Status:");
      expect(layout.chips.map((chip) => chip.label)).toEqual(["Done 6", "Failed 1"]);
      expect(layout.rest?.length).toBeGreaterThan(0);
    }
  });

  it("keeps the bold scope inside the bold run", () => {
    const data = parseEmphasis("- **Next:** install the deps and rerun the build", "complete");
    const chunk = data?.blocks.find((block) => block.type === "chunk");
    const line = chunk && chunk.type === "chunk" ? chunk.lines[0] : undefined;
    const layout = planLineLayout(line?.segments ?? []);
    expect(layout.type).toBe("row");
    if (layout.type === "row") {
      expect(layout.labelText).toBe("Next:");
      const rest = layout.rest ?? [];
      expect(
        rest.some((segment) => segment.type === "text" && segment.text.includes("install")),
      ).toBe(true);
    }
  });
});
