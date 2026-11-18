import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { StyleSheet, type TextStyle, type ViewStyle } from "react-native";
import type { EmphasisTone, GaugeData } from "../shared/emphasis";

type ThemeColors = PluginTimelineItemProps["theme"]["colors"];
type Platform = PluginTimelineItemProps["layout"]["platform"];

/** The marker gutter for lists, matching Paseo's `styles.list.marginLeft`. */
export const LIST_GUTTER = 20;

interface ToneVisual {
  background: string;
  border: string;
  foreground: string;
}

/** Converts a CSS hex or rgb color into an alpha-blended color string. */
export function tinted(color: string, alpha255: number): string {
  const clamped = Math.max(0, Math.min(255, Math.round(alpha255)));
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return `${color}${clamped.toString(16).padStart(2, "0")}`;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1] ?? "0";
    const g = color[2] ?? "0";
    const b = color[3] ?? "0";
    return `#${r}${r}${g}${g}${b}${b}${clamped.toString(16).padStart(2, "0")}`;
  }
  const rgb = color.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const alpha = Math.round((clamped / 255) * 1000) / 1000;
    return `rgba(${rgb[1]}, ${rgb[2]}, ${rgb[3]}, ${alpha})`;
  }
  return color;
}

/**
 * Urgency-calibrated pill colors:
 * - danger: solid fill (irreversible / costs money)
 * - error: clear red tint + strong border (broken / failed / blocked)
 * - warning: amber tint + crisp border (needs you / unverified)
 * - success: calm green tint + subtle border (done / passed / observed)
 * - action: soft accent tint + subtle border (Next / Do / Check / Fix)
 * - mode / owner / neutral: quiet surface2 chips so taxonomy never outshouts errors
 */
export function toneVisual(tone: EmphasisTone, colors: ThemeColors): ToneVisual {
  const {
    statusSuccess,
    statusWarning,
    statusDanger,
    accent,
    accentForeground,
    foreground,
    foregroundMuted,
    surface2,
    border,
  } = colors;
  switch (tone) {
    case "danger":
      return { background: statusDanger, border: statusDanger, foreground: accentForeground };
    case "error":
      return {
        background: tinted(statusDanger, 0x2b),
        border: tinted(statusDanger, 0x70),
        foreground: statusDanger,
      };
    case "warning":
      return {
        background: tinted(statusWarning, 0x24),
        border: tinted(statusWarning, 0x66),
        foreground: statusWarning,
      };
    case "success":
      return {
        background: tinted(statusSuccess, 0x20),
        border: tinted(statusSuccess, 0x52),
        foreground: statusSuccess,
      };
    case "action":
      return {
        background: tinted(accent, 0x1e),
        border: tinted(accent, 0x52),
        foreground: accent,
      };
    case "mode":
      return {
        background: surface2,
        border: tinted(accent, 0x52),
        foreground: accent,
      };
    case "owner":
      return {
        background: surface2,
        border,
        foreground,
      };
    case "neutral":
      return {
        background: surface2,
        border,
        foreground: foregroundMuted,
      };
  }
}

export function ratioToneOf(tone: EmphasisTone, filled: number, total: number): EmphasisTone {
  if (total <= 0 || filled >= total) return tone === "success" ? "success" : tone;
  if (filled <= 0) return tone === "success" ? "error" : "neutral";
  return tone === "success" ? "warning" : tone;
}

export function gaugeTone(gauge: GaugeData): EmphasisTone {
  return ratioToneOf("success", gauge.filled, gauge.total);
}

/** A count of zero is a fact, not an alarm: "Failed 0" reads quiet. */
export const ZERO_COUNT = /(?:^|\s)0$/;

export function parseRatio(label: string): { n: number; d: number } | undefined {
  const match = label.trim().match(/(\d{1,4})\s*\/\s*(\d{1,4})$/);
  if (!match) return undefined;
  const n = Number(match[1]);
  const d = Number(match[2]);
  if (d <= 0 || n > d) return undefined;
  return { n, d };
}

export function markIcon(pass: boolean): string {
  return pass ? "Check" : "X";
}

export function monospaceFamily(platform: Platform): string {
  return platform === "ios" ? "Menlo" : "monospace";
}

/** Matches Paseo's markdown heading scale relative to its 16/17px content size. */
export function headingSize(level: number, compact: boolean): number {
  const regular = [26, 22, 19, 17, 16, 16];
  const small = [24, 21, 18, 16, 15, 15];
  return (compact ? small : regular)[level - 1] ?? 16;
}

interface EmphasisStyles {
  message: ViewStyle;
  blockStack: ViewStyle;
  chipStrip: ViewStyle;
  chipInlineRow: ViewStyle;
  pill: ViewStyle;
  pillText: TextStyle;
  tag: ViewStyle;
  tagText: TextStyle;
  headingRow: ViewStyle;
  headingText: TextStyle;
  list: ViewStyle;
  listRich: ViewStyle;
  listRow: ViewStyle;
  listGutter: ViewStyle;
  listContent: ViewStyle;
  bulletDot: ViewStyle;
  gutterNumber: TextStyle;
  stepperRow: ViewStyle;
  gaugeRow: ViewStyle;
  codePanel: ViewStyle;
  codeLine: TextStyle;
  tableHeaderText: TextStyle;
  copyButton: ViewStyle;
}

export interface RenderKit {
  styles: EmphasisStyles;
  colors: ThemeColors;
  compact: boolean;
  iconSize: number;
}

export function buildStyles(
  theme: ThemeColors,
  compact: boolean,
  platform: Platform,
): EmphasisStyles {
  const chipFontSize = compact ? 12.5 : 13.5;
  return {
    message: {
      gap: compact ? 8 : 10,
      paddingVertical: compact ? 4 : 6,
    },
    blockStack: {
      gap: compact ? 4 : 6,
    },
    chipStrip: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: compact ? 5 : 6,
    },
    chipInlineRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: compact ? 6 : 8,
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      paddingHorizontal: compact ? 8 : 9,
      paddingVertical: compact ? 2 : 3,
    },
    pillText: {
      fontSize: chipFontSize,
      fontWeight: "600",
      fontVariant: ["tabular-nums"],
    },
    tag: {
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface2,
      paddingHorizontal: compact ? 6 : 7,
      paddingVertical: compact ? 1.5 : 2,
    },
    tagText: {
      fontSize: compact ? 11.5 : 12,
      fontWeight: "600",
      color: theme.foregroundMuted,
      letterSpacing: 0.25,
    },
    headingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: compact ? 6 : 8,
      marginTop: compact ? 4 : 6,
    },
    headingText: {
      flex: 1,
      fontWeight: "700",
      color: theme.foreground,
    },
    list: {
      gap: compact ? 5 : 6,
    },
    listRich: {
      gap: compact ? 10 : 12,
    },
    listRow: {
      flexDirection: "row",
      alignItems: "flex-start",
    },
    listGutter: {
      width: LIST_GUTTER,
      alignItems: "flex-start",
    },
    listContent: {
      flex: 1,
      minWidth: 0,
      gap: compact ? 4 : 5,
    },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
      backgroundColor: theme.foregroundMuted,
      marginLeft: 6,
      marginTop: compact ? 9 : 10,
    },
    gutterNumber: {
      width: LIST_GUTTER,
      paddingRight: 5,
      fontSize: compact ? 14 : 15,
      lineHeight: compact ? 20 : 22,
      color: theme.foregroundMuted,
      fontVariant: ["tabular-nums"],
      textAlign: "right",
    },
    stepperRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: compact ? 5 : 6,
    },
    gaugeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    codePanel: {
      backgroundColor: theme.surface2,
      borderColor: theme.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: 8,
      padding: compact ? 10 : 12,
      gap: 2,
    },
    codeLine: {
      fontSize: compact ? 12 : 13,
      lineHeight: compact ? 17 : 19,
      fontFamily: monospaceFamily(platform),
      color: theme.foreground,
    },
    tableHeaderText: {
      fontWeight: "600",
    },
    copyButton: {
      alignSelf: "flex-start",
      padding: 4,
      opacity: 0.75,
    },
  };
}
