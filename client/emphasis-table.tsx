import { Icon, Markdown } from "@getpaseo/plugin/client/ui";
import { memo, type ReactNode, useMemo } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import type {
  EmphasisAlign,
  EmphasisTable as EmphasisTableData,
  TableCell,
} from "../shared/emphasis";
import { sameTable } from "./block-equal";
import { MiniBar, renderChip, renderShortInlineText } from "./emphasis-parts";
import { renderStepperRow } from "./emphasis-rows";
import { gaugeTone, markIcon, tinted, toneVisual, type RenderKit } from "./emphasis-style";
import { isPlainProse } from "./parse-tokens";

function cellWidth(cell: TableCell): number {
  switch (cell.kind) {
    case "markdown":
      return cell.text.length;
    case "chips":
      return (
        cell.chips.reduce((sum, chip) => sum + chip.label.length + 4, 0) + (cell.text?.length ?? 0)
      );
    case "stepper":
      return cell.steps.reduce((sum, step) => sum + step.label.length + 4, 0);
    case "gauge":
      return 10 + (cell.text?.length ?? 0);
    case "mark":
      return 4 + (cell.text?.length ?? 0);
  }
}

/** Natural column weights derived from the longest cell in each column, clamped. */
function columnWeights(table: EmphasisTableData): number[] {
  const widths: number[] = Array.from(
    { length: Math.max(table.aligns.length, table.header.length) },
    () => 6,
  );
  const grow = (index: number, cell: TableCell) => {
    const slot = widths[index] ?? 6;
    widths[index] = Math.min(36, Math.max(slot, cellWidth(cell)));
  };
  table.header.forEach((cell, index) => grow(index, cell));
  table.rows.forEach((row) => row.forEach((cell, index) => grow(index, cell)));
  return widths;
}

function rowAlignment(align: EmphasisAlign): ViewStyle | undefined {
  if (align === "center") return { justifyContent: "center" };
  if (align === "right") return { justifyContent: "flex-end" };
  return undefined;
}

function renderMarkdownCell(text: string, isHeader: boolean, kit: RenderKit): ReactNode {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  if (isPlainProse(trimmed)) {
    return renderShortInlineText(trimmed, isHeader ? kit.styles.tableHeaderText : undefined);
  }
  if (isHeader && !/[`[\]*_~<>]/.test(trimmed)) {
    return <Markdown>{`**${trimmed}**`}</Markdown>;
  }
  return <Markdown>{trimmed}</Markdown>;
}

function CellContent({
  cell,
  kit,
  align,
  isHeader,
}: {
  cell: TableCell;
  kit: RenderKit;
  align: EmphasisAlign;
  isHeader: boolean;
}) {
  switch (cell.kind) {
    case "markdown":
      return renderMarkdownCell(cell.text, isHeader, kit);
    case "stepper":
      return renderStepperRow(cell.steps, kit, "cell-stepper");
    case "gauge":
      return (
        <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, rowAlignment(align)]}>
          <MiniBar
            gauge={cell.gauge}
            width={44}
            height={5}
            color={toneVisual(gaugeTone(cell.gauge), kit.colors).foreground}
            track={tinted(kit.colors.foreground, 0x1f)}
            maxSegments={12}
          />
          {cell.text ? renderShortInlineText(cell.text) : null}
        </View>
      );
    case "mark":
      return (
        <View style={[{ flexDirection: "row", alignItems: "center", gap: 6 }, rowAlignment(align)]}>
          {cell.text ? renderShortInlineText(cell.text) : null}
          <Icon
            name={markIcon(cell.pass)}
            size={kit.iconSize + 1}
            color={cell.pass ? kit.colors.statusSuccess : kit.colors.statusDanger}
          />
        </View>
      );
    case "chips":
      return (
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 5,
            ...rowAlignment(align),
          }}
        >
          {cell.chips.map((chip, index) => renderChip(chip, kit, index))}
          {cell.text ? (
            isPlainProse(cell.text) ? (
              renderShortInlineText(cell.text)
            ) : (
              <Markdown>{cell.text}</Markdown>
            )
          ) : null}
        </View>
      );
  }
}

function cellBox(weight: number, compact: boolean, align: EmphasisAlign): ViewStyle {
  return {
    flex: weight,
    minWidth: compact ? 76 : 96,
    paddingHorizontal: compact ? 8 : 10,
    paddingVertical: compact ? 6 : 8,
    justifyContent: "center",
    alignItems: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
  };
}

/** A decorated GFM table rendered with native chip/gauge/mark cells and `<Markdown>` prose cells. */
export const EmphasisTable = memo(
  function EmphasisTable({ table, kit }: { table: EmphasisTableData; kit: RenderKit }): ReactNode {
    const { colors, compact } = kit;
    const weights = useMemo(() => columnWeights(table), [table]);
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={!compact}>
        <View
          style={{
            minWidth: "100%",
            borderRadius: 8,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.border,
            overflow: "hidden",
          }}
        >
          <View style={{ flexDirection: "row", backgroundColor: colors.surface2 }}>
            {table.header.map((cell, index) => {
              const align = table.aligns[index] ?? "none";
              return (
                <View key={index} style={cellBox(weights[index] ?? 6, compact, align)}>
                  <CellContent cell={cell} kit={kit} align={align} isHeader />
                </View>
              );
            })}
          </View>
          {table.rows.map((row, rowIndex) => (
            <View
              key={rowIndex}
              style={{
                flexDirection: "row",
                backgroundColor: rowIndex % 2 === 0 ? colors.surface0 : colors.surface1,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.border,
              }}
            >
              {row.map((cell, columnIndex) => {
                const align = table.aligns[columnIndex] ?? "none";
                return (
                  <View
                    key={columnIndex}
                    style={cellBox(weights[columnIndex] ?? 6, compact, align)}
                  >
                    <CellContent cell={cell} kit={kit} align={align} isHeader={false} />
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  },
  (prev, next) => prev.kit === next.kit && sameTable(prev.table, next.table),
);
