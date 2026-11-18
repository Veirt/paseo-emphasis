import type { EmphasisBlock, EmphasisData, EmphasisLine, EmphasisTable } from "../shared/emphasis";
import { hasDecorations, parseLine } from "./parse-line";
import { parseTableAt } from "./parse-table";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/** Any GFM table row: header, delimiter, or body cell run. */
function isTableRow(line: string): boolean {
  return line.trimStart().startsWith("|");
}

/**
 * The scanner's closed event set, one per source line — except `table`, which
 * a lookahead consumes as a whole. Each event carries exactly the data its
 * transition needs, so a new markdown construct is a compile error until some
 * transition handles it.
 */
type LineEvent =
  | { kind: "fence-open"; line: string; marker: string }
  | { kind: "fence-body"; line: string }
  | { kind: "fence-close"; line: string }
  | { kind: "blank"; line: string }
  | { kind: "prose"; line: string }
  | { kind: "decorated"; line: EmphasisLine }
  | { kind: "table"; table: EmphasisTable; next: number };

/**
 * The scanner's closed state set: which accumulator is open. The fence marker
 * lives in the fenced state itself, so a fenced body line outside a fence, or
 * a decorated line inside one, cannot be built — the classifier cannot name
 * them and the transition table rejects them.
 */
type ScanState =
  | { kind: "empty" }
  | { kind: "markdown-open"; lines: string[] }
  | { kind: "chunk-open"; lines: EmphasisLine[] }
  | { kind: "fence-open"; marker: string; lines: string[] };

/** What one transition yields: the next state and the blocks it finishes. */
interface Step {
  state: ScanState;
  emitted: EmphasisBlock[];
}

/** A finished markdown block, or nothing when the run held only blank lines. */
function markdownBlock(lines: string[]): EmphasisBlock[] {
  if (!lines.some((line) => line.trim().length > 0)) return [];
  return [{ type: "markdown", text: lines.join("\n").replace(/^\n+/, "") }];
}

function chunkBlock(lines: EmphasisLine[]): EmphasisBlock[] {
  if (lines.length === 0) return [];
  return [{ type: "chunk", lines }];
}

/** A state × event cell the classifier cannot produce: a bug, not a case to skip. */
function unexpected(state: ScanState, event: LineEvent): never {
  throw new Error(`scanner transition bug: ${event.kind} in ${state.kind}`);
}

/** Reaching this tail means an event kind was not handled: caught at compile time. */
function unhandled(event: never): never {
  throw new Error(`scanner event bug: ${JSON.stringify(event)}`);
}

/**
 * Classifies one source line against the scanner state. All markdown grammar
 * lives here; it produces exactly one event for every line, so the transition
 * below never inspects raw text again.
 */
function eventAt(lines: readonly string[], index: number, state: ScanState): LineEvent {
  const line = lines[index] ?? "";
  if (state.kind === "fence-open") {
    const close = line.match(FENCE_OPEN);
    if (
      close?.[1] !== undefined &&
      close[1][0] === state.marker[0] &&
      close[1].length >= state.marker.length
    ) {
      return { kind: "fence-close", line };
    }
    return { kind: "fence-body", line };
  }
  const open = line.match(FENCE_OPEN);
  if (open?.[1] !== undefined) return { kind: "fence-open", line, marker: open[1] };
  if (line.trim().length === 0) return { kind: "blank", line };
  if (isTableRow(line)) {
    // A `|`-line opens a table only when a delimiter row follows; otherwise the
    // row stays host markdown, trimmed like any other list-like text.
    const table = parseTableAt(lines, index);
    if (table !== null) return { kind: "table", table: table.table, next: table.next };
    return { kind: "prose", line: line.trimStart() };
  }
  if (hasDecorations(line)) return { kind: "decorated", line: parseLine(line) };
  return { kind: "prose", line };
}

/**
 * The transition table: state × event → next state plus finished blocks.
 * Pure — state and event in, new state and finished blocks out — so scan
 * order and block boundaries are decided in exactly one place.
 */
function transition(state: ScanState, event: LineEvent): Step {
  switch (event.kind) {
    case "fence-open":
      if (state.kind === "empty") {
        return {
          state: { kind: "fence-open", marker: event.marker, lines: [event.line] },
          emitted: [],
        };
      }
      if (state.kind === "markdown-open") {
        return {
          state: { kind: "fence-open", marker: event.marker, lines: [...state.lines, event.line] },
          emitted: [],
        };
      }
      if (state.kind === "chunk-open") {
        return {
          state: { kind: "fence-open", marker: event.marker, lines: [event.line] },
          emitted: chunkBlock(state.lines),
        };
      }
      return unexpected(state, event);
    case "fence-body":
      if (state.kind === "fence-open") {
        return { state: { ...state, lines: [...state.lines, event.line] }, emitted: [] };
      }
      return unexpected(state, event);
    case "fence-close":
      if (state.kind === "fence-open") {
        return {
          state: { kind: "markdown-open", lines: [...state.lines, event.line] },
          emitted: [],
        };
      }
      return unexpected(state, event);
    case "blank":
      if (state.kind === "empty" || state.kind === "markdown-open") {
        const lines = state.kind === "markdown-open" ? [...state.lines, event.line] : [];
        return { state: { kind: "markdown-open", lines }, emitted: [] };
      }
      if (state.kind === "chunk-open") {
        return {
          state: { kind: "markdown-open", lines: [event.line] },
          emitted: chunkBlock(state.lines),
        };
      }
      return unexpected(state, event);
    case "prose":
      if (state.kind === "empty" || state.kind === "markdown-open") {
        // From empty, the line opens the buffer: prose must never be dropped.
        const lines = state.kind === "markdown-open" ? [...state.lines, event.line] : [event.line];
        return { state: { kind: "markdown-open", lines }, emitted: [] };
      }
      if (state.kind === "chunk-open") {
        return {
          state: { kind: "markdown-open", lines: [event.line] },
          emitted: chunkBlock(state.lines),
        };
      }
      return unexpected(state, event);
    case "decorated":
      if (state.kind === "empty" || state.kind === "chunk-open") {
        const lines = state.kind === "chunk-open" ? [...state.lines, event.line] : [event.line];
        return { state: { kind: "chunk-open", lines }, emitted: [] };
      }
      if (state.kind === "markdown-open") {
        return {
          state: { kind: "chunk-open", lines: [event.line] },
          emitted: markdownBlock(state.lines),
        };
      }
      return unexpected(state, event);
    case "table":
      if (state.kind === "empty") {
        return { state, emitted: [{ type: "table", table: event.table }] };
      }
      if (state.kind === "markdown-open") {
        return {
          state: { kind: "empty" },
          emitted: [...markdownBlock(state.lines), { type: "table", table: event.table }],
        };
      }
      if (state.kind === "chunk-open") {
        return {
          state: { kind: "empty" },
          emitted: [...chunkBlock(state.lines), { type: "table", table: event.table }],
        };
      }
      return unexpected(state, event);
  }
  return unhandled(event);
}

/** Blocks still open at end of text; an unclosed fence flushes as markdown. */
function finish(state: ScanState): EmphasisBlock[] {
  if (state.kind === "markdown-open" || state.kind === "fence-open") {
    return markdownBlock(state.lines);
  }
  return chunkBlock(state.kind === "chunk-open" ? state.lines : []);
}

/**
 * Parses assistant markdown into renderable blocks, or returns null when the message carries
 * nothing this plugin decorates, which keeps the built-in renderer and its copy affordance.
 *
 * The scanner below is an explicit state machine: the classifier (`eventAt`) turns each source
 * line into one closed event, the transition table folds events into blocks, and `parseEmphasis`
 * is the edge that runs the fold. Decorated lines become chunk blocks rendered by this plugin;
 * GFM tables become table blocks with segment-parsed cells; plain runs and fenced code stay
 * markdown blocks for the host renderer. Data is render-only: the original markdown travels in
 * `text` so copying always yields the source with `[[...]]` intact.
 */
export function parseEmphasis(markdown: string, phase: EmphasisData["phase"]): EmphasisData | null {
  const lines = markdown.split("\n");
  let state: ScanState = { kind: "empty" };
  const blocks: EmphasisBlock[] = [];
  for (let index = 0; index < lines.length;) {
    const event = eventAt(lines, index, state);
    const step = transition(state, event);
    blocks.push(...step.emitted);
    state = step.state;
    index = event.kind === "table" ? event.next : index + 1;
  }
  blocks.push(...finish(state));

  if (blocks.every((block) => block.type === "markdown")) return null;
  return { text: markdown, phase, blocks };
}
