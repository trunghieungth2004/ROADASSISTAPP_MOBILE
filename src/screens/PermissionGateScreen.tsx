import {Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {darkTheme, lightTheme, type AppTheme} from "../theme";
import Snack from "../components/ui/Snack";
import {SNACK_GAP} from "../components/ui/snackOffset";
import type {Strings} from "../i18n/en";
import type {AppPermissionStates, PermissionState} from "../services/permissions";

type Props = {
  t: Strings;
  states: AppPermissionStates | null;
  busy: boolean;
  showBackground: boolean;
  canDone: boolean;
  grantError: string | null;
  onHideGrantError: () => void;
  onGrantNotifications: () => void;
  onGrantBackground: () => void;
  onOpenBattery: () => void;
  onSkip: () => void;
  onDone: () => void;
};

function Row({t, theme, icon, title, desc, state, busy, onGrant}: {
  t: Strings;
  theme: AppTheme;
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

export default function PermissionGateScreen({t, states, busy, showBackground, canDone, grantError, onHideGrantError, onGrantNotifications, onGrantBackground, onOpenBattery, onSkip, onDone}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {backgroundColor: theme.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16}]}>
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
        {showBackground ? (
          <View style={[styles.stepRow, {borderColor: theme.border}]}>
            <MaterialIcons name="battery-charging-full" size={26} color={theme.primary} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, {color: theme.text}]}>{t.more.permBattery}</Text>
              <Text style={[styles.rowDesc, {color: theme.muted}]}>{t.more.permBatteryHint}</Text>
              <Text style={[styles.stepManual, {color: theme.muted}]}>{t.more.gateManual}</Text>
            </View>
            <Pressable style={[styles.stepBtn, {borderColor: theme.border}]} onPress={onOpenBattery} accessibilityRole="button" accessibilityLabel={t.more.permOpenSettings}>
              <Text style={[styles.stepText, {color: theme.primary}]}>{t.more.permOpenSettings}</Text>
              <MaterialIcons name="chevron-right" size={18} color={theme.muted} />
            </Pressable>
          </View>
        ) : null}
        <Pressable style={styles.skipBtn} disabled={busy} onPress={onSkip} accessibilityRole="button" accessibilityLabel={t.more.gateSkip}>
          <Text style={[styles.skipText, {color: theme.muted}]}>{t.more.gateSkip}</Text>
        </Pressable>
        <Pressable style={[styles.doneBtn, {backgroundColor: theme.primary}, (!canDone || busy) && styles.disabled]} disabled={!canDone || busy} onPress={onDone} accessibilityRole="button" accessibilityLabel={t.more.gateDone}>
          <Text style={styles.doneText}>{t.more.gateDone}</Text>
        </Pressable>
      </ScrollView>
      <Snack message={grantError} severity="error" sticky bottom={insets.bottom + SNACK_GAP} dangerColor={theme.danger} onHide={onHideGrantError} />
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
  stepRow: {flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderStyle: "dashed", borderRadius: 16, padding: 16},
  stepManual: {fontSize: 12, fontStyle: "italic"},
  stepBtn: {flexDirection: "row", alignItems: "center", gap: 2, borderWidth: 1, borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16},
  stepText: {fontWeight: "700", fontSize: 14},
  skipBtn: {alignItems: "center", paddingVertical: 12},
  skipText: {fontSize: 15, fontWeight: "700"},
  doneBtn: {borderRadius: 14, padding: 15, alignItems: "center", marginTop: 4},
  doneText: {color: "#fff", fontWeight: "700", fontSize: 16},
  disabled: {opacity: 0.6},
});
