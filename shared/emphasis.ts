import { z } from "zod";

export const EMPHASIS_KIND = "emphasis";
export const EMPHASIS_VERSION = 1;

export const emphasisToneSchema = z.enum([
  "success",
  "warning",
  "danger",
  "error",
  "mode",
  "owner",
  "neutral",
]);

export const emphasisSegmentSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string(), bold: z.boolean() }),
  z.object({ type: z.literal("code"), text: z.string() }),
  z.object({
    type: z.literal("pill"),
    label: z.string(),
    tone: emphasisToneSchema,
    icon: z.string().optional(),
  }),
  z.object({ type: z.literal("icon"), name: z.string() }),
  z.object({ type: z.literal("arrow") }),
  z.object({ type: z.literal("tree"), text: z.string() }),
  z.object({ type: z.literal("mark"), pass: z.boolean() }),
  z.object({
    type: z.literal("gauge"),
    filled: z.number().int().min(0),
    total: z.number().int().min(2),
  }),
]);

export const emphasisLineSchema = z.object({
  /** Heading level when the line opened with 1-6 hash marks, stripped before `segments`. */
  heading: z.number().int().min(1).max(6).optional(),
  segments: z.array(emphasisSegmentSchema),
});

/** Column alignment from a GFM delimiter row's `:---` colons. */
export const emphasisAlignSchema = z.enum(["left", "center", "right", "none"]);

/** A GFM table: one segment-parsed line per cell data. */
export const emphasisTableSchema = z.object({
  /** One entry per column, from the delimiter row. */
  aligns: z.array(emphasisAlignSchema),
  /** The header row, parsed like any other line. */
  header: z.array(emphasisLineSchema),
  /** Body rows, each as long as `header` (padded or cut to fit). */
  rows: z.array(z.array(emphasisLineSchema)),
});

export const emphasisBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markdown"), text: z.string() }),
  z.object({ type: z.literal("chunk"), lines: z.array(emphasisLineSchema) }),
  z.object({ type: z.literal("table"), table: emphasisTableSchema }),
]);

export const emphasisDataSchema = z.object({
  /** The original assistant markdown, kept verbatim for copy. */
  text: z.string(),
  phase: z.enum(["streaming", "complete"]),
  blocks: z.array(emphasisBlockSchema),
});

export type EmphasisTone = z.output<typeof emphasisToneSchema>;
export type EmphasisAlign = z.output<typeof emphasisAlignSchema>;
export type EmphasisTable = z.output<typeof emphasisTableSchema>;

/** A gauge's data: how many of `total` units are filled. */
export interface Gauge {
  filled: number;
  total: number;
}
export type EmphasisSegment = z.output<typeof emphasisSegmentSchema>;
export type EmphasisLine = z.output<typeof emphasisLineSchema>;
export type EmphasisBlock = z.output<typeof emphasisBlockSchema>;
export type EmphasisData = z.output<typeof emphasisDataSchema>;
