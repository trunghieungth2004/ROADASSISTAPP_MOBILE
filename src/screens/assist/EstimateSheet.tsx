import {useState} from "react";
import {StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {statusPillColor, ticketStatusLabel} from "./ticketLabels";
import {formatAmountInput, parseAmountInput} from "./money";

type Props = {
  t: Strings;
  ticketLabel: string;
  status: string;
  busy: boolean;
  error: string | null;
  initialAmount?: number | null;
  initialNote?: string | null;
  onSubmit: (amount: number, note: string) => void;
  onClose: () => void;
};

export default function EstimateSheet({t, ticketLabel, status, busy, error, initialAmount, initialNote, onSubmit, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [amount, setAmount] = useState(typeof initialAmount === "number" ? formatAmountInput(String(initialAmount)) : "");
  const [note, setNote] = useState(typeof initialNote === "string" ? initialNote : "");
  const [localError, setLocalError] = useState<string | null>(null);
  function send(): void {
    const parsed = parseAmountInput(amount);
    if (parsed === null) {
      setLocalError(t.provider.invalidAmount);
      return;
    }
    setLocalError(null);
    onSubmit(parsed, note.trim());
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.assist.estimateTitle} · ${ticketLabel}`}
      right={
        <View style={[styles.pill, {backgroundColor: statusPillColor(status, theme)}]}>
          <Text style={styles.pillText}>{ticketStatusLabel(status, t)}</Text>
        </View>
      }
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.assist.sendEstimate, tone: "primary", busy, onPress: send}]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <Text style={[styles.label, {color: theme.text}]}>{t.assist.estimateAmount}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={amount}
          onChangeText={(value) => {
            setAmount(formatAmountInput(value));
            setLocalError(null);
          }}
          placeholder="0"
          placeholderTextColor={theme.muted}
          keyboardType="number-pad"
          autoFocus
        />
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={note}
          onChangeText={setNote}
          placeholder={t.assist.estimateNotePlaceholder}
          placeholderTextColor={theme.muted}
          maxLength={500}
        />
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15},
  hint: {fontSize: 13},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
});
