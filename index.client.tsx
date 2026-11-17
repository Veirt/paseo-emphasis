import type {
  PluginClientContext,
  PluginTimelineTransformerContribution,
} from "@getpaseo/plugin/client";
import { EmphasisMessage } from "./client/emphasis-message";
import { parseEmphasis } from "./client/parse-emphasis";
import { EmphasisSettingsScreen } from "./client/settings";
import { EMPHASIS_KIND, EMPHASIS_VERSION, emphasisDataSchema } from "./shared/emphasis";
import { buildFullInstructions } from "./shared/instructions";

const transformAssistantMessage: PluginTimelineTransformerContribution<"assistant_message">["transform"] =
  ({ item, phase }) => {
    // A message with nothing to decorate keeps the built-in renderer and its copy affordance.
    const data = parseEmphasis(item.text, phase);
    if (!data) return undefined;
    return {
      items: [{ type: "plugin", kind: EMPHASIS_KIND, version: EMPHASIS_VERSION, data }],
    };
  };

export default function contribute(client: PluginClientContext) {
  client.addTimelineTransformer({
    id: "emphasis",
    query: { itemType: "assistant_message" },
    transform: transformAssistantMessage,
  });
  client.addTimelineRenderer({
    kind: EMPHASIS_KIND,
    version: EMPHASIS_VERSION,
    schema: emphasisDataSchema,
    Component: EmphasisMessage,
  });
  client.addSettingsScreen({
    id: "preferences",
    title: "Emphasis",
    icon: "Tag",
    Component: EmphasisSettingsScreen,
  });
  client.addSlashCommand({
    name: "emphasis",
    description: "Teach this agent the emphasis reply format",
    argumentHint: "[prompt]",
    context: "agent",
    async onSubmit({ args, paseo, agent }) {
      const guidance = buildFullInstructions();
      const prompt = args.trim()
        ? `${guidance}\n\n${args.trim()}`
        : `${guidance}\n\nAcknowledge briefly, then use the markup above in your replies from now on.`;
      await paseo.agents.ref(agent.id).send(prompt);
    },
  });
  return () => {};
}
