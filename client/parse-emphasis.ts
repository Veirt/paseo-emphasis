import type { EmphasisData, EmphasisBlock, EmphasisLine, EmphasisTable } from "../shared/emphasis";
import { hasDecorations, parseLine } from "./parse-line";
import { parseTableAt } from "./parse-table";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/** Any GFM table row: header, delimiter, or body cell run. */
function isTableRow(line: string): boolean {
  return line.trimStart().startsWith("|");
}

/**
 * The scanner's closed event set. One event per source line — except `table`,
 * which a lookahead consumes as a whole — carrying exactly the data its
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
 * One scanner run: what was emitted, the two open accumulators, and the open
 * fence marker. `fence` gates which events the classifier can produce, so no
 * other combination of buffers can be invalid.
 */
interface Reader {
  blocks: EmphasisBlock[];
  /** Verbatim source lines (plain prose or fenced code) pending a markdown block. */
  markdown: string[];
  /** Decorated lines pending a chunk block. */
  chunk: EmphasisLine[];
  fence: string | undefined;
}

/** Opens the accumulated markdown block, unless it held only blank lines. */
function flushMarkdown(reader: Reader): void {
  if (reader.markdown.some((line) => line.trim().length > 0)) {
    reader.blocks.push({
      type: "markdown",
      text: reader.markdown.join("\n").replace(/^\n+/, ""),
    });
  }
  reader.markdown = [];
}

/** Opens the accumulated chunk block, if any decorated lines are pending. */
function flushChunk(reader: Reader): void {
  if (reader.chunk.length === 0) return;
  reader.blocks.push({ type: "chunk", lines: reader.chunk });
  reader.chunk = [];
}

/**
 * Classifies one source line against the scanner state. All markdown grammar
 * lives here; it produces exactly one event for every line, so the transition
 * below never inspects raw text again.
 */
function eventAt(lines: readonly string[], index: number, reader: Reader): LineEvent {
  const line = lines[index] ?? "";
  if (reader.fence !== undefined) {
    const close = line.match(FENCE_OPEN);
    if (
      close?.[1] !== undefined &&
      close[1][0] === reader.fence[0] &&
      close[1].length >= reader.fence.length
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
 * The one transition: where each event's payload goes. Blank lines and fences
 * keep the markdown run open, decorated lines open a chunk, a table closes
 * both. Effect-free apart from these buffers, so scan order and flushing are
 * decided in exactly one place.
 */
function transition(reader: Reader, event: LineEvent): void {
  switch (event.kind) {
    case "fence-open":
      flushChunk(reader);
      reader.fence = event.marker;
      reader.markdown.push(event.line);
      break;
    case "fence-body":
      reader.markdown.push(event.line);
      break;
    case "fence-close":
      reader.markdown.push(event.line);
      reader.fence = undefined;
      break;
    case "blank":
      flushChunk(reader);
      reader.markdown.push(event.line);
      break;
    case "table":
      flushChunk(reader);
      flushMarkdown(reader);
      reader.blocks.push({ type: "table", table: event.table });
      break;
    case "decorated":
      flushMarkdown(reader);
      reader.chunk.push(event.line);
      break;
    case "prose":
      flushChunk(reader);
      reader.markdown.push(event.line);
      break;
  }
}

/**
 * Parses assistant markdown into renderable blocks, or returns null when the message carries
 * nothing this plugin decorates, which keeps the built-in renderer and its copy affordance.
 *
 * Decorated lines become chunk blocks rendered by this plugin; GFM tables become table blocks
 * with segment-parsed cells; plain runs and fenced code stay markdown blocks for the host
 * renderer. Data is render-only: the original markdown travels in `text` so copying always
 * yields the source with `[[...]]` intact.
 */
export function parseEmphasis(markdown: string, phase: EmphasisData["phase"]): EmphasisData | null {
  const lines = markdown.split("\n");
  const reader: Reader = { blocks: [], markdown: [], chunk: [], fence: undefined };
  for (let index = 0; index < lines.length;) {
    const event = eventAt(lines, index, reader);
    transition(reader, event);
    index = event.kind === "table" ? event.next : index + 1;
  }
  flushMarkdown(reader);
  flushChunk(reader);

  if (reader.blocks.every((block) => block.type === "markdown")) return null;
  return { text: markdown, phase, blocks: reader.blocks };
}
