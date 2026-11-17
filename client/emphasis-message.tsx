import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon, Markdown, StreamedText, copyText, useToast } from "@getpaseo/plugin/client/ui";
import { type ReactNode, useCallback, useMemo } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, Text, View } from "react-native";
import {
  emphasisDataSchema,
  type EmphasisData,
  type EmphasisLine,
  type EmphasisSegment,
  type EmphasisTone,
} from "../shared/emphasis";

type ThemeColors = PluginTimelineItemProps["theme"]["colors"];
type Platform = PluginTimelineItemProps["layout"]["platform"];

/** A pill's colors, derived from a theme token per tone rather than chosen per word. */
interface ToneVisual {
  background: string;
  foreground: string;
}

/** Translucent pill fills, approximated by appending hex alpha to a theme color. */
function tinted(hex: string, alpha255: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  return `${hex}${alpha255.toString(16).padStart(2, "0")}`;
}

function toneVisual(tone: EmphasisTone, colors: ThemeColors): ToneVisual {
  const {
    statusSuccess,
    statusWarning,
    statusDanger,
    accent,
    accentForeground,
    foreground,
    surface0,
  } = colors;
  switch (tone) {
    case "success":
      return { background: tinted(statusSuccess, 0x1f), foreground: statusSuccess };
    case "warning":
      return { background: tinted(statusWarning, 0x26), foreground: statusWarning };
    case "error":
      return { background: tinted(statusDanger, 0x1f), foreground: statusDanger };
    case "danger":
      return { background: statusDanger, foreground: accentForeground };
    case "mode":
      return { background: accent, foreground: accentForeground };
    case "owner":
      return { background: foreground, foreground: surface0 };
    default:
      return { background: tinted(accent, 0x1a), foreground: accent };
  }
}

function monospaceFamily(platform: Platform): string {
  return platform === "ios" ? "Menlo" : "monospace";
}

function headingSize(level: number, compact: boolean): number {
  const regular = [24, 21, 17, 15, 14, 14];
  const small = [21, 18, 16, 14, 13, 13];
  return (compact ? small : regular)[level - 1] ?? 14;
}

interface EmphasisStyles {
  message: ViewStyle;
  chunk: ViewStyle;
  line: TextStyle;
  bold: TextStyle;
  code: TextStyle;
  pill: ViewStyle;
  pillText: TextStyle;
  copyButton: ViewStyle;
}

/** What every segment renderer needs, threaded as one value. */
interface RenderKit {
  styles: EmphasisStyles;
  theme: PluginTimelineItemProps["theme"];
  compact: boolean;
  phase: EmphasisData["phase"];
}

function buildStyles(theme: ThemeColors, compact: boolean, platform: Platform): EmphasisStyles {
  const fontSize = compact ? 13 : 14;
  return {
    message: { gap: compact ? 6 : 8 },
    chunk: { gap: 2 },
    line: { fontSize, color: theme.foreground },
    bold: { color: theme.accent, fontWeight: "600" },
    code: { fontSize, fontFamily: monospaceFamily(platform), color: theme.foregroundMuted },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: compact ? 6 : 7,
      paddingVertical: 1,
    },
    pillText: { fontSize: compact ? 11 : 12, fontWeight: "600" },
    copyButton: { alignSelf: "flex-start", paddingTop: 2, opacity: 0.7 },
  };
}

function renderSegment(segment: EmphasisSegment, kit: RenderKit, key: number): ReactNode {
  const { styles, theme } = kit;
  switch (segment.type) {
    case "text":
      return (
        <StreamedText
          key={key}
          text={segment.text}
          phase={kit.phase}
          style={segment.bold ? [styles.line, styles.bold] : styles.line}
        />
      );
    case "code":
      return (
        <Text key={key} style={styles.code}>
          {segment.text}
        </Text>
      );
    case "icon":
      return <Icon key={key} name={segment.name} size={13} color={theme.colors.accent} />;
    case "arrow":
      return (
        <Text key={key} style={{ color: theme.colors.accent }}>
          →
        </Text>
      );
    case "mark":
      return (
        <Text
          key={key}
          style={{ color: segment.pass ? theme.colors.statusSuccess : theme.colors.statusDanger }}
        >
          {segment.pass ? "✓" : "✗"}
        </Text>
      );
    case "tree":
      return (
        <Text key={key} style={{ color: theme.colors.foregroundMuted }}>
          {segment.text}
        </Text>
      );
    default: {
      const visual = toneVisual(segment.tone, theme.colors);
      return (
        <View key={key} style={[styles.pill, { backgroundColor: visual.background }]}>
          {segment.icon ? <Icon name={segment.icon} size={12} color={visual.foreground} /> : null}
          <Text style={[styles.pillText, { color: visual.foreground }]}>{segment.label}</Text>
        </View>
      );
    }
  }
}

function renderLine(line: EmphasisLine, kit: RenderKit, key: number): ReactNode {
  const lineStyle = line.heading
    ? {
        ...kit.styles.line,
        fontSize: headingSize(line.heading, kit.compact),
        fontWeight: "600" as const,
      }
    : kit.styles.line;
  return (
    <Text key={key} style={lineStyle}>
      {line.segments.map((segment, index) => renderSegment(segment, kit, index))}
    </Text>
  );
}

/**
 * Draws an assistant message that carries pi-emphasis markup. Decorated lines render through
 * this component; plain runs and fenced code delegate to the host Markdown renderer.
 * Rendering only: the copy affordance hands out the original markdown untouched.
 */
export function EmphasisMessage({ item, theme, layout }: PluginTimelineItemProps<EmphasisData>) {
  const data = emphasisDataSchema.parse(item.data);
  const toast = useToast();

  const kit = useMemo<RenderKit>(
    () => ({
      styles: buildStyles(theme.colors, layout.compact, layout.platform),
      theme,
      compact: layout.compact,
      phase: data.phase,
    }),
    [theme, layout, data.phase],
  );

  const handleCopy = useCallback(() => {
    copyText(data.text).catch((error: unknown) => {
      toast.error("Copy failed");
      console.error("emphasis copy failed", error);
    });
  }, [data.text, toast]);

  return (
    <View style={kit.styles.message}>
      {data.blocks.map((block, blockIndex) =>
        block.type === "markdown" ? (
          <Markdown key={blockIndex}>{block.text}</Markdown>
        ) : (
          <View key={blockIndex} style={kit.styles.chunk}>
            {block.lines.map((line, lineIndex) => renderLine(line, kit, lineIndex))}
          </View>
        ),
      )}
      {data.phase === "complete" ? (
        <Pressable
          accessibilityLabel="Copy message markdown"
          accessibilityRole="button"
          hitSlop={8}
          onPress={handleCopy}
          style={kit.styles.copyButton}
        >
          <Icon name="Copy" size={13} color={theme.colors.foregroundMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
