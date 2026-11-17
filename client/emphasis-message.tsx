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
import { planLineLayout, type PillSegment } from "./emphasis-layout";

type ThemeColors = PluginTimelineItemProps["theme"]["colors"];
type Platform = PluginTimelineItemProps["layout"]["platform"];

/** A pill's colors, derived from a theme token per tone rather than chosen per word. */
interface ToneVisual {
  background: string;
  foreground: string;
}

/** Translucent pill fills; unknown tones read as neutral, in the body color. */
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

function monospaceFamily(platform: Platform): string {
  return platform === "ios" ? "Menlo" : "monospace";
}

function headingSize(level: number, compact: boolean): number {
  const regular = [24, 21, 17, 15, 14, 14];
  const small = [21, 18, 16, 14, 13, 13];
  return (compact ? small : regular)[level - 1] ?? 14;
}

/** Spacing around a section heading: air above, a tight tie to its content. */
const HEADING_GAP_TOP = 18;
const HEADING_GAP_BOTTOM = 6;
/** Where heading text and section-level rows indent to, past the icon column. */
const SECTION_INDENT = 22;

interface EmphasisStyles {
  message: ViewStyle;
  chunk: ViewStyle;
  leadRow: ViewStyle;
  leadRest: TextStyle;
  sectionRow: ViewStyle;
  line: TextStyle;
  bold: TextStyle;
  code: TextStyle;
  pillInline: TextStyle;
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
  fontSize: number;
}

function buildStyles(theme: ThemeColors, compact: boolean, platform: Platform): EmphasisStyles {
  const fontSize = compact ? 13 : 14;
  return {
    message: {
      gap: compact ? 6 : 8,
      paddingVertical: compact ? 2 : 4,
      paddingHorizontal: compact ? 2 : 4,
      paddingBottom: compact ? 6 : 8,
    },
    chunk: { gap: 2 },
    sectionRow: {
      marginTop: compact ? 14 : HEADING_GAP_TOP,
      marginBottom: compact ? 3 : HEADING_GAP_BOTTOM,
    },
    leadRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    leadRest: { flex: 1 },
    line: { fontSize, color: theme.foreground },
    bold: { fontWeight: "600" },
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
    pillText: { fontSize, fontWeight: "600" },
    copyButton: { alignSelf: "flex-start", padding: 4, opacity: 0.7 },
  };
}

/** A pill drawn as a chip: a row sibling, never a child of a Text. */
function renderChip(segment: PillSegment, kit: RenderKit, key: number): ReactNode {
  const visual = toneVisual(segment.tone, kit.theme.colors);
  return (
    <View key={key} style={[kit.styles.pill, { backgroundColor: visual.background }]}>
      {segment.icon ? (
        <Icon name={segment.icon} size={kit.fontSize - 1} color={visual.foreground} />
      ) : null}
      <Text selectable style={[kit.styles.pillText, { color: visual.foreground }]}>
        {segment.label}
      </Text>
    </View>
  );
}

/**
 * A segment drawn inside flowing text, where pills degrade to colored bold
 * labels and icons are skipped: the parser only emits them at lead positions,
 * which the line-level planner renders as row siblings.
 */
function renderInlineSegment(segment: EmphasisSegment, kit: RenderKit, key: number): ReactNode {
  const { styles, theme } = kit;
  switch (segment.type) {
    case "text":
      return (
        <StreamedText
          key={key}
          text={segment.text}
          phase={kit.phase}
          selectable
          style={segment.bold ? styles.bold : undefined}
        />
      );
    case "code":
      return (
        <Text key={key} style={styles.code}>
          {segment.text}
        </Text>
      );
    case "arrow":
      return (
        <Text key={key} style={{ color: theme.colors.foregroundMuted }}>
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
    case "pill": {
      return (
        <Text
          key={key}
          style={[styles.pillInline, { color: toneVisual(segment.tone, theme.colors).foreground }]}
        >
          {segment.label}
        </Text>
      );
    }
    default:
      return null;
  }
}

function renderInlineLine(segments: EmphasisSegment[], kit: RenderKit, key: number): ReactNode {
  return (
    <Text key={key} selectable style={kit.styles.line}>
      {segments.map((segment, index) => renderInlineSegment(segment, kit, index))}
    </Text>
  );
}

function renderLine(line: EmphasisLine, kit: RenderKit, key: number): ReactNode {
  const { styles, theme } = kit;

  // A section heading: air above, a tight tie to its content, icon as a sibling.
  if (line.heading) {
    const size = headingSize(line.heading, kit.compact);
    const icon = line.segments[0];
    const title = icon?.type === "icon" ? line.segments[1] : icon;
    const text = title?.type === "text" ? title.text : "";
    return (
      <View key={key} style={[styles.sectionRow, styles.leadRow]}>
        {icon?.type === "icon" ? (
          <Icon name={icon.name} size={size - 3} color={theme.colors.accent} />
        ) : null}
        <StreamedText
          text={text}
          phase={kit.phase}
          selectable
          style={[kit.styles.line, { fontSize: size, fontWeight: "600", flex: 1 }]}
        />
      </View>
    );
  }

  const layout = planLineLayout(line.segments);
  if (layout.type === "inline") {
    return renderInlineLine(layout.segments, kit, key);
  }

  return (
    <View
      key={key}
      style={[styles.leadRow, layout.prefixText === "" ? { paddingLeft: SECTION_INDENT } : null]}
    >
      {layout.prefixText.length > 0 ? (
        <Text selectable style={styles.line}>
          {layout.prefixText}
        </Text>
      ) : null}
      {layout.icon ? (
        <Icon name={layout.icon} size={kit.fontSize - 1} color={theme.colors.accent} />
      ) : null}
      {layout.labelText ? (
        <Text selectable style={[styles.line, styles.bold]}>
          {layout.labelText}
        </Text>
      ) : null}
      {layout.chips.map((chip, index) => renderChip(chip, kit, index))}
      {layout.rest && layout.rest.length > 0 ? (
        <Text selectable style={[styles.line, styles.leadRest]}>
          {layout.rest.map((segment, index) => renderInlineSegment(segment, kit, index))}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Draws an assistant message that carries emphasis markup. Decorated lines render through
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
      fontSize: layout.compact ? 13 : 14,
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
