import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";

type Props = {
  t: Strings;
  title: string;
  status: string;
  reasons: readonly string[];
  labelFor: (reason: string, t: Strings) => string;
  busy: boolean;
  error: string | null;
  onSubmit: (reason: string) => void;
  onClose: () => void;
};

export default function CancelReasonSheet({t, title, status, reasons, labelFor, busy, error, onSubmit, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [reason, setReason] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  function submit(): void {
    if (reason === null) {
      setLocalError(t.dispute.needReason);
      return;
    }
    setLocalError(null);
    onSubmit(reason);
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={title}
      right={<TicketStatusPill t={t} theme={theme} status={status} />}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[{label: t.assist.cancelReasonSubmit, tone: "danger", busy, onPress: submit}]}
      scrollable={false}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <View style={styles.chipRow}>
          {reasons.map((value) => (
            <Pressable
              key={value}
              onPress={() => setReason(value)}
              style={[styles.chip, {borderColor: theme.danger}, reason === value && {backgroundColor: theme.danger}]}
              accessibilityRole="button"
              accessibilityState={{checked: reason === value}}
              accessibilityLabel={labelFor(value, t)}
            >
              <Text style={{color: reason === value ? "#fff" : theme.text}}>{labelFor(value, t)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.noteRow}>
          <MaterialIcons name="info-outline" size={15} color={theme.muted} />
          <Text style={[styles.hint, {color: theme.muted}]}>{t.dispute.needReason}</Text>
        </View>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10, width: "100%"},
  hint: {fontSize: 12},
  chipRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 7, paddingHorizontal: 12},
  noteRow: {flexDirection: "row", alignItems: "center", gap: 6},
});
