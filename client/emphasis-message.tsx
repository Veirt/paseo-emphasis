import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon, Markdown, copyText, useToast } from "@getpaseo/plugin/client/ui";
import { type ReactNode, useCallback, useMemo } from "react";
import { Pressable, View } from "react-native";
import { emphasisDataSchema, type EmphasisData, type EmphasisLine } from "../shared/emphasis";
import { planLineLayout } from "./emphasis-layout";
import { buildStyles, type RenderKit } from "./emphasis-style";
import { renderInlineLine } from "./emphasis-parts";
import {
  renderGaugeRow,
  renderHeading,
  renderRow,
  renderStepper,
  renderTree,
} from "./emphasis-rows";

/** Dispatches one chunk's planned lines: headings and structure rows to their renderers. */
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
    const key = `${baseKey}-${index}`;
    switch (entry.layout.type) {
      case "row":
        return renderRow(entry.layout, chunkKit, key);
      case "tree":
        return renderTree(entry.layout, chunkKit, key);
      case "stepper":
        return renderStepper(entry.layout, chunkKit, key);
      case "gauge-row":
        return renderGaugeRow(entry.layout, chunkKit, key);
      default:
        return renderInlineLine(entry.layout.segments, chunkKit, key);
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
