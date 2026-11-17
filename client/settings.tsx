import { useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { SettingsCard, SettingsSection, SettingsSwitch } from "@getpaseo/plugin/client/ui";
import { Text, View } from "react-native";
import { emphasisSettings } from "../shared/settings";

export function EmphasisSettingsScreen({ theme }: PluginSurfaceProps) {
  const settings = useSettings(emphasisSettings);

  if (settings.status === "loading") {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: theme.colors.foregroundMuted, fontSize: 13 }}>Loading settings…</Text>
      </View>
    );
  }

  if (settings.status !== "ready") {
    return (
      <View style={{ padding: 16 }}>
        <Text style={{ color: theme.colors.statusDanger, fontSize: 13 }}>{settings.error}</Text>
      </View>
    );
  }

  const { values, revision, save } = settings;

  return (
    <View style={{ gap: 16 }}>
      <SettingsSection title="Agent guidance">
        <SettingsCard>
          <SettingsSwitch
            label="Teach new agents the reply format"
            hint="Adds the reply-format guidance to new agents' system prompt when they are created. For an existing agent, run /emphasis in the composer."
            value={values.autoInstructions}
            onValueChange={(autoInstructions) => {
              void save({ ...values, autoInstructions }, revision);
            }}
          />
        </SettingsCard>
      </SettingsSection>
    </View>
  );
}
