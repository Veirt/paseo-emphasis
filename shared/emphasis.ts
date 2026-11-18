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
  "action",
  "neutral",
]);

export const pillDataSchema = z.object({
  label: z.string(),
  tone: emphasisToneSchema,
  icon: z.string().optional(),
});

/** A gauge's data: how many of `total` units are filled. */
export const gaugeDataSchema = z.object({
  filled: z.number().int().min(0),
  total: z.number().int().min(2),
});

export const stepDataSchema = z.object({
  label: z.string(),
  tone: emphasisToneSchema,
  icon: z.string().optional(),
  pass: z.boolean().optional(),
});

/** Column alignment from a GFM delimiter row's `:---` colons. */
export const emphasisAlignSchema = z.enum(["left", "center", "right", "none"]);

/** One cell inside a decorated GFM table: native status widget or Markdown prose. */
export const tableCellSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("markdown"), text: z.string() }),
  z.object({
    kind: z.literal("chips"),
    chips: z.array(pillDataSchema),
    text: z.string().optional(),
  }),
  z.object({ kind: z.literal("stepper"), steps: z.array(stepDataSchema) }),
  z.object({ kind: z.literal("gauge"), gauge: gaugeDataSchema, text: z.string().optional() }),
  z.object({ kind: z.literal("mark"), pass: z.boolean(), text: z.string().optional() }),
]);

export const emphasisTableSchema = z.object({
  aligns: z.array(emphasisAlignSchema),
  header: z.array(tableCellSchema),
  rows: z.array(z.array(tableCellSchema)),
});

export const tagDataSchema = z.object({
  label: z.string(),
  tone: emphasisToneSchema,
});

export const listItemSchema = z.object({
  markerLabel: z.string().optional(),
  chips: z.array(pillDataSchema),
  tag: tagDataSchema.optional(),
  leadMark: z.boolean().optional(),
  body: z.string(),
});

export const emphasisBlockSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("markdown"), text: z.string() }),
  z.object({
    type: z.literal("heading"),
    level: z.number().int().min(1).max(6),
    icon: z.string(),
    title: z.string(),
  }),
  z.object({
    type: z.literal("chips"),
    chips: z.array(pillDataSchema),
    tag: tagDataSchema.optional(),
    body: z.string().optional(),
    inline: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("list"),
    ordered: z.boolean(),
    start: z.number().int().min(0),
    omitMarkers: z.boolean(),
    items: z.array(listItemSchema),
  }),
  z.object({ type: z.literal("stepper"), steps: z.array(stepDataSchema) }),
  z.object({
    type: z.literal("gauge"),
    gauge: gaugeDataSchema,
    body: z.string().optional(),
  }),
  z.object({ type: z.literal("tree"), lines: z.array(z.string()) }),
  z.object({ type: z.literal("table"), table: emphasisTableSchema }),
]);

export const emphasisDataSchema = z.object({
  /** The original assistant markdown, kept verbatim for copy. */
  text: z.string(),
  phase: z.enum(["streaming", "complete"]),
  blocks: z.array(emphasisBlockSchema),
});

export type EmphasisTone = z.output<typeof emphasisToneSchema>;
export type PillData = z.output<typeof pillDataSchema>;
export type GaugeData = z.output<typeof gaugeDataSchema>;
export type StepData = z.output<typeof stepDataSchema>;
export type EmphasisAlign = z.output<typeof emphasisAlignSchema>;
export type TableCell = z.output<typeof tableCellSchema>;
export type EmphasisTable = z.output<typeof emphasisTableSchema>;
export type TagData = z.output<typeof tagDataSchema>;
export type ListItem = z.output<typeof listItemSchema>;
export type EmphasisBlock = z.output<typeof emphasisBlockSchema>;
export type EmphasisData = z.output<typeof emphasisDataSchema>;
