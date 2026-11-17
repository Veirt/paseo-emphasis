import type { PluginServerContext } from "@getpaseo/plugin/server";
import { buildFullInstructions, EMPHASIS_MARKER } from "./shared/instructions";
import { emphasisSettings } from "./shared/settings";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(emphasisSettings);

  // New agents learn the reply format at creation. The marker in the guidance text keeps a
  // re-created or duplicated config from stacking a second copy.
  server.addHook("agent.create.before", async ({ request }) => {
    const state = await settings.read();
    if (state.status !== "ready" || !state.values.autoInstructions) return;
    const existing = request.config.systemPrompt ?? "";
    if (existing.includes(EMPHASIS_MARKER)) return;
    return {
      ...request,
      config: {
        ...request.config,
        systemPrompt: [existing, buildFullInstructions()].filter(Boolean).join("\n\n"),
      },
    };
  });

  return () => {};
}
