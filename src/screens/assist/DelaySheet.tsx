import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import {useAppMode} from "../../context/ThemeContext";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import type {Strings} from "../../i18n/en";
import type {FeedTicket} from "../../api/dispatch";
import {delayReasonLabel, delayReasonsFor, type DelayReason} from "./delayReasons";

type Props = {
  t: Strings;
  ticket: FeedTicket;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: DelayReason, note: string, etaAt?: string) => void;
  onClear: () => void;
  canClear?: boolean;
  onClose: () => void;
};

function etaIso(time: string): string | undefined {
  if (!/^\d{2}:\d{2}$/.test(time)) return undefined;
  const today = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const at = new Date(`${today}T${time}:00+07:00`);
  if (Number.isNaN(at.getTime())) return undefined;
  if (at.getTime() < Date.now()) at.setDate(at.getDate() + 1);
  return at.toISOString();
}

export default function DelaySheet({t, ticket, busy, error, onSubmit, onClear, canClear = false, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const reasons = delayReasonsFor(ticket.direction);
  const current = ticket.hold?.reason as DelayReason | undefined;
  const [reason, setReason] = useState<DelayReason>(
    current !== undefined && reasons.includes(current) ?
      current :
      reasons[0] ?? "OTHER",
  );
  const [note, setNote] = useState(ticket.hold?.note ?? "");
  const [eta, setEta] = useState("");

  return (
    <Overlay
      visible
      variant="dialog"
      title={t.assist.reportDelay}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[
        ...(ticket.hold && canClear ? [{label: t.assist.clearDelay, tone: "neutral" as const, outline: true, onPress: onClear}] : []),
        {label: t.assist.saveDelay, tone: "primary" as const, busy, onPress: () => onSubmit(reason, note.trim(), etaIso(eta))},
      ]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        <Text style={[styles.label, {color: theme.text}]}>{t.assist.delayReason}</Text>
        <View style={styles.chips}>
          {reasons.map((value) => {
            const active = value === reason;
            return (
              <Pressable key={value} onPress={() => setReason(value)} style={[styles.chip, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} accessibilityRole="button">
                <Text style={{color: active ? theme.primary : theme.text}}>{delayReasonLabel(value, t)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.label, {color: theme.text}]}>{t.assist.delayNote}</Text>
        <TextInput value={note} onChangeText={setNote} placeholder={t.assist.delayNotePlaceholder} placeholderTextColor={theme.muted} multiline style={[styles.input, styles.note, {borderColor: theme.border, color: theme.text}]} />
        <Text style={[styles.label, {color: theme.text}]}>{t.assist.delayEta}</Text>
        <TextInput value={eta} onChangeText={setEta} placeholder="14:30" placeholderTextColor={theme.muted} keyboardType="numbers-and-punctuation" style={[styles.input, {borderColor: theme.border, color: theme.text}]} />
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8},
  label: {fontSize: 13, fontWeight: "700"},
  hint: {fontSize: 12},
  chips: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  chip: {borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 10, padding: 10},
  note: {minHeight: 80, textAlignVertical: "top"},
});
