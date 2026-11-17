import { Icon, StreamedText } from "@getpaseo/plugin/client/ui";
import type { ReactNode } from "react";
import { Fragment } from "react";
import { Text, View } from "react-native";
import type { EmphasisLine } from "../shared/emphasis";
import {
  type GaugeLayout,
  type RowLayout,
  type StepperLayout,
  type TreeLayout,
} from "./emphasis-layout";
import {
  GUTTER,
  RAIL_INSET,
  RAIL_STEP,
  gaugeTone,
  headingSize,
  markIcon,
  tinted,
  toneVisual,
  type RenderKit,
} from "./emphasis-style";
import { MiniBar, renderChip, renderGutterMarker, renderInlineSegment } from "./emphasis-parts";

function rowHasNoLead(row: RowLayout): boolean {
  return row.icon === undefined && row.leadMark === undefined && row.marker === undefined;
}

export function renderRow(layout: RowLayout, kit: RenderKit, key: string): ReactNode {
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

/** A tree drawn with views: rail columns per ancestor level, tick per node. */
export function renderTree(layout: TreeLayout, kit: RenderKit, key: string): ReactNode {
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
export function renderStepper(layout: StepperLayout, kit: RenderKit, key: string): ReactNode {
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
              icon: step.mark !== undefined ? markIcon(step.mark.pass) : step.icon,
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

export function renderGaugeRow(layout: GaugeLayout, kit: RenderKit, key: string): ReactNode {
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
export function renderHeading(line: EmphasisLine, kit: RenderKit, key: string): ReactNode {
  const { styles, colors, compact } = kit;
  const size = headingSize(line.heading ?? 1, compact);
  const icon = line.segments[0];
  const title = icon?.type === "icon" ? line.segments[1] : icon;
  const text = title?.type === "text" ? title.text : "";
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
