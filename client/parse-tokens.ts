import type { EmphasisTone, GaugeData, PillData, StepData, TagData } from "../shared/emphasis";
import { CONTEXT_WORDS, VOCABULARY } from "../shared/vocabulary";
import { ACTION_ICONS, LABEL_ICONS, PILL_ICONS, SYNONYMS } from "./emphasis-icons";

const TONE_WORDS: Record<Exclude<EmphasisTone, "neutral" | "action">, string[]> = {
  danger: wordsOf("danger"),
  error: wordsOf("error"),
  warning: wordsOf("warning"),
  success: wordsOf("success"),
  mode: wordsOf("mode"),
  owner: wordsOf("owner"),
};

function wordsOf(tone: Exclude<EmphasisTone, "neutral" | "action">): string[] {
  return [...VOCABULARY[tone].core, ...VOCABULARY[tone].also].map((word) => word.toLowerCase());
}

const KNOWN = [
  ...new Set([
    ...Object.values(TONE_WORDS).flat(),
    ...Object.keys(PILL_ICONS),
    ...Object.keys(SYNONYMS),
    ...CONTEXT_WORDS.map((word) => word.toLowerCase()),
  ]),
].sort((a, b) => b.length - a.length);

export function toneOf(key: string): EmphasisTone {
  for (const tone of ["danger", "error", "warning", "success", "mode", "owner"] as const) {
    if (TONE_WORDS[tone].includes(key)) return tone;
  }
  return "neutral";
}

/** Parses one `[[...]]` pill label: canonicalizes synonyms and attaches its tone and icon. */
export function parsePill(raw: string): PillData {
  const text = raw.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const known = KNOWN.find(
    (word) => lower === word || (lower.startsWith(word) && /[ :]/.test(lower[word.length] ?? "")),
  );
  const canonical = known === undefined ? undefined : SYNONYMS[known];
  const detail = known === undefined ? "" : text.slice(known.length);
  const label = known === undefined ? text : (canonical ?? text.slice(0, known.length)) + detail;
  const key = (canonical ?? known ?? lower).toLowerCase();
  const icon = PILL_ICONS[key];
  const pill: PillData = { label, tone: toneOf(key) };
  if (icon !== undefined) pill.icon = icon;
  return pill;
}

/** Parses an explicit action lead-in word (`Do:`, `Next:`, `Check:`, `Fix:`, etc.) into an action chip. */
export function parseActionBadge(word: string): PillData | undefined {
  const trimmed = word.trim();
  const key = trimmed.toLowerCase();
  const icon = ACTION_ICONS[key];
  if (icon === undefined) return undefined;
  return { label: trimmed, tone: "action", icon };
}

const HEADING_LINE = /^ {0,3}(#{1,6})\s+(.*)$/;

/**
 * Recognizes a plain heading whose title maps to a Lucide icon (`## Status`).
 * Headings with inline markdown links, code spans, or pills return null so Paseo
 * `<Markdown>` renders them with full fidelity.
 */
export function parseIconHeading(
  line: string,
): { level: number; icon: string; title: string } | null {
  const match = line.match(HEADING_LINE);
  if (!match) return null;
  const level = match[1]?.length ?? 1;
  const title = (match[2] ?? "").trim();
  if (title.length === 0) return null;
  if (/[`[\]]|\*\*|__|~~/.test(title)) return null;
  const word = title.replace(/[:\s]+$/u, "").toLowerCase();
  const icon = LABEL_ICONS[word] ?? (title.endsWith(":") ? ACTION_ICONS[word] : undefined);
  if (icon === undefined) return null;
  return { level, icon, title };
}

const STEP_TOKEN = /^[A-Za-z0-9][A-Za-z0-9./+@_-]{0,23}$/;
const SOLE_PILL = /^\[\[([^[\]\n]{1,32})\]\]$/;

/** Parses an arrow chain (`setup → build → test ✓`) into stepper steps, or null for prose. */
export function parseStepperLine(line: string): StepData[] | null {
  if (!line.includes("→") || line.includes("`")) return null;
  const parts = line.split("→");
  if (parts.length < 2) return null;

  const steps: StepData[] = [];
  for (const rawPart of parts) {
    let token = rawPart.trim();
    if (token.length === 0) return null;

    let pass: boolean | undefined;
    const trailingMark = token.match(/^(.*?)\s*([✓✔✗✘])$/);
    if (trailingMark) {
      pass = trailingMark[2] === "✓" || trailingMark[2] === "✔";
      token = (trailingMark[1] ?? "").trim();
    } else {
      const leadingMark = token.match(/^([✓✔✗✘])\s*(.*)$/);
      if (leadingMark) {
        pass = leadingMark[1] === "✓" || leadingMark[1] === "✔";
        token = (leadingMark[2] ?? "").trim();
      }
    }
    if (token.length === 0) return null;

    const pillMatch = token.match(SOLE_PILL);
    if (pillMatch?.[1] !== undefined && pillMatch[1].trim().length > 0) {
      const pill = parsePill(pillMatch[1]);
      const step: StepData = { label: pill.label, tone: pill.tone };
      if (pill.icon !== undefined) step.icon = pill.icon;
      if (pass !== undefined) step.pass = pass;
      steps.push(step);
      continue;
    }

    if (!STEP_TOKEN.test(token)) return null;
    const step: StepData = { label: token, tone: "neutral" };
    if (pass !== undefined) step.pass = pass;
    steps.push(step);
  }
  return steps;
}

const TREE_LINE = /^((?:│ {1,3}|\| {1,3}| {2,4})*)([├└]──.*)$/;

/** True when a line opens with tree rail prefixes followed by `├──` or `└──`. */
export function isTreeLine(line: string): boolean {
  return TREE_LINE.test(line);
}

const GAUGE_PREFIX = /^([▰▱]{2,})(?:\s+(.*))?$/;

/** Parses a line opening with a `▰▱` gauge run into structured gauge data + tail markdown. */
export function parseGaugePrefix(line: string): { gauge: GaugeData; rest: string } | null {
  const match = line.match(GAUGE_PREFIX);
  if (!match?.[1]) return null;
  const run = match[1];
  const filled = (run.match(/▰/g) ?? []).length;
  return {
    gauge: { filled, total: run.length },
    rest: (match[2] ?? "").trim(),
  };
}

export interface LeadPrefix {
  chips: PillData[];
  tag?: TagData;
  leadMark?: boolean;
  rest: string;
}

const PRE_PILL_TAG_COLON_INSIDE =
  /^(\*\*|__)([A-Za-z][A-Za-z0-9._-]{0,18}(?:\s+[A-Za-z0-9._-]{1,12})?):\1\s*(?=\[\[)/;
const PRE_PILL_TAG_SEP =
  /^(\*\*|__)?([A-Za-z][A-Za-z0-9._-]{0,18}(?:\s+[A-Za-z0-9._-]{1,12})?)\s*[—–:-]\s*(\*\*|__)?\s*(?=\[\[)/;
const LEADING_PILL = /^\[\[([^[\]\n]{1,32})\]\]\s*/;
const ACTION_COLON_INSIDE = /^(\*\*|__)([A-Za-z]+):\1(?:\s+(.*))?$/;
const ACTION_COLON_OUTSIDE = /^(\*\*|__)([A-Za-z]+)\1:(?:\s+(.*))?$/;
const MARK_PREFIX = /^([✓✔✗✘])\s+(.+)$/;

function collectPillRun(line: string, start: number): { chips: PillData[]; cursor: number } {
  const chips: PillData[] = [];
  let cursor = start;
  while (cursor < line.length) {
    const pillMatch = line.slice(cursor).match(LEADING_PILL);
    if (!pillMatch || pillMatch[1] === undefined || pillMatch[1].trim().length === 0) break;
    chips.push(parsePill(pillMatch[1]));
    cursor += pillMatch[0].length;
  }
  return { chips, cursor };
}

/**
 * Extracts leading `[[Pill]]` strips (with optional short pre-pill tag like `BLOCKER —`
 * or `**Status:**`), explicit action ask badges (`**Next:**`, `**Do:**`, `**Check:**`,
 * `**Fix:**`, ...), or leading `✓`/`✗` marks from the start of a line. Any bold marker left
 * open by stripping the prefix is re-balanced on the remaining markdown so `<Markdown>`
 * never sees broken `**`.
 */
export function extractLeadPrefix(rawLine: string): LeadPrefix | null {
  const line = rawLine.trimStart();

  // 1. Action ask badge (`**Next:** ...`, `**Do:** ...`, `**Check:** ...`)
  const actionMatch = line.match(ACTION_COLON_INSIDE) ?? line.match(ACTION_COLON_OUTSIDE);
  if (actionMatch?.[2] !== undefined) {
    const badge = parseActionBadge(actionMatch[2]);
    if (badge !== undefined) {
      const rawRest = (actionMatch[3] ?? "").trim();
      const extra = collectPillRun(rawRest, 0);
      const rest = rawRest.slice(extra.cursor).trimStart();
      return { chips: [badge, ...extra.chips], rest };
    }
  }

  // 2. Leading status mark (`✓ ...` or `✗ ...`)
  const markMatch = line.match(MARK_PREFIX);
  if (markMatch?.[1] && markMatch[2] && !markMatch[2].includes("→")) {
    const pass = markMatch[1] === "✓" || markMatch[1] === "✔";
    return { chips: [], leadMark: pass, rest: markMatch[2].trim() };
  }

  // 3. Leading `[[Pill]]`s (optionally preceded by a short tag such as `BLOCKER —` or `**Status:**`)
  let cursor = 0;
  let openBold: "**" | "__" | undefined;
  let tag: TagData | undefined;

  const insideColonMatch = line.match(PRE_PILL_TAG_COLON_INSIDE);
  if (insideColonMatch?.[2]) {
    tag = { label: insideColonMatch[2].trim(), tone: "neutral" };
    cursor = insideColonMatch[0].length;
  } else {
    const tagMatch = line.match(PRE_PILL_TAG_SEP);
    if (tagMatch?.[2]) {
      const opener = tagMatch[1];
      const closer = tagMatch[3];
      if (opener === "**" || opener === "__") {
        if (closer !== opener) openBold = opener;
      } else if (closer === "**" || closer === "__") {
        openBold = closer;
      }
      tag = { label: tagMatch[2].trim(), tone: "neutral" };
      cursor = tagMatch[0].length;
    } else if (line.startsWith("**[[") || line.startsWith("__[[")) {
      openBold = line.startsWith("**") ? "**" : "__";
      cursor = 2;
    }
  }

  const run = collectPillRun(line, cursor);
  if (run.chips.length === 0) return null;

  let rest = line.slice(run.cursor);
  if (openBold !== undefined) {
    if (rest.startsWith(openBold)) {
      rest = rest.slice(openBold.length).trimStart();
    } else if (rest.trim().length > 0) {
      rest = `${openBold}${rest.trimStart()}`;
    }
  } else {
    rest = rest.trimStart();
  }

  const result: LeadPrefix = { chips: run.chips, rest };
  if (tag !== undefined) result.tag = tag;
  return result;
}

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;

function inlinePillFallback(raw: string, insideBold: boolean): string {
  const pill = parsePill(raw);
  let prefix = "";
  if (pill.tone === "error") prefix = "✕ ";
  else if (pill.tone === "warning" || pill.tone === "danger") prefix = "⚠ ";
  else if (pill.tone === "success") prefix = "✓ ";
  const text = `${prefix}${pill.label}`;
  return insideBold ? text : `**${text}**`;
}

/**
 * Replaces mid-prose `[[Word]]` pills in markdown strings destined for `<Markdown>` so
 * raw `[[...]]` syntax never leaks, while leaving fenced code, inline code spans, and
 * backslash escapes (`\[[`) untouched.
 */
export function normalizeInlinePills(markdown: string): { text: string; changed: boolean } {
  if (!markdown.includes("[[")) return { text: markdown, changed: false };
  const lines = markdown.split("\n");
  let fenceMarker: string | undefined;
  let boldMarker: "**" | "__" | undefined;
  let changed = false;
  const output: string[] = [];

  for (const line of lines) {
    const fenceMatch = line.match(FENCE_OPEN);
    if (fenceMarker !== undefined) {
      if (
        fenceMatch?.[1] !== undefined &&
        fenceMatch[1][0] === fenceMarker[0] &&
        fenceMatch[1].length >= fenceMarker.length
      ) {
        fenceMarker = undefined;
      }
      output.push(line);
      continue;
    }
    if (fenceMatch?.[1] !== undefined) {
      fenceMarker = fenceMatch[1];
      boldMarker = undefined;
      output.push(line);
      continue;
    }
    if (line.trim().length === 0) {
      boldMarker = undefined;
      output.push(line);
      continue;
    }

    const result = normalizeLineInlinePills(line, boldMarker);
    boldMarker = result.boldMarker;
    if (result.changed) changed = true;
    output.push(result.text);
  }

  return { text: output.join("\n"), changed };
}

function normalizeLineInlinePills(
  line: string,
  initialBold: "**" | "__" | undefined,
): { text: string; boldMarker: "**" | "__" | undefined; changed: boolean } {
  let out = "";
  let index = 0;
  let boldMarker = initialBold;
  let changed = false;

  while (index < line.length) {
    const ch = line[index];
    // Preserve backslash escapes (`\[[` or `\**` or `\``).
    if (ch === "\\" && index + 1 < line.length) {
      out += line.slice(index, index + 2);
      index += 2;
      continue;
    }
    // Skip inline code spans of any backtick run length.
    if (ch === "`") {
      let tickEnd = index;
      while (line[tickEnd] === "`") tickEnd += 1;
      const ticks = line.slice(index, tickEnd);
      const closeIndex = findClosingTicks(line, tickEnd, ticks.length);
      if (closeIndex !== -1) {
        out += line.slice(index, closeIndex + ticks.length);
        index = closeIndex + ticks.length;
        continue;
      }
      out += ticks;
      index = tickEnd;
      continue;
    }
    if (
      (line.startsWith("**", index) || line.startsWith("__", index)) &&
      (boldMarker === undefined || line.startsWith(boldMarker, index))
    ) {
      const marker = line.startsWith("**", index) ? "**" : "__";
      boldMarker = boldMarker === undefined ? marker : undefined;
      out += marker;
      index += 2;
      continue;
    }
    if (line.startsWith("[[", index)) {
      const close = line.indexOf("]]", index + 2);
      if (close !== -1 && close - (index + 2) <= 32) {
        const inner = line.slice(index + 2, close);
        if (inner.trim().length > 0 && !inner.includes("[") && !inner.includes("\n")) {
          out += inlinePillFallback(inner, boldMarker !== undefined);
          changed = true;
          index = close + 2;
          continue;
        }
      }
    }
    out += ch;
    index += 1;
  }
  return { text: out, boldMarker, changed };
}

function findClosingTicks(text: string, from: number, length: number): number {
  let cursor = from;
  while (cursor < text.length) {
    if (text[cursor] === "`") {
      let end = cursor;
      while (text[end] === "`") end += 1;
      if (end - cursor === length) return cursor;
      cursor = end;
      continue;
    }
    cursor += 1;
  }
  return -1;
}

/** True when a short single-line tail can safely share a baseline row with one leading chip. */
export function isShortInlineBody(body: string, hasTag: boolean, chipCount: number): boolean {
  if (hasTag || chipCount !== 1) return false;
  if (body.length === 0 || body.length > 44) return false;
  if (/[\n`[\]*_~<>]/.test(body)) return false;
  return true;
}
