import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {PermissionState} from "../../services/permissions";

type Props = {
  t: Strings;
  theme: AppTheme;
  icon: string;
  title: string;
  hint: string;
  state: PermissionState | null;
  busy?: boolean;
  mode: "gate" | "manage";
  onGrant: () => void;
};

export default function PermissionRow({t, theme, icon, title, hint, state, busy = false, mode, onGrant}: Props) {
  const granted = state?.granted ?? false;
  const canAskAgain = state?.canAskAgain ?? true;
  const label = canAskAgain ? (mode === "gate" ? t.more.gateGrant : t.more.permEnable) : t.more.permOpenSettings;
  return (
    <View style={mode === "gate" ? [styles.gateRow, {borderColor: theme.border, backgroundColor: theme.paper}] : styles.manageRow}>
      <MaterialIcons name={icon as never} size={mode === "gate" ? 26 : 20} color={theme.primary} />
      <View style={styles.text}>
        <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
        <Text style={[styles.hint, {color: theme.muted}]}>{hint}</Text>
      </View>
      {mode === "manage" ? (
        <View style={[styles.pill, {backgroundColor: granted ? theme.primary : theme.divider}]}>
          <Text style={styles.pillText}>{granted ? t.more.permOn : t.more.permOff}</Text>
        </View>
      ) : null}
      {granted ? (
        mode === "gate" ? <MaterialIcons name="check-circle" size={30} color={theme.primary} /> : null
      ) : (
        <Pressable
          style={mode === "gate" ? [styles.gateBtn, {backgroundColor: theme.primary}, busy && styles.disabled] : [styles.manageBtn, {borderColor: theme.border}]}
          disabled={busy}
          onPress={onGrant}
          accessibilityRole="button"
          accessibilityLabel={label}
        >
          <Text style={mode === "gate" ? styles.gateBtnText : [styles.manageBtnText, {color: theme.primary}]}>{label}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gateRow: {flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 16, padding: 16},
  manageRow: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 16},
  text: {flex: 1, minWidth: 0, gap: 3},
  title: {fontSize: 15, fontWeight: "600"},
  hint: {fontSize: 12},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 10},
  pillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  gateBtn: {borderRadius: 999, paddingVertical: 10, paddingHorizontal: 20, alignItems: "center"},
  gateBtnText: {color: "#fff", fontWeight: "700", fontSize: 14},
  manageBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  manageBtnText: {fontSize: 13, fontWeight: "700"},
  disabled: {opacity: 0.6},
});
