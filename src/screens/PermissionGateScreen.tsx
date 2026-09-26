import {Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
import type {AppPermissionStates, PermissionState} from "../services/permissions";

type Props = {
  t: Strings;
  states: AppPermissionStates | null;
  busy: boolean;
  showBackground: boolean;
  canDone: boolean;
  onGrantNotifications: () => void;
  onGrantBackground: () => void;
  onSkip: () => void;
  onDone: () => void;
};

function Row({t, theme, icon, title, desc, state, busy, onGrant}: {
  t: Strings;
  theme: {primary: string; text: string; muted: string; border: string; paper: string};
  icon: string;
  title: string;
  desc: string;
  state: PermissionState | null;
  busy: boolean;
  onGrant: () => void;
}) {
  const granted = state?.granted ?? false;
  return (
    <View style={[styles.row, {borderColor: theme.border, backgroundColor: theme.paper}]}>
      <MaterialIcons name={icon as never} size={26} color={theme.primary} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, {color: theme.text}]}>{title}</Text>
        <Text style={[styles.rowDesc, {color: theme.muted}]}>{desc}</Text>
      </View>
      {granted ? (
        <MaterialIcons name="check-circle" size={30} color={theme.primary} />
      ) : (
        <Pressable style={[styles.grantBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={onGrant} accessibilityRole="button" accessibilityLabel={t.more.gateGrant}>
          <Text style={styles.grantText}>{t.more.gateGrant}</Text>
        </Pressable>
      )}
    </View>
  );
}

export default function PermissionGateScreen({t, states, busy, showBackground, canDone, onGrantNotifications, onGrantBackground, onSkip, onDone}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {backgroundColor: theme.background, paddingTop: insets.top + 24}]}>
      <ScrollView contentContainerStyle={styles.body}>
        <MaterialIcons name="verified-user" size={48} color={theme.primary} />
        <Text style={[styles.title, {color: theme.text}]}>{t.more.gateTitle}</Text>
        <Row
          t={t}
          theme={theme}
          icon="notifications"
          title={t.more.permNotifications}
          desc={t.more.permNotificationsHint}
          state={states?.notifications ?? null}
          busy={busy}
          onGrant={onGrantNotifications}
        />
        {showBackground ? (
          <Row
            t={t}
            theme={theme}
            icon="location-on"
            title={t.more.permBackground}
            desc={t.more.permBackgroundHint}
            state={states?.backgroundLocation ?? null}
            busy={busy}
            onGrant={onGrantBackground}
          />
        ) : null}
        <Pressable style={styles.skipBtn} disabled={busy} onPress={onSkip} accessibilityRole="button" accessibilityLabel={t.more.gateSkip}>
          <Text style={[styles.skipText, {color: theme.muted}]}>{t.more.gateSkip}</Text>
        </Pressable>
        <Pressable style={[styles.doneBtn, {backgroundColor: theme.primary}, (!canDone || busy) && styles.disabled]} disabled={!canDone || busy} onPress={onDone} accessibilityRole="button" accessibilityLabel={t.more.gateDone}>
          <Text style={styles.doneText}>{t.more.gateDone}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  body: {gap: 12, paddingHorizontal: 24, paddingBottom: 24, alignItems: "stretch"},
  title: {fontSize: 22, fontWeight: "700", textAlign: "center", marginVertical: 8},
  row: {flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 16},
  rowText: {flex: 1, minWidth: 0, gap: 4},
  rowTitle: {fontSize: 16, fontWeight: "700"},
  rowDesc: {fontSize: 13},
  grantBtn: {borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, alignItems: "center"},
  grantText: {color: "#fff", fontWeight: "700", fontSize: 14},
  skipBtn: {alignItems: "center", paddingVertical: 12},
  skipText: {fontSize: 15, fontWeight: "700"},
  doneBtn: {borderRadius: 14, padding: 15, alignItems: "center", marginTop: 4},
  doneText: {color: "#fff", fontWeight: "700", fontSize: 16},
  disabled: {opacity: 0.6},
});
