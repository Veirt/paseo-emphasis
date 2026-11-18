import type { EmphasisAlign, EmphasisTable, TableCell } from "../shared/emphasis";
import {
  extractLeadPrefix,
  normalizeInlinePills,
  parseGaugePrefix,
  parseStepperLine,
} from "./parse-tokens";

/** A GFM delimiter cell: optional outer colons around one or more dashes. */
const DELIMITER_CELL = /^:?-{1,}:?$/;

/** Splits one pipe-delimited row into trimmed cell strings, respecting `\|` and `` `...` ``. */
export function splitTableCells(rawRow: string): string[] {
  let row = rawRow.trim();
  if (row.startsWith("|")) row = row.slice(1);
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1);

  const cells: string[] = [];
  let current = "";
  let index = 0;
  let codeTicks = 0;

  while (index < row.length) {
    const ch = row[index];
    if (ch === "\\" && index + 1 < row.length) {
      if (row[index + 1] === "|") {
        current += "|";
        index += 2;
        continue;
      }
      current += row.slice(index, index + 2);
      index += 2;
      continue;
    }
    if (ch === "`") {
      let end = index;
      while (row[end] === "`") end += 1;
      const count = end - index;
      if (codeTicks === 0) codeTicks = count;
      else if (codeTicks === count) codeTicks = 0;
      current += row.slice(index, end);
      index = end;
      continue;
    }
    if (ch === "|" && codeTicks === 0) {
      cells.push(current.trim());
      current = "";
      index += 1;
      continue;
    }
    current += ch;
    index += 1;
  }
  cells.push(current.trim());
  return cells;
}

function alignOf(cell: string): EmphasisAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return "none";
}

const TRAILING_MARK = /^(.*?)\s*([✓✔✗✘])$/;

function parseTableCell(rawCell: string): { cell: TableCell; decorated: boolean } {
  const trimmed = rawCell.trim();
  if (trimmed.length === 0) {
    return { cell: { kind: "markdown", text: "" }, decorated: false };
  }

  const stepper = parseStepperLine(trimmed);
  if (stepper !== null) {
    return { cell: { kind: "stepper", steps: stepper }, decorated: true };
  }

  const gauge = parseGaugePrefix(trimmed);
  if (gauge !== null) {
    const cell: TableCell = { kind: "gauge", gauge: gauge.gauge };
    if (gauge.rest.length > 0) cell.text = normalizeInlinePills(gauge.rest).text;
    return { cell, decorated: true };
  }

  const lead = extractLeadPrefix(trimmed);
  if (lead !== null) {
    if (lead.leadMark !== undefined) {
      const cell: TableCell = { kind: "mark", pass: lead.leadMark };
      if (lead.rest.length > 0) cell.text = normalizeInlinePills(lead.rest).text;
      return { cell, decorated: true };
    }
    if (lead.chips.length > 0 && lead.tag === undefined && lead.chips[0]?.tone !== "action") {
      const cell: TableCell = { kind: "chips", chips: lead.chips };
      if (lead.rest.length > 0) cell.text = normalizeInlinePills(lead.rest).text;
      return { cell, decorated: true };
    }
  }

  if (!trimmed.includes("`")) {
    const trailing = trimmed.match(TRAILING_MARK);
    if (trailing?.[2] !== undefined) {
      const pass = trailing[2] === "✓" || trailing[2] === "✔";
      const label = (trailing[1] ?? "").trim();
      const cell: TableCell = { kind: "mark", pass };
      if (label.length > 0) cell.text = normalizeInlinePills(label).text;
      return { cell, decorated: true };
    }
  }

  const normalized = normalizeInlinePills(trimmed);
  return { cell: { kind: "markdown", text: normalized.text }, decorated: normalized.changed };
}

/**
 * Parses a GFM table starting at `lines[start]` (header row) with a delimiter
 * row at `lines[start + 1]`. Returns null if the pair is not a table OR if no
 * cell contains emphasis markup (leaving plain GFM tables to Paseo `<Markdown>`).
 */
export function parseTableAt(
  lines: readonly string[],
  start: number,
): { table: EmphasisTable; next: number } | null {
  const headerRaw = lines[start]?.trim();
  const delimiterRaw = lines[start + 1]?.trim();
  if (headerRaw === undefined || !headerRaw.startsWith("|")) return null;
  if (delimiterRaw === undefined || !delimiterRaw.startsWith("|")) return null;

  const delimiterCells = splitTableCells(delimiterRaw);
  if (delimiterCells.length === 0) return null;
  if (!delimiterCells.every((cell) => DELIMITER_CELL.test(cell))) return null;

  const rawHeader = splitTableCells(headerRaw);
  const columnCount = Math.max(rawHeader.length, delimiterCells.length);
  if (rawHeader.length !== delimiterCells.length && rawHeader.length === 0) return null;

  const aligns = Array.from({ length: columnCount }, (_, column) =>
    alignOf(delimiterCells[column] ?? "---"),
  );

  let hasEmphasis = false;
  const header: TableCell[] = Array.from({ length: columnCount }, (_, column) => {
    const parsed = parseTableCell(rawHeader[column] ?? "");
    if (parsed.decorated) hasEmphasis = true;
    return parsed.cell;
  });

  const rows: TableCell[][] = [];
  let index = start + 2;
  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || line.trim().length === 0) break;
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("|")) break;
    const rawCells = splitTableCells(trimmed);
    const row: TableCell[] = Array.from({ length: columnCount }, (_, column) => {
      const parsed = parseTableCell(rawCells[column] ?? "");
      if (parsed.decorated) hasEmphasis = true;
      return parsed.cell;
    });
    rows.push(row);
    index += 1;
  }

  if (!hasEmphasis) return null;
  return { table: { aligns, header, rows }, next: index };
}
