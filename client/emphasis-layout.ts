import type { EmphasisSegment } from "../shared/emphasis";

export type PillSegment = Extract<EmphasisSegment, { type: "pill" }>;

/**
 * How one parsed line turns into native views. A line never places a `View`
 * inside a `Text`, because inline views break text selection and baseline
 * alignment; instead a line becomes either a leading row (an optional list
 * marker, an optional icon, an optional lead label, a run of chips, then
 * flowing text) or plain inline text where pills degrade to colored bold
 * labels.
 */
export type LineLayout =
  | {
      type: "row";
      prefixText: string;
      icon?: string;
      labelText?: string;
      chips: PillSegment[];
      rest?: EmphasisSegment[];
    }
  | { type: "inline"; segments: EmphasisSegment[] };

export type RowLayout = Extract<LineLayout, { type: "row" }>;

/** Text before a lead element: only whitespace or a list marker qualifies. */
const LIST_PREFIX = /^\s*(?:[-*+]|\d+\.)?\s*$/;

function isBlankText(
  segment: EmphasisSegment | undefined,
): segment is Extract<EmphasisSegment, { type: "text" }> {
  return segment?.type === "text" && LIST_PREFIX.test(segment.text);
}

function toPill(segment: EmphasisSegment): PillSegment | undefined {
  return segment.type === "pill" ? segment : undefined;
}

function rowOf(prefixText: string, chips: PillSegment[], rest?: EmphasisSegment[]): RowLayout {
  const row: RowLayout = { type: "row", prefixText, chips };
  if (rest !== undefined && rest.length > 0) row.rest = rest;
  return row;
}

/** The run of text segments starting at `start`; pills, icons, and code end it. */
function textRunFrom(
  segments: readonly EmphasisSegment[],
  start: number,
): {
  text: string;
  end: number;
} {
  let text = "";
  let index = start;
  while (index < segments.length) {
    const segment = segments[index];
    if (segment?.type !== "text") break;
    text += segment.text;
    index += 1;
  }
  return { text, end: index };
}

/**
 * Collects the pill run starting at `start`, skipping blank separators. Returns
 * the chips, the index of the first non-pill segment, and whether the run
 * consumed everything to the end of the line.
 */
function pillRunFrom(
  segments: readonly EmphasisSegment[],
  start: number,
): { chips: PillSegment[]; end: number; consumedAll: boolean } {
  const chips: PillSegment[] = [];
  let index = start;
  let lastPillEnd = start;
  while (index < segments.length) {
    const segment = segments[index];
    if (isBlankText(segment)) {
      index += 1;
      continue;
    }
    const pill = segment === undefined ? undefined : toPill(segment);
    if (!pill) break;
    chips.push(pill);
    index += 1;
    lastPillEnd = index;
  }
  return { chips, end: lastPillEnd, consumedAll: lastPillEnd >= segments.length };
}

/**
 * Plans the native layout of one line's segments under the no-view-in-text
 * rule. A line that opens with an icon or a pill after at most a list marker
 * renders as a leading row; pills already at the lead keep their chip shape,
 * and pills deeper in the line degrade to styled text. Anything else renders
 * inline.
 */
export function planLineLayout(segments: EmphasisSegment[]): LineLayout {
  let index = 0;
  let prefixText = "";
  while (index < segments.length) {
    const segment = segments[index];
    if (!isBlankText(segment)) break;
    prefixText += segment.text;
    index += 1;
  }

  const first = segments[index];
  if (first === undefined) {
    return { type: "inline", segments };
  }

  if (first.type === "pill") {
    const run = pillRunFrom(segments, index);
    return rowOf(prefixText, run.chips, run.consumedAll ? undefined : segments.slice(run.end));
  }

  if (first.type === "icon") {
    const label = textRunFrom(segments, index + 1);
    if (label.end >= segments.length) {
      const row = rowOf(prefixText, [], segments.slice(index + 1));
      row.icon = first.name;
      return row;
    }
    const run = pillRunFrom(segments, label.end);
    if (run.chips.length === 0) {
      return rowOf(prefixText, [], segments.slice(index + 1));
    }
    const row = rowOf(prefixText, run.chips, run.consumedAll ? undefined : segments.slice(run.end));
    row.labelText = label.text.replace(/\s+$/, "");
    row.icon = first.name;
    return row;
  }

  return { type: "inline", segments };
}
