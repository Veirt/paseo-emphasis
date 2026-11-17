import type { EmphasisData, EmphasisLine } from "../shared/emphasis";
import { hasDecorations, parseLine } from "./parse-line";
import { parseTableAt } from "./parse-table";

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

/** Any GFM table row: header, delimiter, or body cell run. */
function isTableRow(line: string): boolean {
  return line.trimStart().startsWith("|");
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
  const blocks: EmphasisData["blocks"] = [];
  let plain: string[] = [];
  let chunk: EmphasisLine[] = [];
  let fence: string | undefined;

  const flushPlain = () => {
    if (plain.some((line) => line.trim().length > 0)) {
      blocks.push({ type: "markdown", text: plain.join("\n").replace(/^\n+/, "") });
    }
    plain = [];
  };
  const flushChunk = () => {
    if (chunk.length === 0) return;
    blocks.push({ type: "chunk", lines: chunk });
    chunk = [];
  };

  const lines = markdown.split("\n");
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    const fenceMatch = line.match(FENCE_OPEN);
    if (fence) {
      plain.push(line);
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) {
        fence = undefined;
      }
      index += 1;
      continue;
    }
    if (fenceMatch) {
      flushChunk();
      fence = fenceMatch[1];
      plain.push(line);
      index += 1;
      continue;
    }
    if (line.trim().length === 0) {
      flushChunk();
      plain.push(line);
      index += 1;
      continue;
    }
    if (isTableRow(line)) {
      // A `|`-line pair opens a table only when a delimiter row follows; otherwise the row
      // stays host markdown. Either way a decorated row must not split its table.
      const table = parseTableAt(lines, index);
      if (table !== null) {
        flushChunk();
        flushPlain();
        blocks.push({ type: "table", table: table.table });
        index = table.next;
        continue;
      }
      flushChunk();
      plain.push(line.trimStart());
      index += 1;
      continue;
    }
    if (hasDecorations(line)) {
      flushPlain();
      chunk.push(parseLine(line));
      index += 1;
      continue;
    }
    flushChunk();
    plain.push(line);
    index += 1;
  }
  flushPlain();
  flushChunk();

  if (blocks.every((block) => block.type === "markdown")) return null;
  return { text: markdown, phase, blocks };
}
