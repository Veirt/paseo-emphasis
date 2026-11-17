import type { ReactNode } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { EmphasisAlign, EmphasisLine, EmphasisTable } from "../shared/emphasis";
import { planLineLayout } from "./emphasis-layout";
import { MiniBar, renderChip, renderInlineSegment } from "./emphasis-parts";
import { gaugeTone, tinted, toneVisual, type RenderKit } from "./emphasis-style";
import { renderStepper } from "./emphasis-rows";
/** Natural width per column, from the longest cell text, clamped — flexbox's stand-in for auto columns. */
function columnWeights(table: EmphasisTable): number[] {
  const widths: number[] = Array.from(
    { length: Math.max(table.aligns.length, table.header.length) },
    () => 4,
  );
  const grow = (index: number, cell: EmphasisLine) => {
    const slot = widths[index] ?? 4;
    widths[index] = Math.min(36, Math.max(slot, cellWidth(cell)));
  };
  table.header.forEach((cell, index) => grow(index, cell));
  table.rows.forEach((row) => row.forEach((cell, index) => grow(index, cell)));
  return widths;
}

function cellWidth(line: EmphasisLine): number {
  let total = 0;
  for (const segment of line.segments) {
    switch (segment.type) {
      case "text":
      case "code":
      case "tree":
        total += segment.text.length;
        break;
      case "pill":
        total += segment.label.length;
        break;
      default:
        total += 1;
    }
  }
  return total;
}

function contentAlignment(align: EmphasisAlign): ViewStyle | undefined {
  if (align === "center") return { justifyContent: "center" };
  if (align === "right") return { justifyContent: "flex-end" };
  return undefined;
}

/** One cell: the same segment pipeline as a row, without gutter markers. */
function CellContent({
  line,
  kit,
  align,
}: {
  line: EmphasisLine;
  kit: RenderKit;
  align: EmphasisAlign;
}) {
  const textAlign = align === "none" ? undefined : align;
  const layout = planLineLayout(line.segments);
  if (layout.type === "inline") {
    return (
      <Text selectable style={[kit.styles.line, textAlign ? { textAlign } : null]}>
        {line.segments.map((segment, index) => renderInlineSegment(segment, kit, index))}
      </Text>
    );
  }
  if (layout.type === "tree") {
    // A tree inside a cell degrades to its node text; rails are prose-level structure.
    return (
      <Text selectable style={[kit.styles.line, textAlign ? { textAlign } : null]}>
        {layout.rest.map((segment, index) => renderInlineSegment(segment, kit, index))}
      </Text>
    );
  }
  if (layout.type === "stepper") {
    return renderStepper(layout, kit, "cell-steps");
  }
  if (layout.type === "gauge-row") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <MiniBar
          gauge={layout.gauge}
          width={44}
          height={5}
          color={toneVisual(gaugeTone(layout.gauge), kit.colors).foreground}
          track={tinted(kit.colors.foreground, 0x1f)}
          maxSegments={12}
        />
        {layout.rest !== undefined && layout.rest.length > 0 ? (
          <Text selectable style={kit.styles.line}>
            {layout.rest.map((segment, index) => renderInlineSegment(segment, kit, index))}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 5,
        ...contentAlignment(align),
      }}
    >
      {layout.labelText !== undefined ? (
        <Text selectable style={kit.styles.leadLabel}>
          {layout.labelText}
        </Text>
      ) : null}
      {layout.chips.map((chip, index) => renderChip(chip, kit, index))}
      {layout.gauge !== undefined ? (
        <MiniBar
          gauge={layout.gauge}
          width={34}
          height={5}
          color={toneVisual(gaugeTone(layout.gauge), kit.colors).foreground}
          track={tinted(kit.colors.foreground, 0x1f)}
          maxSegments={12}
        />
      ) : null}
      {layout.rest !== undefined && layout.rest.length > 0 ? (
        <Text
          selectable
          style={[kit.styles.line, { flexShrink: 1 }, textAlign ? { textAlign } : null]}
        >
          {layout.rest.map((segment, index) => renderInlineSegment(segment, kit, index))}
        </Text>
      ) : null}
    </View>
  );
}

function cellBox(weight: number, compact: boolean): ViewStyle {
  return {
    flex: weight,
    minWidth: 0,
    paddingHorizontal: compact ? 6 : 10,
    paddingVertical: compact ? 4 : 6,
    justifyContent: "center",
  };
}

/** A GFM table rendered as native views: bordered block, surface header, segment-parsed cells. */
export function EmphasisTable({ table, kit }: { table: EmphasisTable; kit: RenderKit }): ReactNode {
  const { colors, compact } = kit;
  const weights = columnWeights(table);
  return (
    <View
      style={{
        borderRadius: 8,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <View style={{ flexDirection: "row", backgroundColor: colors.surface1 }}>
        {table.header.map((cell, index) => (
          <View key={index} style={cellBox(weights[index] ?? 4, compact)}>
            <CellContent line={cell} kit={kit} align={table.aligns[index] ?? "none"} />
          </View>
        ))}
      </View>
      {table.rows.map((row, rowIndex) => (
        <View
          key={rowIndex}
          style={{
            flexDirection: "row",
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: colors.border,
          }}
        >
          {row.map((cell, columnIndex) => (
            <View key={columnIndex} style={cellBox(weights[columnIndex] ?? 4, compact)}>
              <CellContent line={cell} kit={kit} align={table.aligns[columnIndex] ?? "none"} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
