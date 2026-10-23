import {Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useAppMode} from "../context/ThemeContext";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {darkTheme, lightTheme} from "../theme";
import Snack from "../components/ui/Snack";
import {SNACK_GAP} from "../components/ui/snackOffset";
import PermissionRow from "../components/permissions/PermissionRow";
import type {Strings} from "../i18n/en";
import type {AppPermissionStates} from "../services/permissions";

type Props = {
  t: Strings;
  states: AppPermissionStates | null;
  busy: boolean;
  showBackground: boolean;
  canDone: boolean;
  grantError: string | null;
  onHideGrantError: () => void;
  onGrantNotifications: () => void;
  onGrantCamera: () => void;
  onGrantPhotos: () => void;
  onGrantBackground: () => void;
  onOpenBattery: () => void;
  onSkip: () => void;
  onDone: () => void;
};

export default function PermissionGateScreen({t, states, busy, showBackground, canDone, grantError, onHideGrantError, onGrantNotifications, onGrantCamera, onGrantPhotos, onGrantBackground, onOpenBattery, onSkip, onDone}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, {backgroundColor: theme.background, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16}]}>
      <ScrollView contentContainerStyle={styles.body}>
        <MaterialIcons name="verified-user" size={48} color={theme.primary} />
        <Text style={[styles.title, {color: theme.text}]}>{t.more.gateTitle}</Text>
        <PermissionRow
          t={t}
          theme={theme}
          mode="gate"
          icon="notifications"
          title={t.more.permNotifications}
          hint={t.more.permNotificationsHint}
          state={states?.notifications ?? null}
          busy={busy}
          onGrant={onGrantNotifications}
        />
        <PermissionRow
          t={t}
          theme={theme}
          mode="gate"
          icon="photo-camera"
          title={t.more.permCamera}
          hint={t.more.permCameraHint}
          state={states?.camera ?? null}
          busy={busy}
          onGrant={onGrantCamera}
        />
        <PermissionRow
          t={t}
          theme={theme}
          mode="gate"
          icon="photo-library"
          title={t.more.permPhotos}
          hint={t.more.permPhotosHint}
          state={states?.mediaLibrary ?? null}
          busy={busy}
          onGrant={onGrantPhotos}
        />
        {showBackground ? (
          <PermissionRow
            t={t}
            theme={theme}
            mode="gate"
            icon="location-on"
            title={t.more.permBackground}
            hint={t.more.permBackgroundHint}
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
  rowText: {flex: 1, minWidth: 0, gap: 4},
  rowTitle: {fontSize: 16, fontWeight: "700"},
  rowDesc: {fontSize: 13},
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
