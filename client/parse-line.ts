import type { EmphasisLine, EmphasisSegment, EmphasisTone } from "../shared/emphasis";
import { CONTEXT_WORDS, VOCABULARY } from "../shared/vocabulary";
import { ACTION_ICONS, LABEL_ICONS, PILL_ICONS, SYNONYMS } from "./emphasis-icons";

const TONE_WORDS: Record<Exclude<EmphasisTone, "neutral">, string[]> = {
  danger: wordsOf("danger"),
  error: wordsOf("error"),
  warning: wordsOf("warning"),
  success: wordsOf("success"),
  mode: wordsOf("mode"),
  owner: wordsOf("owner"),
};

function wordsOf(tone: Exclude<EmphasisTone, "neutral">): string[] {
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

const HEADING = /^( {0,3})(#{1,6})\s+(.*)$/;
/** A bold run qualifies as a lead label only after whitespace or a list marker. */
const LIST_PREFIX = /^\s*(?:[-*+]|\d+\.)?\s*$/;
const INLINE_CODE = /(`+[^`]*?`+)/g;
const ACTION_WORD = /(\p{L}+):$/u;

export function hasDecorations(line: string): boolean {
  if (HEADING.test(line)) return true;
  return /\*\*|__|\[\[|→|[✓✔✗✘]|[├└]──|[▰▱]/.test(line);
}

/** Any GFM table row: header, delimiter, or body cell run. */

interface PillLabel {
  /** Display text: canonical word plus any detail, such as "Passed 12/12". */
  label: string;
  /** Lowercase canonical lookup key driving tone and icon. */
  key: string;
  icon: string | undefined;
}

/** A pill label read as its word: a known word may carry short detail; matching ignores case and extra spaces. */
function splitPillLabel(raw: string): PillLabel {
  const text = raw.replace(/\s+/g, " ").trim();
  const lower = text.toLowerCase();
  const known = KNOWN.find(
    (word) => lower === word || (lower.startsWith(word) && /[ :]/.test(lower[word.length] ?? "")),
  );
  // Only synonyms are redrawn with a new casing; other words keep what the model typed.
  const canonical = known === undefined ? undefined : SYNONYMS[known];
  const detail = known === undefined ? "" : text.slice(known.length);
  const label = known === undefined ? text : (canonical ?? text.slice(0, known.length)) + detail;
  const key = (canonical ?? known ?? lower).toLowerCase();
  return { label, key, icon: PILL_ICONS[key] };
}

function toneOf(key: string): EmphasisTone {
  for (const tone of ["danger", "error", "warning", "success", "mode", "owner"] as const) {
    if (TONE_WORDS[tone].includes(key)) return tone;
  }
  return "neutral";
}

/** Escaped bold markers, bold markers, pills, marks, arrows, and tree connectors. */
const INLINE_TOKEN = /(\\*)(\*\*|__|\[\[([^[\]\n]{1,32})\]\]|→|✓|✔|✗|✘|[├└]──|[▰▱]{2,})/g;
const STAR_BOLD = "**";
const UNDERSCORE_BOLD = "__";

/**
 * Reads one prose line into segments. Code spans split the line and stay literal inside their
 * span; everything else follows pi-emphasis: bold runs keep their weight, pills become chips,
 * marks, arrows, and tree connectors are classified for coloring, and a heading or a sufficient
 * bold run gains an icon from its word.
 */
export function parseLine(line: string): EmphasisLine {
  const headingMatch = line.match(HEADING);
  if (headingMatch) {
    return { heading: headingMatch[2].length, segments: headingSegments(headingMatch) };
  }

  const segments: EmphasisSegment[] = [];
  let trailing = "";
  let bold = false;
  let boldRunStart: number | undefined;
  let boldRunFirstSegment = 0;

  const flush = () => {
    if (trailing.length > 0) segments.push({ type: "text", text: trailing, bold });
    trailing = "";
  };

  const parts = line.split(INLINE_CODE);
  for (let index = 0; index < parts.length; index += 1) {
    // Odd parts are inline code spans, which stay literal.
    if (index % 2 === 1) {
      flush();
      segments.push({ type: "code", text: stripTicks(parts[index] ?? "") });
      boldRunStart = undefined;
      continue;
    }
    const part = parts[index] ?? "";
    let cursor = 0;
    let match: RegExpExecArray | null;
    INLINE_TOKEN.lastIndex = 0;
    while ((match = INLINE_TOKEN.exec(part)) !== null) {
      const whole = match[0];
      const slashes = match[1] ?? "";
      const marker = match[2];
      const pill = match[3];
      trailing += part.slice(cursor, match.index);
      cursor = match.index + whole.length;

      if (slashes.length % 2 === 1) {
        trailing += whole;
        continue;
      }
      flush();
      if (marker === STAR_BOLD || marker === UNDERSCORE_BOLD) {
        if (bold) {
          if (boldRunStart !== undefined) {
            const content = part.slice(boldRunStart, match.index);
            const icon = boldRunIcon(content, leadPosition(segments, boldRunFirstSegment));
            if (icon) segments.splice(boldRunFirstSegment, 0, { type: "icon", name: icon });
          }
          bold = false;
          boldRunStart = undefined;
        } else {
          bold = true;
          boldRunStart = match.index + whole.length;
          boldRunFirstSegment = segments.length;
        }
      } else if (marker.startsWith("[[")) {
        if (pill === undefined || pill.trim().length === 0) {
          segments.push({ type: "text", text: whole, bold });
        } else {
          const split = splitPillLabel(pill);
          segments.push({
            type: "pill",
            label: split.label,
            tone: toneOf(split.key),
            ...(split.icon ? { icon: split.icon } : {}),
          });
        }
      } else if (marker === "→") {
        segments.push({ type: "arrow" });
      } else if (marker === "✓" || marker === "✔") {
        segments.push({ type: "mark", pass: true });
      } else if (marker === "✗" || marker === "✘") {
        segments.push({ type: "mark", pass: false });
      } else if (marker.match(/[▰▱]/)) {
        segments.push({
          type: "gauge",
          filled: (marker.match(/▰/g) ?? []).length,
          total: marker.length,
        });
      } else {
        segments.push({ type: "tree", text: marker });
      }
    }
    trailing += part.slice(cursor);
  }
  // An unclosed bold span (streaming text or literal asterisks) simply ends at the line end.
  flush();
  return { segments: collapse(segments) };
}

/** The icon a bold run takes: an action lead-in by its word anywhere, else a label word in lead position. */
function boldRunIcon(content: string, lead: boolean): string | undefined {
  const trimmed = content.trim();
  if (ACTION_WORD.test(trimmed)) {
    const word = trimmed.match(ACTION_WORD)?.[1]?.toLowerCase() ?? "";
    if (ACTION_ICONS[word]) return ACTION_ICONS[word];
  }
  if (lead) {
    const word = trimmed.replace(/[:\s]+$/, "").toLowerCase();
    return LABEL_ICONS[word];
  }
  return undefined;
}

/** True when nothing but whitespace or a list marker has been emitted so far. */
function leadPosition(segments: EmphasisSegment[], runStart: number): boolean {
  let prefix = "";
  for (const segment of segments.slice(0, runStart)) {
    if (segment.type !== "text") return false;
    prefix += segment.text;
  }
  return LIST_PREFIX.test(prefix);
}

function headingSegments(match: RegExpMatchArray): EmphasisSegment[] {
  const [, , , title] = match;
  const trimmed = title.trim();
  const word = trimmed.replace(/[:\s]+$/, "").toLowerCase();
  const icon = LABEL_ICONS[word] ?? (trimmed.endsWith(":") ? ACTION_ICONS[word] : undefined);
  const segments: EmphasisSegment[] = [];
  if (icon) segments.push({ type: "icon", name: icon });
  segments.push({ type: "text", text: trimmed, bold: true });
  return segments;
}

function stripTicks(span: string): string {
  return span.replace(/^`+/, "").replace(/`+$/, "");
}

/** Merges adjacent same-style text runs so a rendered line holds as few spans as possible. */
function collapse(segments: EmphasisSegment[]): EmphasisSegment[] {
  const merged: EmphasisSegment[] = [];
  for (const segment of segments) {
    const previous = merged.at(-1);
    if (previous?.type === "text" && segment.type === "text" && previous.bold === segment.bold) {
      merged[merged.length - 1] = {
        type: "text",
        text: previous.text + segment.text,
        bold: previous.bold,
      };
    } else {
      merged.push(segment);
    }
  }
  return merged;
}
