import type {
  EmphasisBlock,
  EmphasisData,
  EmphasisTable,
  ListItem,
  StepData,
} from "../shared/emphasis";
import { parseTableAt } from "./parse-table";
import {
  extractLeadPrefix,
  isShortInlineBody,
  isTreeLine,
  normalizeInlinePills,
  parseGaugePrefix,
  parseIconHeading,
  parseStepperLine,
} from "./parse-tokens";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const THEMATIC_BREAK = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const BLOCKQUOTE_LINE = /^ {0,3}>/;
const HEADING_PREFIX = /^ {0,3}#{1,6}(?:\s|$)/;
const TASK_LIST_LINE = /^ {0,3}(?:[-*+]|\d{1,9}[.)])\s+\[[ xX]\]\s/;
const BULLET_ITEM = /^( {0,3})([-*+])(\s+)(.*)$/;
const ORDERED_ITEM = /^( {0,3})(\d{1,9})([.)])(\s+)(.*)$/;

type ListKind = "bullet" | "ordered";

interface RawListItem {
  markerLabel: string;
  contentIndent: number;
  firstLine: string;
  continuation: string[];
}

interface ListOpener {
  kind: ListKind;
  markerLabel: string;
  indent: number;
  contentIndent: number;
  firstLine: string;
}

function matchListStart(line: string): ListOpener | null {
  if (THEMATIC_BREAK.test(line) || TASK_LIST_LINE.test(line)) return null;
  const bullet = line.match(BULLET_ITEM);
  if (bullet) {
    const spaces = (bullet[1] ?? "").length;
    const indent = spaces + (bullet[2] ?? "").length + (bullet[3] ?? "").length;
    return {
      kind: "bullet",
      markerLabel: bullet[2] ?? "-",
      indent: spaces,
      contentIndent: indent,
      firstLine: bullet[4] ?? "",
    };
  }
  const ordered = line.match(ORDERED_ITEM);
  if (ordered) {
    const spaces = (ordered[1] ?? "").length;
    const digits = ordered[2] ?? "1";
    const punct = ordered[3] ?? ".";
    const indent = spaces + digits.length + punct.length + (ordered[4] ?? "").length;
    return {
      kind: "ordered",
      markerLabel: `${digits}${punct}`,
      indent: spaces,
      contentIndent: indent,
      firstLine: ordered[5] ?? "",
    };
  }
  return null;
}

function leadingSpaces(line: string): number {
  let count = 0;
  while (count < line.length && line[count] === " ") count += 1;
  return count;
}

function dedent(line: string, spaces: number): string {
  if (line.trim().length === 0) return "";
  let strip = 0;
  while (strip < spaces && strip < line.length && line[strip] === " ") strip += 1;
  return line.slice(strip);
}

function startsBlock(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (line.trim().length === 0) return true;
  if (FENCE_OPEN.test(line) || THEMATIC_BREAK.test(line)) return true;
  if (BLOCKQUOTE_LINE.test(line) || HEADING_PREFIX.test(line)) return true;
  if (isTreeLine(line)) return true;
  if (matchListStart(line) !== null) return true;
  if (line.trimStart().startsWith("|") && parseTableAt(lines, index) !== null) return true;
  return false;
}

/**
 * Collects a contiguous or loose top-level list block. Returns null when no item
 * uses emphasis triggers so the entire nested list stays untouched in `<Markdown>`.
 */
function consumeListAt(
  lines: readonly string[],
  start: number,
):
  | { block: Extract<EmphasisBlock, { type: "list" }>; next: number }
  | { block: null; next: number } {
  const opener = matchListStart(lines[start] ?? "");
  if (opener === null) return { block: null, next: start };

  const startNumber = opener.kind === "ordered" ? Number(opener.markerLabel.slice(0, -1)) : 1;
  const rawItems: RawListItem[] = [];
  let index = start;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const itemStart = matchListStart(line);
    if (
      itemStart === null ||
      itemStart.kind !== opener.kind ||
      itemStart.indent >= opener.contentIndent
    ) {
      break;
    }

    const item: RawListItem = {
      markerLabel: itemStart.markerLabel,
      contentIndent: itemStart.contentIndent,
      firstLine: itemStart.firstLine,
      continuation: [],
    };
    rawItems.push(item);
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index] ?? "";
      if (nextLine.trim().length === 0) {
        // A blank line stays inside the list only if an indented continuation or sibling item follows.
        let lookahead = index + 1;
        while (lookahead < lines.length && (lines[lookahead] ?? "").trim().length === 0) {
          lookahead += 1;
        }
        if (lookahead >= lines.length || lookahead > index + 1) break;
        const afterBlank = lines[lookahead] ?? "";
        if (leadingSpaces(afterBlank) >= item.contentIndent) {
          item.continuation.push("");
          index += 1;
          continue;
        }
        const sibling = matchListStart(afterBlank);
        if (
          sibling !== null &&
          sibling.kind === opener.kind &&
          sibling.indent < opener.contentIndent
        ) {
          index = lookahead;
          break;
        }
        break;
      }

      const indent = leadingSpaces(nextLine);
      if (indent >= item.contentIndent) {
        item.continuation.push(dedent(nextLine, item.contentIndent));
        index += 1;
        continue;
      }
      if (startsBlock(lines, index)) break;
      item.continuation.push(nextLine);
      index += 1;
    }
  }

  let hasDecoratedItem = false;
  const items: ListItem[] = rawItems.map((raw) => {
    const lead = extractLeadPrefix(raw.firstLine);
    const bodyLines = [lead !== null ? lead.rest : raw.firstLine, ...raw.continuation];
    const bodyText = normalizeInlinePills(bodyLines.join("\n").trim()).text;
    if (lead !== null) {
      hasDecoratedItem = true;
      const item: ListItem = { chips: lead.chips, body: bodyText };
      if (opener.kind === "ordered") item.markerLabel = raw.markerLabel;
      if (lead.tag !== undefined) item.tag = lead.tag;
      if (lead.leadMark !== undefined) item.leadMark = lead.leadMark;
      return item;
    }
    const item: ListItem = { chips: [], body: bodyText };
    if (opener.kind === "ordered") item.markerLabel = raw.markerLabel;
    return item;
  });

  if (!hasDecoratedItem) return { block: null, next: index };

  const omitMarkers =
    opener.kind === "bullet" &&
    items.every((item) => item.chips.length > 0 || item.leadMark !== undefined);

  return {
    block: {
      type: "list",
      ordered: opener.kind === "ordered",
      start: Number.isFinite(startNumber) ? startNumber : 1,
      omitMarkers,
      items,
    },
    next: index,
  };
}

function isParagraphBreak(lines: readonly string[], index: number): boolean {
  const line = lines[index] ?? "";
  if (startsBlock(lines, index)) return true;
  const trimmed = line.trim();
  if (parseStepperLine(trimmed) !== null) return true;
  if (parseGaugePrefix(trimmed) !== null) return true;
  if (extractLeadPrefix(trimmed) !== null) return true;
  return false;
}

function collectParagraphContinuation(
  lines: readonly string[],
  start: number,
): {
  extra: string[];
  next: number;
} {
  const extra: string[] = [];
  let index = start;
  while (index < lines.length) {
    if (isParagraphBreak(lines, index)) break;
    extra.push(lines[index] ?? "");
    index += 1;
  }
  return { extra, next: index };
}

/**
 * The scanner's closed event set. Every event carries its next line index so the
 * fold advances uniformly without mutating a cursor inside transitions.
 */
type LineEvent =
  | { kind: "fence-open"; line: string; marker: string; next: number }
  | { kind: "fence-body"; line: string; next: number }
  | { kind: "fence-close"; line: string; next: number }
  | { kind: "blank"; line: string; next: number }
  | { kind: "tree"; line: string; next: number }
  | { kind: "heading"; level: number; icon: string; title: string; next: number }
  | { kind: "stepper"; steps: StepData[]; next: number }
  | { kind: "gauge"; gauge: { filled: number; total: number }; body: string; next: number }
  | { kind: "chips"; block: Extract<EmphasisBlock, { type: "chips" }>; next: number }
  | { kind: "list"; block: Extract<EmphasisBlock, { type: "list" }>; next: number }
  | { kind: "table"; table: EmphasisTable; next: number }
  | { kind: "markdown-lines"; lines: string[]; next: number };

/**
 * The scanner's closed state set. `fence-open` isolates code blocks so emphasis
 * tokens inside fences are impossible to interpret; `tree-open` coalesces
 * consecutive tree lines into one panel.
 */
type ScanState =
  | { kind: "empty" }
  | { kind: "markdown-open"; lines: string[] }
  | { kind: "tree-open"; lines: string[] }
  | { kind: "fence-open"; marker: string; lines: string[] };

interface Step {
  state: ScanState;
  emitted: EmphasisBlock[];
}

function markdownBlock(lines: readonly string[]): { blocks: EmphasisBlock[]; normalized: boolean } {
  if (!lines.some((line) => line.trim().length > 0)) return { blocks: [], normalized: false };
  const raw = lines.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
  if (raw.length === 0) return { blocks: [], normalized: false };
  const { text, changed } = normalizeInlinePills(raw);
  return { blocks: [{ type: "markdown", text }], normalized: changed };
}

function treeBlock(lines: string[]): EmphasisBlock[] {
  if (lines.length === 0) return [];
  return [{ type: "tree", lines }];
}

function unexpected(state: ScanState, event: LineEvent): never {
  throw new Error(`scanner transition bug: ${event.kind} in ${state.kind}`);
}

function unhandled(event: never): never {
  throw new Error(`scanner event bug: ${JSON.stringify(event)}`);
}

function eventAt(lines: readonly string[], index: number, state: ScanState): LineEvent {
  const line = lines[index] ?? "";

  if (state.kind === "fence-open") {
    const close = line.match(FENCE_OPEN);
    if (
      close?.[1] !== undefined &&
      close[1][0] === state.marker[0] &&
      close[1].length >= state.marker.length &&
      line.slice(close[0].length).trim().length === 0
    ) {
      return { kind: "fence-close", line, next: index + 1 };
    }
    return { kind: "fence-body", line, next: index + 1 };
  }

  const open = line.match(FENCE_OPEN);
  if (open?.[1] !== undefined) {
    return { kind: "fence-open", line, marker: open[1], next: index + 1 };
  }

  if (line.trim().length === 0) {
    return { kind: "blank", line, next: index + 1 };
  }

  if (THEMATIC_BREAK.test(line) || BLOCKQUOTE_LINE.test(line)) {
    return { kind: "markdown-lines", lines: [line], next: index + 1 };
  }

  if (isTreeLine(line)) {
    return { kind: "tree", line, next: index + 1 };
  }

  if (line.trimStart().startsWith("|")) {
    const table = parseTableAt(lines, index);
    if (table !== null) return { kind: "table", table: table.table, next: table.next };
  }

  if (HEADING_PREFIX.test(line)) {
    const heading = parseIconHeading(line);
    if (heading !== null) {
      return {
        kind: "heading",
        level: heading.level,
        icon: heading.icon,
        title: heading.title,
        next: index + 1,
      };
    }
    return { kind: "markdown-lines", lines: [line], next: index + 1 };
  }

  if (matchListStart(line) !== null) {
    const list = consumeListAt(lines, index);
    if (list.block !== null) {
      return { kind: "list", block: list.block, next: list.next };
    }
    return { kind: "markdown-lines", lines: lines.slice(index, list.next), next: list.next };
  }

  // Avoid stealing 4-space indented code blocks unless they sit inside a non-code block.
  if (leadingSpaces(line) >= 4 && state.kind === "empty") {
    return { kind: "markdown-lines", lines: [line], next: index + 1 };
  }

  const trimmed = line.trim();
  const stepper = parseStepperLine(trimmed);
  if (stepper !== null) {
    return { kind: "stepper", steps: stepper, next: index + 1 };
  }

  const gauge = parseGaugePrefix(trimmed);
  if (gauge !== null) {
    const cont = collectParagraphContinuation(lines, index + 1);
    const body = normalizeInlinePills([gauge.rest, ...cont.extra].join("\n").trim()).text;
    return { kind: "gauge", gauge: gauge.gauge, body, next: cont.next };
  }

  const lead = extractLeadPrefix(trimmed);
  if (lead !== null) {
    const cont = collectParagraphContinuation(lines, index + 1);
    const rawBody = [lead.rest, ...cont.extra].join("\n").trim();
    const body = rawBody.length > 0 ? normalizeInlinePills(rawBody).text : undefined;
    const block: Extract<EmphasisBlock, { type: "chips" }> = {
      type: "chips",
      chips: lead.chips,
    };
    if (lead.tag !== undefined) block.tag = lead.tag;
    if (body !== undefined) {
      block.body = body;
      if (isShortInlineBody(body, lead.tag !== undefined, lead.chips.length)) {
        block.inline = true;
      }
    }
    if (lead.leadMark !== undefined) {
      return {
        kind: "list",
        block: {
          type: "list",
          ordered: false,
          start: 1,
          omitMarkers: false,
          items: [{ chips: [], leadMark: lead.leadMark, body: body ?? "" }],
        },
        next: cont.next,
      };
    }
    return { kind: "chips", block, next: cont.next };
  }

  return { kind: "markdown-lines", lines: [line], next: index + 1 };
}

function flushOpenState(state: ScanState): { blocks: EmphasisBlock[]; normalized: boolean } {
  if (state.kind === "markdown-open" || state.kind === "fence-open") {
    return markdownBlock(state.lines);
  }
  if (state.kind === "tree-open") {
    return { blocks: treeBlock(state.lines), normalized: false };
  }
  return { blocks: [], normalized: false };
}

function emitBlock(state: ScanState, block: EmphasisBlock): { step: Step; normalized: boolean } {
  const flushed = flushOpenState(state);
  return {
    step: { state: { kind: "empty" }, emitted: [...flushed.blocks, block] },
    normalized: flushed.normalized,
  };
}

function transition(state: ScanState, event: LineEvent): { step: Step; normalized: boolean } {
  switch (event.kind) {
    case "fence-open":
      if (state.kind === "empty") {
        return {
          step: {
            state: { kind: "fence-open", marker: event.marker, lines: [event.line] },
            emitted: [],
          },
          normalized: false,
        };
      }
      if (state.kind === "markdown-open") {
        return {
          step: {
            state: {
              kind: "fence-open",
              marker: event.marker,
              lines: [...state.lines, event.line],
            },
            emitted: [],
          },
          normalized: false,
        };
      }
      if (state.kind === "tree-open") {
        return {
          step: {
            state: { kind: "fence-open", marker: event.marker, lines: [event.line] },
            emitted: treeBlock(state.lines),
          },
          normalized: false,
        };
      }
      return unexpected(state, event);

    case "fence-body":
      if (state.kind === "fence-open") {
        return {
          step: { state: { ...state, lines: [...state.lines, event.line] }, emitted: [] },
          normalized: false,
        };
      }
      return unexpected(state, event);

    case "fence-close":
      if (state.kind === "fence-open") {
        return {
          step: {
            state: { kind: "markdown-open", lines: [...state.lines, event.line] },
            emitted: [],
          },
          normalized: false,
        };
      }
      return unexpected(state, event);

    case "blank":
      if (state.kind === "empty" || state.kind === "markdown-open") {
        const lines = state.kind === "markdown-open" ? [...state.lines, event.line] : [];
        return {
          step: { state: { kind: "markdown-open", lines }, emitted: [] },
          normalized: false,
        };
      }
      if (state.kind === "tree-open") {
        return {
          step: { state: { kind: "empty" }, emitted: treeBlock(state.lines) },
          normalized: false,
        };
      }
      return unexpected(state, event);

    case "tree":
      if (state.kind === "tree-open") {
        return {
          step: { state: { kind: "tree-open", lines: [...state.lines, event.line] }, emitted: [] },
          normalized: false,
        };
      }
      if (state.kind === "empty" || state.kind === "markdown-open") {
        const flushed = flushOpenState(state);
        return {
          step: {
            state: { kind: "tree-open", lines: [event.line] },
            emitted: flushed.blocks,
          },
          normalized: flushed.normalized,
        };
      }
      return unexpected(state, event);

    case "markdown-lines":
      if (state.kind === "empty" || state.kind === "markdown-open") {
        const lines =
          state.kind === "markdown-open" ? [...state.lines, ...event.lines] : [...event.lines];
        return {
          step: { state: { kind: "markdown-open", lines }, emitted: [] },
          normalized: false,
        };
      }
      if (state.kind === "tree-open") {
        return {
          step: {
            state: { kind: "markdown-open", lines: [...event.lines] },
            emitted: treeBlock(state.lines),
          },
          normalized: false,
        };
      }
      return unexpected(state, event);

    case "heading":
      return emitBlock(state, {
        type: "heading",
        level: event.level,
        icon: event.icon,
        title: event.title,
      });

    case "stepper":
      return emitBlock(state, { type: "stepper", steps: event.steps });

    case "gauge": {
      const block: Extract<EmphasisBlock, { type: "gauge" }> = {
        type: "gauge",
        gauge: event.gauge,
      };
      if (event.body.length > 0) block.body = event.body;
      return emitBlock(state, block);
    }

    case "chips":
      return emitBlock(state, event.block);

    case "list":
      return emitBlock(state, event.block);

    case "table":
      return emitBlock(state, { type: "table", table: event.table });
  }
  return unhandled(event);
}

const QUICK_TRIGGER_GLYPH = /(?:\[\[|→|[✓✔✗✘▰▱]|[├└]──)/;
const QUICK_HEADING = /^ {0,3}#{1,6}\s/m;
const QUICK_ACTION_COLON = /(?:\*\*|__)[A-Za-z]+(?::(?:\*\*|__)|(?:\*\*|__):)/;

function mayHaveEmphasis(markdown: string): boolean {
  return (
    QUICK_TRIGGER_GLYPH.test(markdown) ||
    QUICK_HEADING.test(markdown) ||
    QUICK_ACTION_COLON.test(markdown)
  );
}

/**
 * Parses assistant markdown into renderable blocks, or returns null when the message carries
 * nothing this plugin decorates (keeping Paseo's built-in `AssistantMessage` and turn footer).
 */
export function parseEmphasis(markdown: string, phase: EmphasisData["phase"]): EmphasisData | null {
  if (!mayHaveEmphasis(markdown)) return null;
  const lines = markdown.split("\n");
  let state: ScanState = { kind: "empty" };
  const blocks: EmphasisBlock[] = [];
  let anyNormalized = false;

  for (let index = 0; index < lines.length;) {
    const event = eventAt(lines, index, state);
    const { step, normalized } = transition(state, event);
    blocks.push(...step.emitted);
    if (normalized) anyNormalized = true;
    state = step.state;
    index = event.next;
  }
  const tail = flushOpenState(state);
  blocks.push(...tail.blocks);
  if (tail.normalized) anyNormalized = true;

  if (!anyNormalized && blocks.every((block) => block.type === "markdown")) return null;
  return { text: markdown, phase, blocks };
}
