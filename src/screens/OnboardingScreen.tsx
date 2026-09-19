import {useState} from "react";
import {Pressable, StyleSheet, Text, View, useColorScheme} from "react-native";
import type {Strings} from "../i18n/en";
import {darkTheme, lightTheme} from "../theme";
export type OnboardingProps = {t: Strings; busy?: boolean; error?: string | null; onFinish: (services: string[]) => void; onSkip: () => void};
const PROVIDERS = [{service: "VOLUNTEER", labelKey: "volunteer", hintKey: "volunteerHint"}, {service: "SHOP", labelKey: "shop", hintKey: "shopHint"}, {service: "TOW", labelKey: "tow", hintKey: "towHint"}] as const;
type RoleKey = (typeof PROVIDERS)[number]["labelKey" | "hintKey"];
export default function OnboardingScreen({t, busy, error, onFinish, onSkip}: OnboardingProps) {
  const [picked, setPicked] = useState<string[]>([]);
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const toggle = (service: string) => setPicked((prev) => prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]);
  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <Text style={[styles.title, {color: theme.text}]}>{t.roles.title}</Text>
      <Text style={[styles.subtitle, {color: theme.muted}]}>{t.roles.subtitle}</Text>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}><Text style={[styles.fixed, {color: theme.text}]}>{t.roles.rider} — {t.roles.riderHint}</Text></View>
      <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        {PROVIDERS.map(({service, labelKey, hintKey}) => {
          const active = picked.includes(service);
          return (
            <Pressable key={service} disabled={busy} onPress={() => toggle(service)} style={[styles.option, {borderColor: theme.primary}, active && {backgroundColor: theme.primary}]}>
              <Text style={{color: active ? "#fff" : theme.text}}>{t.roles[labelKey as RoleKey] as string} — {t.roles[hintKey as RoleKey] as string}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable disabled={busy} onPress={() => onFinish(["RIDER", ...picked])} style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]}>
        <Text style={styles.primaryText}>{t.roles.done}</Text>
      </Pressable>
      <Pressable disabled={busy} onPress={onSkip}><Text style={[styles.skip, {color: theme.primary}]}>{t.roles.skip}</Text></Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  container: {flex: 1, padding: 20, justifyContent: "center", gap: 12},
  title: {fontSize: 22, fontWeight: "700"},
  subtitle: {fontSize: 13, marginTop: 4, marginBottom: 8},
  error: {fontSize: 13, marginBottom: 4},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 8},
  fixed: {fontWeight: "700"},
  option: {borderWidth: 1, borderRadius: 8, padding: 10},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  skip: {textAlign: "center", marginTop: 8},
});
