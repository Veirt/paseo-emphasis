import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon, Markdown, StreamedText, copyText, useToast } from "@getpaseo/plugin/client/ui";
import { Fragment, type ReactNode, useCallback, useMemo } from "react";
import type { TextStyle, ViewStyle } from "react-native";
import { Pressable, Text, View } from "react-native";
import {
  emphasisDataSchema,
  type EmphasisData,
  type EmphasisLine,
  type EmphasisSegment,
  type EmphasisTone,
} from "../shared/emphasis";
import {
  planLineLayout,
  type Gauge,
  type GaugeLayout,
  type ListMarker,
  type RowLayout,
  type StepperLayout,
  type TreeLayout,
} from "./emphasis-layout";

type ThemeColors = PluginTimelineItemProps["theme"]["colors"];
type Platform = PluginTimelineItemProps["layout"]["platform"];

/** The marker gutter every row hangs its markers into; text aligns past it. */
const GUTTER = 22;
/** Horizontal distance between tree rail levels; node text reaches the body column at depth 0. */
const RAIL_STEP = 16;
/** A rail is drawn this far into its column. */
const RAIL_INSET = 3;

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

/**
 * The tone a ratio chip takes, computed from the data: a full ratio keeps the
 * word's tone, a partial success dims to warning, and a zero inverts - nothing
 * passed is alarming, nothing failed is quiet.
 */
function ratioToneOf(tone: EmphasisTone, filled: number, total: number): EmphasisTone {
  if (total <= 0 || filled >= total) return tone === "success" ? "success" : tone;
  if (filled <= 0) return tone === "success" ? "error" : "neutral";
  return tone === "success" ? "warning" : tone;
}

/** A count of zero is a fact, not an alarm: "Failed 0" reads quiet. */
const ZERO_COUNT = /(?:^|\s)0$/;

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

interface EmphasisStyles {
  message: ViewStyle;
  chunk: ViewStyle;
  row: ViewStyle;
  gutter: ViewStyle;
  content: ViewStyle;
  callout: ViewStyle;
  rail: ViewStyle;
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
interface RenderKit {
  styles: EmphasisStyles;
  colors: ThemeColors;
  compact: boolean;
  phase: EmphasisData["phase"];
  fontSize: number;
  gutterMode: boolean;
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
    row: { flexDirection: "row" },
    gutter: { width: GUTTER },
    content: { flexDirection: "row", flex: 1, gap: 8 },
    callout: { borderLeftWidth: 2, borderLeftColor: tinted(theme.foreground, 0x30) },
    rail: { width: RAIL_STEP, flexDirection: "row", alignSelf: "stretch" },
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

/**
 * A rendered progress bar: discrete segments for small totals, a continuous
 * fill beyond them. Replaces the ▰▱ gauge glyphs, which relied on a grid.
 */
function MiniBar({
  gauge,
  width,
  height,
  color,
  track,
  maxSegments,
}: {
  gauge: Gauge;
  width: number;
  height: number;
  color: string;
  track: string;
  maxSegments: number;
}) {
  const total = Math.max(gauge.total, 0);
  if (total > 0 && total <= maxSegments) {
    const segment = (width - (total - 1) * 1.5) / total;
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 1.5 }}>
        {Array.from({ length: total }, (_, index) => (
          <View
            key={index}
            style={{
              width: segment,
              height,
              borderRadius: 1,
              backgroundColor: index < gauge.filled ? color : track,
            }}
          />
        ))}
      </View>
    );
  }
  const ratio = total > 0 ? Math.min(1, gauge.filled / total) : 0;
  return (
    <View
      style={{
        width,
        height,
        borderRadius: height / 2,
        backgroundColor: track,
        overflow: "hidden",
      }}
    >
      <View
        style={{ width: `${Math.round(ratio * 100)}%`, height: "100%", backgroundColor: color }}
      />
    </View>
  );
}

function gaugeTone(gauge: Gauge): EmphasisTone {
  return ratioToneOf("success", gauge.filled, gauge.total);
}

/** A pill drawn as a chip: a row sibling, never a child of a Text. */
function renderChip(
  segment: { label: string; tone: EmphasisTone; icon?: string },
  kit: RenderKit,
  key: number,
): ReactNode {
  const zero = ZERO_COUNT.test(segment.label.trim());
  const ratio = parseRatio(segment.label);
  const tone = ratio
    ? ratioToneOf(segment.tone, ratio.n, ratio.d)
    : zero
      ? "neutral"
      : segment.tone;
  const visual = toneVisual(tone, kit.colors);
  return (
    <View key={key} style={[kit.styles.pill, { backgroundColor: visual.background }]}>
      {segment.icon ? (
        <Icon name={segment.icon} size={kit.fontSize - 1} color={visual.foreground} />
      ) : null}
      <Text selectable style={[kit.styles.pillText, { color: visual.foreground }]}>
        {segment.label}
      </Text>
      {ratio ? (
        <MiniBar
          gauge={{ filled: ratio.n, total: ratio.d }}
          width={34}
          height={4}
          color={visual.foreground}
          track={tinted(visual.foreground, 0x30)}
          maxSegments={10}
        />
      ) : null}
    </View>
  );
}

/** A label like "Passed 12/12"; malformed ratios leave the label alone. */
function parseRatio(label: string): { n: number; d: number } | undefined {
  const match = label.trim().match(/(\d{1,4})\s*\/\s*(\d{1,4})$/);
  if (!match) return undefined;
  const n = Number(match[1]);
  const d = Number(match[2]);
  if (d <= 0 || n > d) return undefined;
  return { n, d };
}

function markIcon(pass: boolean): string {
  return pass ? "Check" : "X";
}

/**
 * A segment drawn inside flowing text, where pills degrade to colored bold
 * labels and gauges degrade to ratio text: only text may nest in text, so
 * component-shaped markup is lifted to row slots by the planner.
 */
function renderInlineSegment(segment: EmphasisSegment, kit: RenderKit, key: number): ReactNode {
  const { styles, colors } = kit;
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
        <Text key={key} style={{ color: colors.foregroundMuted }} accessibilityLabel="then">
          →
        </Text>
      );
    case "mark":
      return (
        <Text
          key={key}
          style={{ color: segment.pass ? colors.statusSuccess : colors.statusDanger }}
          accessibilityLabel={segment.pass ? "passed" : "failed"}
        >
          {segment.pass ? "✓" : "✗"}
        </Text>
      );
    case "gauge": {
      const tone = gaugeTone({ filled: segment.filled, total: segment.total });
      return (
        <Text
          key={key}
          style={[styles.tabularText, { color: toneVisual(tone, kit.colors).foreground }]}
        >
          {`${segment.filled}/${segment.total}`}
        </Text>
      );
    }
    case "tree":
      return (
        <Text key={key} style={{ color: colors.foregroundMuted }}>
          {segment.text}
        </Text>
      );
    case "pill":
      return (
        <Text
          key={key}
          selectable
          style={[styles.pillInline, { color: toneVisual(segment.tone, kit.colors).foreground }]}
        >
          {segment.label}
        </Text>
      );
    default:
      return null;
  }
}

function renderInlineLine(segments: EmphasisSegment[], kit: RenderKit, key: string): ReactNode {
  return (
    <Text
      key={key}
      selectable
      style={[kit.styles.line, kit.gutterMode ? { paddingLeft: GUTTER } : null]}
    >
      {segments.map((segment, index) => renderInlineSegment(segment, kit, index))}
    </Text>
  );
}

/** A gutter marker drawn by the planner: a dot, a number, or a lead icon. */
function renderGutterMarker(
  marker: ListMarker | undefined,
  icon: string | undefined,
  leadMark: { pass: boolean } | undefined,
  kit: RenderKit,
): ReactNode {
  const { colors, fontSize, styles } = kit;
  if (icon !== undefined) {
    return (
      <View style={{ marginTop: 3 }}>
        <Icon name={icon} size={fontSize - 1} color={colors.foregroundMuted} />
      </View>
    );
  }
  if (leadMark !== undefined) {
    return (
      <View style={{ marginTop: 3 }}>
        <Icon
          name={markIcon(leadMark.pass)}
          size={fontSize - 1}
          color={leadMark.pass ? colors.statusSuccess : colors.statusDanger}
        />
      </View>
    );
  }
  if (marker?.kind === "number") {
    return (
      <Text
        selectable
        numberOfLines={1}
        ellipsizeMode="clip"
        style={[styles.gutterNumber, { width: GUTTER + 4, paddingRight: 4 }]}
      >
        {marker.label}
      </Text>
    );
  }
  if (marker?.kind === "bullet") {
    return (
      <View
        style={{
          width: 5,
          height: 5,
          borderRadius: 2.5,
          backgroundColor: colors.foregroundMuted,
          marginLeft: 6,
          marginTop: Math.round(fontSize * 0.46),
        }}
      />
    );
  }
  return null;
}

function renderRow(layout: RowLayout, kit: RenderKit, key: string): ReactNode {
  const { styles } = kit;
  // Chip-led rows keep no gutter marker: the chip is the marker.
  const chipLead =
    rowHasNoLead(layout) && layout.chips.length > 0 && layout.labelText === undefined;
  const callout = (layout.icon !== undefined || layout.leadMark !== undefined) && !layout.marker;
  const labelSpans = layout.labelText !== undefined;
  return (
    <View key={key} style={[styles.row, callout ? styles.callout : null]}>
      {chipLead ? null : (
        <View style={[styles.gutter, callout ? { width: GUTTER - 2 } : null]}>
          {renderGutterMarker(layout.marker, layout.icon, layout.leadMark, kit)}
        </View>
      )}
      <View style={[styles.content, { alignItems: labelSpans ? "flex-start" : "center" }]}>
        {layout.labelText ? (
          <Text selectable style={styles.leadLabel}>
            {layout.labelText}
          </Text>
        ) : null}
        {layout.chips.map((chip, index) => renderChip(chip, kit, index))}
        {layout.gauge !== undefined ? (
          <MiniBar
            gauge={layout.gauge}
            width={44}
            height={6}
            color={toneVisual(gaugeTone(layout.gauge), kit.colors).foreground}
            track={tinted(kit.colors.foreground, 0x1f)}
            maxSegments={12}
          />
        ) : null}
        {layout.rest && layout.rest.length > 0 ? (
          <Text selectable style={[styles.line, styles.leadRest]}>
            {layout.rest.map((segment, index) => renderInlineSegment(segment, kit, index))}
          </Text>
        ) : null}
        {layout.trailingMark ? (
          <View style={{ marginLeft: 2 }}>
            <Icon
              name={markIcon(layout.trailingMark.pass)}
              size={kit.fontSize - 1}
              color={layout.trailingMark.pass ? kit.colors.statusSuccess : kit.colors.statusDanger}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function rowHasNoLead(row: RowLayout): boolean {
  return row.icon === undefined && row.leadMark === undefined && row.marker === undefined;
}

/** A tree drawn with views: rail columns per ancestor level, tick per node. */
function renderTree(layout: TreeLayout, kit: RenderKit, key: string): ReactNode {
  const { styles, colors, fontSize } = kit;
  const rail = tinted(colors.foreground, 0x45);
  const rest = layout.rest;
  const first = rest[0];
  const last = rest.at(-1);
  const leadMark = first?.type === "mark" ? first : undefined;
  const trailingMark = rest.length > 1 && last?.type === "mark" ? last : undefined;
  const middle = rest.slice(
    leadMark !== undefined ? 1 : 0,
    trailingMark !== undefined ? -1 : undefined,
  );
  return (
    <View key={key} style={styles.row}>
      <View style={{ flexDirection: "row", alignSelf: "stretch" }}>
        {layout.rails.map((passes, index) => (
          <View key={`rail-${index}`} style={styles.rail}>
            {passes ? (
              <View
                style={{
                  marginLeft: RAIL_INSET,
                  width: 1,
                  alignSelf: "stretch",
                  backgroundColor: rail,
                }}
              />
            ) : null}
          </View>
        ))}
        <View style={styles.rail}>
          <View
            style={{
              position: "absolute",
              left: RAIL_INSET,
              top: 0,
              bottom: layout.glyph === "mid" ? 0 : "50%",
              width: 1,
              backgroundColor: rail,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: RAIL_INSET,
              top: "50%",
              width: RAIL_STEP - RAIL_INSET,
              height: 1,
              backgroundColor: rail,
            }}
          />
        </View>
      </View>
      <View style={{ flex: 1, paddingLeft: 6, flexDirection: "row", alignItems: "center" }}>
        {leadMark ? (
          <View style={{ marginRight: 5 }}>
            <Icon
              name={markIcon(leadMark.pass)}
              size={fontSize - 1}
              color={leadMark.pass ? colors.statusSuccess : colors.statusDanger}
            />
          </View>
        ) : null}
        {middle.length > 0 ? (
          <Text selectable style={[styles.line, { flexShrink: 1 }]}>
            {middle.map((segment, index) => renderInlineSegment(segment, kit, index))}
          </Text>
        ) : null}
        {trailingMark ? (
          <View style={{ marginLeft: 5 }}>
            <Icon
              name={markIcon(trailingMark.pass)}
              size={fontSize - 1}
              color={trailingMark.pass ? colors.statusSuccess : colors.statusDanger}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Chips joined by same-scale chevrons, replacing the → glyph between steps. */
function renderStepper(layout: StepperLayout, kit: RenderKit, key: string): ReactNode {
  const { styles, colors, fontSize } = kit;
  return (
    <View key={key} style={styles.row}>
      {layout.marker ? (
        <View style={styles.gutter}>
          {renderGutterMarker(layout.marker, undefined, undefined, kit)}
        </View>
      ) : null}
      <View style={styles.stepperRow}>
        {layout.steps.map((step, index) => {
          const chip = renderChip(
            {
              label: step.label,
              tone: step.mark ? (step.mark.pass ? "success" : "error") : step.tone,
              ...(step.mark
                ? { icon: markIcon(step.mark.pass) }
                : step.icon
                  ? { icon: step.icon }
                  : {}),
            },
            kit,
            index,
          );
          const chevron =
            index < layout.steps.length - 1 ? (
              <Icon
                key={`chevron-${index}`}
                name="ChevronRight"
                size={fontSize - 2}
                color={colors.foregroundMuted}
              />
            ) : null;
          return (
            <Fragment key={index}>
              {chip}
              {chevron}
            </Fragment>
          );
        })}
      </View>
    </View>
  );
}

function renderGaugeRow(layout: GaugeLayout, kit: RenderKit, key: string): ReactNode {
  const { styles, colors } = kit;
  return (
    <View key={key} style={styles.row}>
      {kit.gutterMode ? <View style={styles.gutter} /> : null}
      <MiniBar
        gauge={layout.gauge}
        width={56}
        height={6}
        color={toneVisual(gaugeTone(layout.gauge), colors).foreground}
        track={tinted(colors.foreground, 0x1f)}
        maxSegments={12}
      />
      {layout.rest && layout.rest.length > 0 ? (
        <Text selectable style={[styles.line, styles.leadRest]}>
          {layout.rest.map((segment, index) => renderInlineSegment(segment, kit, index))}
        </Text>
      ) : null}
    </View>
  );
}

/** A section heading: the icon hangs in the gutter so text meets the body column. */
function renderHeading(line: EmphasisLine, kit: RenderKit, key: string): ReactNode {
  const { styles, colors, compact } = kit;
  const size = headingSize(line.heading ?? 1, compact);
  const icon = line.segments[0];
  const title = icon?.type === "icon" ? line.segments[1] : icon;
  const text = title?.type === "text" ? title.text.replace(/^#{1,6} /, "") : "";
  return (
    <View key={key} style={styles.sectionRow}>
      <View style={styles.gutter}>
        {icon?.type === "icon" ? (
          <Icon name={icon.name} size={Math.min(size - 3, 18)} color={colors.foregroundMuted} />
        ) : null}
      </View>
      <StreamedText
        text={text}
        phase={kit.phase}
        selectable
        style={[kit.styles.line, { fontSize: size, fontWeight: "600", flex: 1 }]}
      />
    </View>
  );
}

/** Plans every line of a chunk first: chunks with structure share the gutter. */
function renderChunkLines(lines: EmphasisLine[], kit: RenderKit, baseKey: number): ReactNode[] {
  const planned = lines.map((line) => ({
    line,
    layout: line.heading === undefined ? planLineLayout(line.segments) : undefined,
  }));
  const gutterMode = planned.some(
    (entry) => entry.layout === undefined || entry.layout.type !== "inline",
  );
  const chunkKit: RenderKit = { ...kit, gutterMode };
  return planned.map((entry, index) => {
    if (entry.layout === undefined) {
      return renderHeading(entry.line, chunkKit, `${baseKey}-${index}`);
    }
    switch (entry.layout.type) {
      case "row":
        return renderRow(entry.layout, chunkKit, `${baseKey}-${index}`);
      case "tree":
        return renderTree(entry.layout, chunkKit, `${baseKey}-${index}`);
      case "stepper":
        return renderStepper(entry.layout, chunkKit, `${baseKey}-${index}`);
      case "gauge-row":
        return renderGaugeRow(entry.layout, chunkKit, `${baseKey}-${index}`);
      default:
        return renderInlineLine(entry.layout.segments, chunkKit, `${baseKey}-${index}`);
    }
  });
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
      colors: theme.colors,
      compact: layout.compact,
      phase: data.phase,
      fontSize: layout.compact ? 13 : 14,
      gutterMode: false,
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
            {renderChunkLines(block.lines, kit, blockIndex)}
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
