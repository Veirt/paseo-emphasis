import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon, Markdown, copyText, useToast } from "@getpaseo/plugin/client/ui";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import { emphasisDataSchema, type EmphasisBlock, type EmphasisData } from "../shared/emphasis";
import {
  renderChipsBlock,
  renderGaugeBlock,
  renderHeadingBlock,
  renderListBlock,
  renderStepperRow,
  renderTreeBlock,
} from "./emphasis-rows";
import { buildStyles, type RenderKit } from "./emphasis-style";
import { EmphasisTable } from "./emphasis-table";

function renderBlock(block: EmphasisBlock, kit: RenderKit, index: number): ReactNode {
  const key = String(index);
  switch (block.type) {
    case "markdown":
      return <Markdown key={key}>{block.text}</Markdown>;
    case "heading":
      return renderHeadingBlock(block, kit, key);
    case "chips":
      return renderChipsBlock(block, kit, key);
    case "list":
      return renderListBlock(block, kit, key);
    case "stepper":
      return renderStepperRow(block.steps, kit, key);
    case "gauge":
      return renderGaugeBlock(block, kit, key);
    case "tree":
      return renderTreeBlock(block.lines, kit, key);
    case "table":
      return <EmphasisTable key={key} table={block.table} kit={kit} />;
  }
}

/**
 * Draws an assistant message that carries emphasis markup. Prose, links, code spans,
 * blockquotes, and plain lists/tables delegate to Paseo `<Markdown>`; status pills,
 * action badges, steppers, gauges, trees, and decorated tables render natively.
 */
export function EmphasisMessage({ item, theme, layout }: PluginTimelineItemProps<EmphasisData>) {
  const data = emphasisDataSchema.parse(item.data);
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const kit = useMemo<RenderKit>(
    () => ({
      styles: buildStyles(theme.colors, layout.compact, layout.platform),
      colors: theme.colors,
      compact: layout.compact,
      phase: data.phase,
      iconSize: layout.compact ? 12 : 13,
    }),
    [theme, layout, data.phase],
  );

  const handleCopy = useCallback(() => {
    copyText(data.text)
      .then(() => {
        setCopied(true);
        if (timerRef.current !== null) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCopied(false);
          timerRef.current = null;
        }, 1500);
      })
      .catch((error: unknown) => {
        toast.error("Copy failed");
        console.error("emphasis copy failed", error);
      });
  }, [data.text, toast]);

  return (
    <View style={kit.styles.message}>
      {data.blocks.map((block, index) => renderBlock(block, kit, index))}
      {data.phase === "complete" ? (
        <Pressable
          accessibilityLabel={copied ? "Copied message markdown" : "Copy message markdown"}
          accessibilityRole="button"
          hitSlop={8}
          onPress={handleCopy}
          style={kit.styles.copyButton}
        >
          <Icon name={copied ? "Check" : "Copy"} size={13} color={theme.colors.foregroundMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
