import { defineSettings } from "@getpaseo/plugin";
import { z } from "zod";

export const emphasisSettings = defineSettings({
  id: "preferences",
  scope: "host",
  version: 1,
  schema: z.object({
    autoInstructions: z.boolean().default(true),
  }),
});
