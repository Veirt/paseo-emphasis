import type { PluginTimelineItemProps } from "@getpaseo/plugin/client";
import { Icon, copyText, useToast } from "@getpaseo/plugin/client/ui";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, View } from "react-native";
import type { EmphasisBlock, EmphasisData } from "../shared/emphasis";
import { MarkdownBlock } from "./emphasis-parts";
import {
  ChipsBlock,
  GaugeBlockView,
  HeadingBlock,
  ListBlock,
  StepperBlock,
  TreeBlock,
} from "./emphasis-rows";
import { buildStyles, type RenderKit } from "./emphasis-style";
import { EmphasisTable } from "./emphasis-table";

function renderBlock(block: EmphasisBlock, kit: RenderKit, index: number): ReactNode {
  const key = String(index);
  switch (block.type) {
    case "markdown":
      return <MarkdownBlock key={key} text={block.text} />;
    case "heading":
      return <HeadingBlock key={key} block={block} kit={kit} isFirst={index === 0} />;
    case "chips":
      return <ChipsBlock key={key} block={block} kit={kit} />;
    case "list":
      return <ListBlock key={key} block={block} kit={kit} />;
    case "stepper":
      return <StepperBlock key={key} steps={block.steps} kit={kit} />;
    case "gauge":
      return <GaugeBlockView key={key} block={block} kit={kit} />;
    case "tree":
      return <TreeBlock key={key} lines={block.lines} kit={kit} />;
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
  // The Paseo host (`PluginTimelineItemView`) validates `item.data` with `emphasisDataSchema` before render.
  const data = item.data;
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const {
    surface0,
    surface1,
    surface2,
    border,
    foreground,
    foregroundMuted,
    accent,
    accentForeground,
    statusSuccess,
    statusWarning,
    statusDanger,
  } = theme.colors;
  const kit = useMemo<RenderKit>(() => {
    const colors = {
      surface0,
      surface1,
      surface2,
      border,
      foreground,
      foregroundMuted,
      accent,
      accentForeground,
      statusSuccess,
      statusWarning,
      statusDanger,
    };
    return {
      styles: buildStyles(colors, layout.compact, layout.platform),
      colors,
      compact: layout.compact,
      iconSize: layout.compact ? 12 : 13,
    };
  }, [
    surface0,
    surface1,
    surface2,
    border,
    foreground,
    foregroundMuted,
    accent,
    accentForeground,
    statusSuccess,
    statusWarning,
    statusDanger,
    layout.compact,
    layout.platform,
  ]);

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
    <View testID="assistant-message" style={kit.styles.message}>
      {data.blocks.map((block, index) => renderBlock(block, kit, index))}
      {data.phase === "complete" ? (
        <Pressable
          accessibilityLabel={copied ? "Copied message markdown" : "Copy message markdown"}
          accessibilityHint="Copies original message markdown"
          accessibilityRole="button"
          hitSlop={8}
          onPress={handleCopy}
          style={({ pressed }) => [kit.styles.copyButton, pressed ? { opacity: 0.45 } : undefined]}
        >
          <Icon name={copied ? "Check" : "Copy"} size={13} color={theme.colors.foregroundMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}
