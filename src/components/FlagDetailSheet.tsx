import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import type {Flag} from "../api/flags";
import {flagStatusColor, flagStatusLabel} from "./flagStatus";
import {flagTypeLabel} from "../i18n/labels";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";

type Props = {
  t: Strings;
  flag: Flag | null;
  isOwn: boolean;
  busy: boolean;
  voted: boolean;
  denied: boolean;
  centered?: boolean;
  onClose: () => void;
  onConfirm: (flagId: string) => void;
  onDeny: (flagId: string) => void;
  onRemove: (flagId: string) => void;
};

export default function FlagDetailSheet({t, flag, isOwn, busy, voted, denied, centered, onClose, onConfirm, onDeny, onRemove}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  if (!flag) return null;
  return (
    <View style={[centered ? styles.card : styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border, paddingBottom: insets.bottom + 12}]}>
      <View style={styles.headRow}>
        <Text style={[styles.title, {color: theme.text}]}>{flagTypeLabel(flag.type, t)}</Text>
        <View style={[styles.statusChip, {backgroundColor: flagStatusColor(flag.status)}]}>
          <Text style={styles.statusText}>{flagStatusLabel(flag.status, t)}</Text>
        </View>
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={22} color={theme.text} />
        </Pressable>
      </View>
      <Text style={[styles.meta, {color: theme.muted}]}>
        {flag.voteCount ?? 0} {t.flag.votes} · {flag.lat.toFixed(5)}, {flag.lng.toFixed(5)}
      </Text>
      {flag.note ? <Text style={{color: theme.text}}>{flag.note}</Text> : null}
      <View style={styles.actionRow}>
        {flag.status === "1" && !isOwn && !voted ? (
          <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => onConfirm(flag.id)}>
            <Text style={styles.actionBtnText}>{t.flag.confirm}</Text>
          </Pressable>
        ) : null}
        {flag.status === "1" && !isOwn && !denied ? (
          <Pressable style={[styles.actionBtn, styles.actionBtnOutline, {borderColor: theme.border}, busy && styles.disabled]} disabled={busy} onPress={() => onDeny(flag.id)}>
            <Text style={[styles.actionBtnText, {color: theme.text}]}>{t.flag.deny}</Text>
          </Pressable>
        ) : null}
        {isOwn && flag.status !== "3" ? (
          <Pressable style={[styles.actionBtn, styles.actionBtnOutline, {borderColor: theme.danger}, busy && styles.disabled]} disabled={busy} onPress={() => onRemove(flag.id)}>
            <Text style={[styles.actionBtnText, {color: theme.danger}]}>{t.flag.remove}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 12, gap: 8, maxHeight: "85%"},
  card: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 10, width: "100%"},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 16, fontWeight: "700"},
  statusChip: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  meta: {fontSize: 13},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 12, alignItems: "center"},
  actionBtnOutline: {borderWidth: 1, backgroundColor: "transparent"},
  actionBtnText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
