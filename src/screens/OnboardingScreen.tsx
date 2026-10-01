import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import type {Strings} from "../i18n/en";
import {darkTheme, lightTheme} from "../theme";
export type OnboardingProps = {t: Strings; busy?: boolean; error?: string | null; onFinish: (services: string[]) => void; onSkip: () => void};
export default function OnboardingScreen({t, busy, error, onFinish, onSkip}: OnboardingProps) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <View style={[styles.container, {backgroundColor: theme.background}]}>
      <Text style={[styles.title, {color: theme.text}]}>{t.roles.title}</Text>
      <Text style={[styles.subtitle, {color: theme.muted}]}>{t.roles.subtitle}</Text>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}><Text style={[styles.fixed, {color: theme.text}]}>{t.roles.rider} — {t.roles.riderHint}</Text></View>
      <Pressable disabled={busy} onPress={() => onFinish(["RIDER"])} style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]}>
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
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  skip: {textAlign: "center", marginTop: 8},
});
