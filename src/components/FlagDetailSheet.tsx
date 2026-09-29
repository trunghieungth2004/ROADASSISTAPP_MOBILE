import {Keyboard, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {Flag} from "../api/flags";
import {flagStatusColor, flagStatusLabel} from "./flagStatus";
import {hazardKind} from "./hazardStyle";
import {flagTypeLabel} from "../i18n/labels";
import {FLAG_CONSENSUS_THRESHOLD} from "../api/flags";
import {flagActions, formatUntil, joinMeta} from "../screens/hazards/flagActions";
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
  if (!flag) return null;
  const kind = hazardKind(flag.type);
  const close = (): void => {
    Keyboard.dismiss();
    onClose();
  };
  const actions = flagActions(flag.status, isOwn);
  const canConfirm = actions.includes("confirm") && !voted;
  const canDeny = actions.includes("deny") && !denied;
  const canRemove = actions.includes("remove");
  const showLocked = actions.includes("locked");
  const progress = flag.status === "1" ? t.flag.confirmations.replace("{v}", String(Math.max(0, flag.voteCount ?? 0))).replace("{t}", String(FLAG_CONSENSUS_THRESHOLD)) : null;
  const until = formatUntil(flag.ttlExpiresAtMs, Date.now(), t.flag);
  const meta = joinMeta([`${flag.voteCount ?? 0} ${t.flag.votes}`, progress, until]);
  return (
    <View style={[centered ? styles.card : styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <View style={styles.voteRow}>
        <View style={styles.voteSide}>
          {canConfirm ? (
            <Pressable style={[styles.voteBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => onConfirm(flag.id)} accessibilityRole="button" accessibilityLabel={t.flag.confirm}>
              <MaterialIcons name="check" size={20} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.voteCenter}>
          <View style={styles.headRow}>
            <MaterialIcons name={kind.icon} size={22} color={kind.color} />
            <Text style={[styles.title, {color: theme.text}]}>{flagTypeLabel(flag.type, t)}</Text>
            <View style={[styles.statusChip, {backgroundColor: flagStatusColor(flag.status)}]}>
              <Text style={styles.statusText}>{flagStatusLabel(flag.status, t)}</Text>
            </View>
            {showLocked ? (
              <Text style={[styles.lockedNote, {color: theme.muted}]}>{t.flag.lockedNote}</Text>
            ) : null}
          </View>
          <Text style={[styles.meta, {color: theme.muted}]}>{meta}</Text>
          {flag.note ? <Text style={{color: theme.text}}>{flag.note}</Text> : null}
        </View>
        <View style={styles.voteSide}>
          {canDeny ? (
            <Pressable style={[styles.voteBtn, {borderColor: theme.danger, borderWidth: 1}, busy && styles.disabled]} disabled={busy} onPress={() => onDeny(flag.id)} accessibilityRole="button" accessibilityLabel={t.flag.deny}>
              <MaterialIcons name="close" size={20} color={theme.danger} />
            </Pressable>
          ) : null}
        </View>
      </View>
      {canRemove ? (
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, styles.actionBtnOutline, {borderColor: theme.danger}, busy && styles.disabled]} disabled={busy} onPress={() => onRemove(flag.id)}>
            <Text style={[styles.actionBtnText, {color: theme.danger}]}>{t.flag.remove}</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable style={[styles.actionBtn, styles.actionBtnOutline, {borderColor: theme.border}]} onPress={close} accessibilityRole="button" accessibilityLabel={t.common.close}>
        <Text style={[styles.actionBtnText, {color: theme.text}]}>{t.common.close}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {borderRadius: 20, borderWidth: 1, padding: 12, gap: 8, maxHeight: "85%", overflow: "hidden"},
  card: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 10, width: "100%"},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 16, fontWeight: "700"},
  lockedNote: {fontSize: 12, flexShrink: 1},
  voteRow: {flexDirection: "row", alignItems: "center", gap: 8},
  voteSide: {width: 40, alignItems: "center", justifyContent: "center"},
  voteCenter: {flex: 1, minWidth: 0, gap: 6, alignItems: "stretch"},
  voteBtn: {width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center"},
  statusChip: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  meta: {fontSize: 13},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 14, padding: 13, alignItems: "center"},
  actionBtnOutline: {borderWidth: 1, backgroundColor: "transparent"},
  actionBtnText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
