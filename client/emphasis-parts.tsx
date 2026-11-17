import { Icon, StreamedText } from "@getpaseo/plugin/client/ui";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { EmphasisSegment, EmphasisTone, Gauge } from "../shared/emphasis";
import type { ListMarker } from "./emphasis-layout";
import {
  GUTTER,
  ZERO_COUNT,
  gaugeTone,
  markIcon,
  parseRatio,
  ratioToneOf,
  tinted,
  toneVisual,
  type RenderKit,
} from "./emphasis-style";

/**
 * Leaf renderers: one segment, one chip, one marker. Nothing here sees line
 * structure; the row renderers compose these.
 */

/**
 * A rendered progress bar: discrete segments for small totals, a continuous
 * fill beyond them. Replaces the ▰▱ gauge glyphs, which relied on a grid.
 */
export function MiniBar({
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

/** A pill drawn as a chip: a row sibling, never a child of a Text. */
export function renderChip(
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

/** A gutter marker drawn by the planner: a dot, a number, or a lead icon. */
export function renderGutterMarker(
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

/**
 * A segment drawn inside flowing text, where pills degrade to colored bold
 * labels and gauges degrade to ratio text: only text may nest in text, so
 * component-shaped markup is lifted to row slots by the planner.
 */
export function renderInlineSegment(
  segment: EmphasisSegment,
  kit: RenderKit,
  key: number,
): ReactNode {
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

export function renderInlineLine(
  segments: EmphasisSegment[],
  kit: RenderKit,
  key: string,
): ReactNode {
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
