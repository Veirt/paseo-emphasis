import { describe, expect, it } from "vitest";
import { buildFullInstructions, EMPHASIS_MARKER } from "./instructions";
import { CONTEXT_WORDS, VOCABULARY } from "./vocabulary";

describe("buildFullInstructions", () => {
  const text = buildFullInstructions();

  it("carries the marker exactly once so repeated injection cannot stack copies", () => {
    expect(text.split(EMPHASIS_MARKER)).toHaveLength(2);
  });

  it("teaches every canonical pill word from the vocabulary", () => {
    for (const { core } of Object.values(VOCABULARY)) {
      for (const word of core) expect(text).toContain(`[[${word}]]`);
    }
  });

  it("teaches the context words", () => {
    for (const word of CONTEXT_WORDS) expect(text).toContain(`[[${word}]]`);
  });

  it("credits pi-emphasis for the vocabulary", () => {
    expect(text).toContain("pi-emphasis");
  });

  it("teaches the combined workflow with generative ui blocks", () => {
    expect(text).toContain("```ui");
    expect(text).toContain("Generative UI plugin");
  });
});
