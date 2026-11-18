import type { EmphasisLine, EmphasisSegment, EmphasisTone, Gauge } from "../shared/emphasis";

export type PillSegment = Extract<EmphasisSegment, { type: "pill" }>;

/** A list marker drawn in the gutter: an unordered dot or an ordered number. */
export type ListMarker = { kind: "bullet" } | { kind: "number"; label: string };

/** One step of an arrow chain: a word or pill, with an optional status mark. */
export interface StepSpec {
  label: string;
  tone: EmphasisTone;
  icon?: string;
  mark?: { pass: boolean };
}

/**
 * How one parsed line turns into native views. A line never places a `View`
 * inside a `Text`, because inline views break text selection and baseline
 * alignment: anything component-like is lifted into a row-level slot, and what
 * stays inline degrades to styled text.
 */
export type LineLayout =
  | {
      type: "row";
      marker?: ListMarker;
      /** A lead badge: icon plus label word, for icon-anchored lead-ins like "Next:". */
      leadBadge?: { icon: string; word?: string };
      /** A leading status mark, drawn as an icon in the gutter. */
      leadMark?: { pass: boolean };
      labelText?: string;
      chips: PillSegment[];
      gauge?: Gauge;
      /** A trailing status mark, drawn as an icon after the row content. */
      trailingMark?: { pass: boolean };
      rest?: EmphasisSegment[];
    }
  | TreeLayout
  /** An arrow chain of short words or pills, drawn as chips with chevrons. */
  | { type: "stepper"; marker?: ListMarker; steps: StepSpec[] }
  /** A leading gauge, drawn as a real bar. */
  | { type: "gauge-row"; gauge: Gauge; rest?: EmphasisSegment[] }
  | { type: "inline"; segments: EmphasisSegment[] };

export type RowLayout = Extract<LineLayout, { type: "row" }>;

/** A tree line: rail glyphs follow tree syntax and render in a monospace panel. */
export type TreeLayout = { type: "tree" };

/** An arrow chain of short words or pills, drawn as chips with chevrons. */
export type StepperLayout = {
  type: "stepper";
  marker?: ListMarker;
  steps: StepSpec[];
};

/** A leading gauge, drawn as a real bar. */
export type GaugeLayout = { type: "gauge-row"; gauge: Gauge; rest?: EmphasisSegment[] };

type TextSegment = Extract<EmphasisSegment, { type: "text" }>;

/** A single list marker token: a bullet character or an ordered number. */
const LIST_MARKER = /^(?:[-*+]|\d{1,3}\.)$/;

function isBlankText(segment: EmphasisSegment | undefined): segment is TextSegment {
  return segment?.type === "text" && segment.text.trim().length === 0;
}

function isBoldText(segment: EmphasisSegment | undefined): segment is TextSegment {
  return segment?.type === "text" && segment.bold;
}

function toPill(segment: EmphasisSegment): PillSegment | undefined {
  return segment.type === "pill" ? segment : undefined;
}

function markerOf(text: string): ListMarker {
  return /^\d/.test(text) ? { kind: "number", label: text } : { kind: "bullet" };
}

function rowOf(marker: ListMarker | undefined, chips: PillSegment[]): RowLayout {
  const row: RowLayout = { type: "row", chips };
  if (marker !== undefined) row.marker = marker;
  return row;
}

/** The run of text segments starting at `start`; pills, icons, and code end it. */
function textRunFrom(
  segments: readonly EmphasisSegment[],
  start: number,
  onlyBold: boolean,
): { text: string; end: number } {
  let text = "";
  let index = start;
  while (index < segments.length) {
    const segment = segments[index];
    if (onlyBold) {
      if (!isBoldText(segment)) break;
      text += segment.text;
    } else {
      if (segment === undefined || segment.type !== "text") break;
      text += segment.text;
    }
    index += 1;
  }
  return { text, end: index };
}

/**
 * Collects the pill run starting at `start`, skipping blank separators. Returns
 * the chips and the index just past the run.
 */
function pillRunFrom(
  segments: readonly EmphasisSegment[],
  start: number,
): { chips: PillSegment[]; end: number } {
  const chips: PillSegment[] = [];
  let index = start;
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
  }
  return { chips, end: index };
}

/**
 * Fills a row's tail from `start`: a gauge becomes the row's bar, a status
 * mark on the end of the line moves to the trailing slot, and what remains is
 * the flowing text.
 */
function finishRow(row: RowLayout, segments: readonly EmphasisSegment[], start: number): void {
  const bar = gaugeAt(segments, start);
  const rest = segments.slice(bar !== undefined ? bar.end : start);
  if (bar !== undefined) row.gauge = bar.gauge;
  const last = rest.at(-1);
  if (last?.type === "mark") {
    row.trailingMark = { pass: last.pass };
    if (rest.length > 1) row.rest = rest.slice(0, -1);
    return;
  }
  if (rest.length > 0) row.rest = rest;
}

/** The gauge, if any, sitting at `start`. */
function gaugeAt(
  segments: readonly EmphasisSegment[],
  start: number,
): { gauge: Gauge; end: number } | undefined {
  const segment = segments[start];
  if (segment?.type !== "gauge") return undefined;
  return { gauge: { filled: segment.filled, total: segment.total }, end: start + 1 };
}

/**
 * Recognizes a tree line: a rail prefix (`│   `, or four spaces per skipped
 * level) followed by a `├──`/`└──` connector. The glyphs stay literal; the
 * renderer draws the run as one monospace panel. Returns undefined for
 * anything else.
 */
function treePlanAt(segments: readonly EmphasisSegment[], start: number): TreeLayout | undefined {
  let railSource = "";
  let cursor = start;
  while (segments[cursor]?.type === "text") {
    railSource += (segments[cursor] as TextSegment).text;
    cursor += 1;
  }
  const connector = segments[cursor];
  if (connector?.type !== "tree" || !/^[├└]──$/.test(connector.text)) return undefined;

  let index = 0;
  while (index < railSource.length) {
    const char = railSource[index];
    if (char === "│" || char === "|") {
      index += 1;
      while (railSource[index] === " ") index += 1;
    } else if (railSource.startsWith("    ", index)) {
      index += 4;
    } else {
      return undefined;
    }
  }
  return { type: "tree" };
}

/** One step token of an arrow chain: a single short word, no sentence punctuation. */
const STEP_TOKEN = /^[A-Za-z0-9][A-Za-z0-9./+@_-]{0,23}$/;

/**
 * Plans an arrow chain: short words or pills joined by `→`, with status marks
 * attaching to the step before them. Anything prose-shaped returns undefined.
 */
function stepperPlanAt(
  segments: readonly EmphasisSegment[],
  start: number,
  marker: ListMarker | undefined,
): Extract<LineLayout, { type: "stepper" }> | undefined {
  const steps: StepSpec[] = [];
  let arrows = 0;
  let open = false;
  let pendingMark: { pass: boolean } | undefined;
  for (let index = start; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment === undefined) return undefined;
    if (segment.type === "arrow") {
      if (!open) return undefined;
      arrows += 1;
      continue;
    }
    if (segment.type === "mark") {
      if (!open) {
        pendingMark = { pass: segment.pass };
        continue;
      }
      const last = steps.at(-1);
      if (last === undefined || last.mark !== undefined) return undefined;
      last.mark = { pass: segment.pass };
      continue;
    }
    let step: StepSpec | undefined;
    if (segment.type === "pill") {
      step = { label: segment.label, tone: segment.tone, icon: segment.icon };
    } else if (segment.type === "text") {
      const token = segment.text.trim();
      if (token.length === 0) continue;
      if (!STEP_TOKEN.test(token)) return undefined;
      step = { label: token, tone: "neutral" };
    } else {
      return undefined;
    }
    if (pendingMark !== undefined) {
      step.mark = pendingMark;
      pendingMark = undefined;
    }
    steps.push(step);
    open = true;
  }
  if (steps.length < 2 || arrows < 1) return undefined;
  const plan: StepperLayout = { type: "stepper", steps };
  if (marker !== undefined) plan.marker = marker;
  return plan;
}

/**
 * Builds a row from the bold run at `start`: the run becomes the lead label,
 * any pills after it become chips, and the rest of the line is the row's tail.
 */
function labeledRowFrom(
  segments: readonly EmphasisSegment[],
  start: number,
  marker: ListMarker | undefined,
): RowLayout {
  const row = rowOf(marker, []);
  const label = textRunFrom(segments, start, true);
  const text = label.text.trimEnd();
  if (text.length > 0) row.labelText = text;
  const run = pillRunFrom(segments, label.end);
  if (run.chips.length > 0) {
    row.chips = run.chips;
    finishRow(row, segments, run.end);
  } else {
    finishRow(row, segments, label.end);
  }
  return row;
}

/**
 * Plans the native layout of one line's segments under the no-view-in-text
 * rule. Structure the source draws with glyphs - bullets, tree connectors,
 * arrows between steps, gauges - becomes row-level views; a line that opens
 * with a pill, an icon, a status mark, or a bold lead label (after at most a
 * list marker) becomes a leading row, and pills deeper in the line degrade to
 * styled text. Anything else renders inline.
 */
export function planLineLayout(segments: EmphasisSegment[]): LineLayout {
  let index = 0;
  let marker: ListMarker | undefined;
  while (index < segments.length) {
    const segment = segments[index];
    if (segment?.type !== "text") break;
    const token = segment.text.trim();
    if (token.length === 0) {
      index += 1;
      continue;
    }
    if (marker === undefined && LIST_MARKER.test(token)) {
      marker = markerOf(token);
      index += 1;
      continue;
    }
    break;
  }

  const tree = index < segments.length ? treePlanAt(segments, index) : undefined;
  if (tree !== undefined) return tree;

  const stepper = index < segments.length ? stepperPlanAt(segments, index, marker) : undefined;
  if (stepper !== undefined) return stepper;

  const first = segments[index];
  if (first === undefined) {
    return { type: "inline", segments };
  }

  if (first.type === "pill") {
    const run = pillRunFrom(segments, index);
    const row = rowOf(marker, run.chips);
    finishRow(row, segments, run.end);
    return row;
  }

  if (first.type === "gauge") {
    const rest = segments.slice(index + 1);
    const plan: GaugeLayout = {
      type: "gauge-row",
      gauge: { filled: first.filled, total: first.total },
    };
    if (rest.length > 0) plan.rest = rest;
    return plan;
  }

  if (first.type === "mark") {
    const row = rowOf(marker, []);
    row.leadMark = { pass: first.pass };
    finishRow(row, segments, index + 1);
    return row;
  }

  if (first.type === "icon") {
    // An icon-anchored lead-in becomes a badge: icon plus label word, no colon.
    const row = labeledRowFrom(segments, index + 1, marker);
    const word = row.labelText?.replace(/[:\s]+$/u, "");
    delete row.labelText;
    row.leadBadge =
      word !== undefined && word.length > 0 ? { icon: first.name, word } : { icon: first.name };
    return row;
  }

  if (isBoldText(first) && marker !== undefined) {
    return labeledRowFrom(segments, index, marker);
  }

  // Any other bulleted line still gets its glyph marker replaced by the gutter.
  if (marker !== undefined) {
    const row = rowOf(marker, []);
    finishRow(row, segments, index);
    return row;
  }

  return { type: "inline", segments };
}

/** The literal text a parsed line carries: glyphs, paths, and pill labels, in order. */
export function emphasisLineText(line: EmphasisLine): string {
  let text = "";
  for (const segment of line.segments) {
    switch (segment.type) {
      case "text":
      case "code":
      case "tree":
        text += segment.text;
        break;
      case "pill":
        text += segment.label;
        break;
      case "icon":
        break;
      case "arrow":
        text += "→";
        break;
      case "mark":
        text += segment.pass ? "✓" : "✗";
        break;
      case "gauge":
        text +=
          "▰".repeat(segment.filled) + "▱".repeat(Math.max(0, segment.total - segment.filled));
        break;
    }
  }
  return text;
}

/** One chunk line with its planned layout; `layout` is undefined for headings. */
export interface PlannedLine {
  line: EmphasisLine;
  index: number;
  layout: LineLayout | undefined;
}

/** How a chunk's planned lines group for rendering. */
export type LineGroup =
  | { kind: "tree-run"; entries: PlannedLine[] }
  | { kind: "heading"; entry: PlannedLine }
  | { kind: "line"; entry: PlannedLine };

/** Consecutive tree lines coalesce into one monospace panel; anything else breaks the run. */
export function groupTreeEntries(entries: readonly PlannedLine[]): LineGroup[] {
  const groups: LineGroup[] = [];
  let open: PlannedLine[] | undefined;
  const flush = () => {
    if (open !== undefined) {
      groups.push({ kind: "tree-run", entries: open });
      open = undefined;
    }
  };
  for (const entry of entries) {
    if (entry.layout?.type === "tree") {
      (open ??= []).push(entry);
      continue;
    }
    flush();
    groups.push(entry.layout === undefined ? { kind: "heading", entry } : { kind: "line", entry });
  }
  flush();
  return groups;
}
