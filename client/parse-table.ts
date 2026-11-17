import type { EmphasisAlign, EmphasisLine } from "../shared/emphasis";
import { parseLine } from "./parse-line";

/** A GFM delimiter cell: optional outer colons around one or more dashes. */
const DELIMITER_CELL = /^:?-{1,}:?$/;
/** Header/delimiter split on unescaped pipes; first and last entries are the outside gutters. */
const CELL_SPLIT = /(?<!\\)\|/g;

/** Splits one row into cells, unescaping `\|`. Trims the outside gutters. */
function cellsOf(row: string): string[] {
  const parts = row.split(CELL_SPLIT);
  return parts.slice(1, -1).map((cell) => cell.replace(/\\\|/g, "|").trim());
}

function alignOf(cell: string): EmphasisAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "none";
}

/**
 * Parses a GFM table starting at `lines[start]` (header row) with a delimiter
 * row at `lines[start + 1]`. Returns the table block's lines and the index of
 * the first line after the table, or null when the pair is not a table.
 */
export function parseTableAt(
  lines: readonly string[],
  start: number,
): {
  table: { aligns: EmphasisAlign[]; header: EmphasisLine[]; rows: EmphasisLine[][] };
  next: number;
} | null {
  const headerRow = lines[start]?.trim();
  const delimiterRow = lines[start + 1]?.trimStart();
  if (headerRow === undefined || !headerRow.startsWith("|")) return null;

  const delimiterCells = delimiterRow !== undefined ? cellsOf(delimiterRow) : [];
  if (delimiterRow === undefined || delimiterCells.length === 0) return null;
  if (!delimiterCells.every((cell) => DELIMITER_CELL.test(cell))) return null;

  const header = cellsOf(headerRow);
  const columnCount = Math.max(header.length, delimiterCells.length);
  const aligns = Array.from({ length: columnCount }, (_, column) =>
    alignOf(delimiterCells[column] ?? "---"),
  );

  const bodyRows: EmphasisLine[][] = [];
  let index = start + 2;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || line.trim().length === 0) break;
    if (!line.trimStart().startsWith("|")) break;
    const cells = cellsOf(line.trimStart());
    const row = Array.from({ length: columnCount }, (_, column) => parseLine(cells[column] ?? ""));
    bodyRows.push(row);
    index += 1;
  }

  return {
    table: {
      aligns,
      header: header.map((cell) => parseLine(cell)),
      rows: bodyRows,
    },
    next: index,
  };
}
