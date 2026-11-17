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
      prefixText: "",
      chips: [pill("Done 6"), pill("Failed 1")],
    });
  });

  it("keeps a list marker before a leading chip", () => {
    const layout = planLineLayout([text("- "), pill("Done"), text(" shipped the fix")]);
    expect(layout).toEqual({
      type: "row",
      prefixText: "- ",
      chips: [pill("Done")],
      rest: [text(" shipped the fix")],
    });
  });

  it("collects consecutive lead pills and leaves trailing text inline", () => {
    const layout = planLineLayout([
      pill("Done 6"),
      text(" "),
      pill("Failed 1"),
      text(" since the rerun"),
    ]);
    expect(layout).toEqual({
      type: "row",
      prefixText: "",
      chips: [pill("Done 6"), pill("Failed 1")],
      rest: [text(" since the rerun")],
    });
  });

  it("renders an icon-anchored line as a leading row", () => {
    const layout = planLineLayout([text("- "), icon("Zap"), text("Cause:", true)]);
    expect(layout).toEqual({
      type: "row",
      prefixText: "- ",
      icon: "Zap",
      chips: [],
      rest: [text("Cause:", true)],
    });
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
      expect(layout.prefixText).toBe("- ");
      expect(layout.icon).toBe("Gauge");
      expect(layout.labelText).toBe("Status:");
      expect(layout.chips.map((chip) => chip.label)).toEqual(["Done 6", "Failed 1"]);
      expect(layout.rest?.length).toBeGreaterThan(0);
    }
  });

  it("plans a real parser output: plain prose stays inline", () => {
    const data = parseEmphasis(
      "The renderer only decorates markup that is already there.",
      "complete",
    );
    expect(data).toBeNull();
  });
});
