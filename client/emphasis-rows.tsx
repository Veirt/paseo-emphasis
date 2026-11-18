import { Icon } from "@getpaseo/plugin/client/ui";
import { Fragment, type ReactNode } from "react";
import { Text, View } from "react-native";
import type { EmphasisBlock, ListItem, StepData } from "../shared/emphasis";
import {
  MiniBar,
  renderChip,
  renderListMarker,
  renderMarkdownBody,
  renderShortInlineText,
  renderTag,
} from "./emphasis-parts";
import {
  gaugeTone,
  headingSize,
  markIcon,
  tinted,
  toneVisual,
  type RenderKit,
} from "./emphasis-style";

type HeadingBlock = Extract<EmphasisBlock, { type: "heading" }>;
type ChipsBlock = Extract<EmphasisBlock, { type: "chips" }>;
type ListBlock = Extract<EmphasisBlock, { type: "list" }>;
type GaugeBlock = Extract<EmphasisBlock, { type: "gauge" }>;

/** A section heading with its icon flush at the left margin (never indented past body text). */
export function renderHeadingBlock(block: HeadingBlock, kit: RenderKit, key: string): ReactNode {
  const size = headingSize(block.level, kit.compact);
  return (
    <View key={key} style={kit.styles.headingRow}>
      <Icon
        name={block.icon}
        size={Math.min(Math.max(size - 4, 14), 19)}
        color={kit.colors.foregroundMuted}
      />
      <Text
        selectable
        style={[kit.styles.headingText, { fontSize: size, lineHeight: Math.round(size * 1.3) }]}
      >
        {block.title}
      </Text>
    </View>
  );
}

/** A pill strip / scoreboard, optionally paired with short inline text or full-width `<Markdown>`. */
export function renderChipsBlock(block: ChipsBlock, kit: RenderKit, key: string): ReactNode {
  if (block.inline && block.body !== undefined) {
    return (
      <View key={key} style={kit.styles.chipInlineRow}>
        {block.chips.map((chip, index) => renderChip(chip, kit, index))}
        {renderShortInlineText(block.body)}
      </View>
    );
  }

  return (
    <View key={key} style={kit.styles.blockStack}>
      <View style={kit.styles.chipStrip}>
        {block.tag ? renderTag(block.tag, kit, "tag") : null}
        {block.chips.map((chip, index) => renderChip(chip, kit, index))}
      </View>
      {block.body !== undefined ? renderMarkdownBody(block.body) : null}
    </View>
  );
}

function isShortStatusListItem(item: ListItem, compact: boolean): boolean {
  if (item.tag !== undefined || item.chips.length !== 1) return false;
  if (item.body.length === 0 || item.body.length > (compact ? 26 : 42)) return false;
  return !/[\n`[\]*_~<>]/.test(item.body);
}

/**
 * Renders a list containing pill/action items with uniform marker alignment and
 * full-width `<Markdown>` inside each item, eliminating column crushing and bullet zig-zag.
 */
export function renderListBlock(block: ListBlock, kit: RenderKit, key: string): ReactNode {
  const allShortSingleChip =
    block.omitMarkers && block.items.every((item) => isShortStatusListItem(item, kit.compact));
  const hasNestedOrMultiLine = block.items.some((item) => item.body.includes("\n"));

  return (
    <View key={key} style={hasNestedOrMultiLine ? kit.styles.listRich : kit.styles.list}>
      {block.items.map((item, index) => {
        const hasHeader = item.chips.length > 0 || item.tag !== undefined;
        return (
          <View key={index} style={kit.styles.listRow}>
            {block.omitMarkers ? null : (
              <View style={kit.styles.listGutter}>
                {renderListMarker(block.ordered, item.markerLabel, item.leadMark, kit)}
              </View>
            )}
            <View style={kit.styles.listContent}>
              {allShortSingleChip ? (
                <View style={kit.styles.chipInlineRow}>
                  {item.chips.map((chip, chipIndex) => renderChip(chip, kit, chipIndex))}
                  {renderShortInlineText(item.body)}
                </View>
              ) : (
                <>
                  {hasHeader ? (
                    <View style={kit.styles.chipStrip}>
                      {item.tag ? renderTag(item.tag, kit, "tag") : null}
                      {item.chips.map((chip, chipIndex) => renderChip(chip, kit, chipIndex))}
                    </View>
                  ) : null}
                  {renderMarkdownBody(item.body)}
                </>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Chips joined by same-scale chevrons, replacing `→` glyphs between pipeline steps. */
export function renderStepperRow(
  steps: readonly StepData[],
  kit: RenderKit,
  key: string,
): ReactNode {
  const { styles, colors, iconSize } = kit;
  return (
    <View key={key} style={styles.stepperRow}>
      {steps.map((step, index) => {
        const chip = renderChip(
          {
            label: step.label,
            tone: step.pass !== undefined ? (step.pass ? "success" : "error") : step.tone,
            icon: step.pass !== undefined ? markIcon(step.pass) : step.icon,
          },
          kit,
          index,
        );
        const chevron =
          index < steps.length - 1 ? (
            <Icon
              key={`chevron-${index}`}
              name="ChevronRight"
              size={iconSize}
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
  );
}

export function renderGaugeBlock(block: GaugeBlock, kit: RenderKit, key: string): ReactNode {
  const { styles, colors } = kit;
  const bar = (
    <MiniBar
      gauge={block.gauge}
      width={60}
      height={6}
      color={toneVisual(gaugeTone(block.gauge), colors).foreground}
      track={tinted(colors.foreground, 0x1f)}
      maxSegments={12}
    />
  );
  if (block.body === undefined || block.body.length === 0) {
    return (
      <View key={key} style={styles.gaugeRow}>
        {bar}
      </View>
    );
  }
  if (!/[\n`[\]*_~<>]/.test(block.body) && block.body.length <= 44) {
    return (
      <View key={key} style={styles.gaugeRow}>
        {bar}
        {renderShortInlineText(block.body)}
      </View>
    );
  }
  return (
    <View key={key} style={styles.blockStack}>
      <View style={styles.gaugeRow}>{bar}</View>
      {renderMarkdownBody(block.body)}
    </View>
  );
}

export function renderTreeBlock(lines: readonly string[], kit: RenderKit, key: string): ReactNode {
  return (
    <View key={key} style={kit.styles.codePanel}>
      {lines.map((line, index) => (
        <Text key={index} selectable style={kit.styles.codeLine}>
          {line}
        </Text>
      ))}
    </View>
  );
}
