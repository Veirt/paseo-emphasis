import type {
  PluginClientContext,
  PluginTimelineTransformerContribution,
} from "@getpaseo/plugin/client";
import { EmphasisMessage } from "./client/emphasis-message";
import { parseEmphasis } from "./client/parse-emphasis";
import { EMPHASIS_KIND, EMPHASIS_VERSION, emphasisDataSchema } from "./shared/emphasis";

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
  return () => {};
}
