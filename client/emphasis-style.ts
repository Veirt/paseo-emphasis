import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import type { EmphasisData, EmphasisTone, Gauge } from "../shared/emphasis";
import type { TextStyle, ViewStyle } from "react-native";

/**
 * The visual vocabulary shared by every emphasis renderer: theme-tone mapping,
 * ratio semantics, and the style sheet. Pure values - no JSX - so both leaf
 * parts and structure rows speak the same tokens.
 */

type ThemeColors = PluginTimelineItemProps["theme"]["colors"];
type Platform = PluginTimelineItemProps["layout"]["platform"];

/** The marker gutter every row hangs its markers into; text aligns past it. */
export const GUTTER = 22;

/** Spacing around a section heading: air above, a tight tie to its content. */
const HEADING_GAP_TOP = 18;
const HEADING_GAP_BOTTOM = 6;

/** A pill's colors, derived from a theme token per tone rather than chosen per word. */
interface ToneVisual {
  background: string;
  foreground: string;
}

/** Translucent pill fills; unknown tones read as neutral, in the body color. */
export function tinted(hex: string, alpha255: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return `${hex}${alpha255.toString(16).padStart(2, "0")}`;
}

export function toneVisual(tone: EmphasisTone, colors: ThemeColors): ToneVisual {
  const {
    statusSuccess,
    statusWarning,
    statusDanger,
    accent,
    accentForeground,
    foreground,
    surface1,
  } = colors;
  switch (tone) {
    case "success":
      return { background: tinted(statusSuccess, 0x2e), foreground: statusSuccess };
    case "warning":
      return { background: tinted(statusWarning, 0x33), foreground: statusWarning };
    case "error":
      return { background: tinted(statusDanger, 0x2e), foreground: statusDanger };
    case "danger":
      return { background: statusDanger, foreground: accentForeground };
    case "mode":
      return { background: accent, foreground: accentForeground };
    case "owner":
      return { background: foreground, foreground: surface1 };
    default:
      return { background: tinted(foreground, 0x1f), foreground };
  }
}

/**
 * The tone a ratio chip takes, computed from the data: a full ratio keeps the
 * word's tone, a partial success dims to warning, and a zero inverts - nothing
 * passed is alarming, nothing failed is quiet.
 */
export function ratioToneOf(tone: EmphasisTone, filled: number, total: number): EmphasisTone {
  if (total <= 0 || filled >= total) return tone === "success" ? "success" : tone;
  if (filled <= 0) return tone === "success" ? "error" : "neutral";
  return tone === "success" ? "warning" : tone;
}

export function gaugeTone(gauge: Gauge): EmphasisTone {
  return ratioToneOf("success", gauge.filled, gauge.total);
}

/** A count of zero is a fact, not an alarm: "Failed 0" reads quiet. */
export const ZERO_COUNT = /(?:^|\s)0$/;

/** A label like "Passed 12/12"; malformed ratios leave the label alone. */
export function parseRatio(label: string): { n: number; d: number } | undefined {
  const match = label.trim().match(/(\d{1,4})\s*\/\s*(\d{1,4})$/);
  if (!match) return undefined;
  const n = Number(match[1]);
  const d = Number(match[2]);
  if (d <= 0 || n > d) return undefined;
  return { n, d };
}

/** The Lucide icon for a ✓/✗ mark. */
export function markIcon(pass: boolean): string {
  return pass ? "Check" : "X";
}

export function monospaceFamily(platform: Platform): string {
  return platform === "ios" ? "Menlo" : "monospace";
}

export function headingSize(level: number, compact: boolean): number {
  const regular = [24, 21, 17, 15, 14, 14];
  const small = [21, 18, 16, 14, 13, 13];
  return (compact ? small : regular)[level - 1] ?? 14;
}

interface EmphasisStyles {
  message: ViewStyle;
  chunk: ViewStyle;
  row: ViewStyle;
  gutter: ViewStyle;
  content: ViewStyle;
  callout: ViewStyle;
  codePanel: ViewStyle;
  codeLine: TextStyle;
  sectionRow: ViewStyle;
  leadRest: TextStyle;
  line: TextStyle;
  bold: TextStyle;
  leadLabel: TextStyle;
  gutterNumber: TextStyle;
  tabularText: TextStyle;
  code: TextStyle;
  pillInline: TextStyle;
  pill: ViewStyle;
  pillText: TextStyle;
  stepperRow: ViewStyle;
  copyButton: ViewStyle;
}

/** What every segment renderer needs, threaded as one value. */
export interface RenderKit {
  styles: EmphasisStyles;
  colors: ThemeColors;
  compact: boolean;
  phase: EmphasisData["phase"];
  fontSize: number;
  gutterMode: boolean;
}

export function buildStyles(
  theme: ThemeColors,
  compact: boolean,
  platform: Platform,
): EmphasisStyles {
  const fontSize = compact ? 13 : 14;
  return {
    message: {
      gap: compact ? 6 : 8,
      paddingVertical: compact ? 2 : 4,
      paddingHorizontal: compact ? 2 : 4,
      paddingBottom: compact ? 6 : 8,
    },
    chunk: { gap: 2 },
    row: { flexDirection: "row" },
    gutter: { width: GUTTER },
    content: { flexDirection: "row", flex: 1, gap: 8 },
    callout: { borderLeftWidth: 2, borderLeftColor: tinted(theme.foreground, 0x30) },
    codePanel: {
      backgroundColor: theme.surface2,
      borderColor: theme.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: compact ? 8 : 12,
      gap: 1,
    },
    codeLine: {
      fontSize: compact ? 12 : 13,
      fontFamily: monospaceFamily(platform),
      color: theme.foreground,
    },
    sectionRow: {
      marginTop: compact ? 14 : HEADING_GAP_TOP,
      marginBottom: compact ? 3 : HEADING_GAP_BOTTOM,
      flexDirection: "row",
      alignItems: "center",
    },
    leadRest: { flex: 1 },
    line: { fontSize, color: theme.foreground },
    bold: { fontWeight: "600" },
    leadLabel: { fontSize, fontWeight: "600", color: theme.foreground },
    gutterNumber: {
      fontSize,
      color: theme.foregroundMuted,
      fontVariant: ["tabular-nums"],
      textAlign: "right",
    },
    tabularText: { fontSize, fontVariant: ["tabular-nums"] },
    code: { fontSize, fontFamily: monospaceFamily(platform), color: theme.foregroundMuted },
    pillInline: { fontWeight: "600" },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: compact ? 8 : 10,
      paddingVertical: 2,
    },
    pillText: { fontSize, fontWeight: "600", fontVariant: ["tabular-nums"] },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 6,
      flex: 1,
    },
    copyButton: { alignSelf: "flex-start", padding: 4, opacity: 0.7 },
  };
}
