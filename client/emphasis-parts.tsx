import { Icon, Markdown, StreamedText } from "@getpaseo/plugin/client/ui";
import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { GaugeData, PillData, TagData } from "../shared/emphasis";
import {
  ZERO_COUNT,
  markIcon,
  parseRatio,
  ratioToneOf,
  tinted,
  toneVisual,
  type RenderKit,
} from "./emphasis-style";

/**
 * Discrete segments for small totals, continuous fill beyond them.
 */
export function MiniBar({
  gauge,
  width,
  height,
  color,
  track,
  maxSegments,
}: {
  gauge: GaugeData;
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

/** A status pill or action badge rendered as a native chip. */
export function renderChip(chip: PillData, kit: RenderKit, key: number): ReactNode {
  const zero = ZERO_COUNT.test(chip.label.trim());
  const ratio = parseRatio(chip.label);
  const tone = ratio ? ratioToneOf(chip.tone, ratio.n, ratio.d) : zero ? "neutral" : chip.tone;
  const visual = toneVisual(tone, kit.colors);
  return (
    <View
      key={key}
      style={[kit.styles.pill, { backgroundColor: visual.background, borderColor: visual.border }]}
    >
      {chip.icon ? <Icon name={chip.icon} size={kit.iconSize} color={visual.foreground} /> : null}
      <Text selectable style={[kit.styles.pillText, { color: visual.foreground }]}>
        {chip.label}
      </Text>
      {ratio ? (
        <MiniBar
          gauge={{ filled: ratio.n, total: ratio.d }}
          width={32}
          height={4}
          color={visual.foreground}
          track={tinted(visual.foreground, 0x30)}
          maxSegments={10}
        />
      ) : null}
    </View>
  );
}

/** A quiet secondary tag beside a chip (e.g. `BLOCKER`, `SHOULD-FIX`, `FINE`). */
export function renderTag(tag: TagData, kit: RenderKit, key: string): ReactNode {
  return (
    <View key={key} style={kit.styles.tag}>
      <Text selectable style={kit.styles.tagText}>
        {tag.label}
      </Text>
    </View>
  );
}

/** Full-fidelity Paseo Markdown prose block. */
export function renderMarkdownBody(text: string): ReactNode {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  return <Markdown>{trimmed}</Markdown>;
}

/** Single-line plain prose matching Paseo's UI font and line height without wrapping lag. */
export function renderShortInlineText(text: string): ReactNode {
  return <StreamedText text={text} phase="complete" selectable />;
}

/** A list marker or status mark rendered in the 20px list gutter. */
export function renderListMarker(
  ordered: boolean,
  markerLabel: string | undefined,
  leadMark: boolean | undefined,
  kit: RenderKit,
): ReactNode {
  if (leadMark !== undefined) {
    return (
      <View style={{ marginTop: kit.compact ? 4 : 5 }}>
        <Icon
          name={markIcon(leadMark)}
          size={kit.iconSize + 1}
          color={leadMark ? kit.colors.statusSuccess : kit.colors.statusDanger}
        />
      </View>
    );
  }
  if (ordered && markerLabel !== undefined) {
    return (
      <Text selectable numberOfLines={1} ellipsizeMode="clip" style={kit.styles.gutterNumber}>
        {markerLabel}
      </Text>
    );
  }
  return <View style={kit.styles.bulletDot} />;
}
