import {useState} from "react";
import {StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {statusPillColor, ticketStatusLabel} from "./ticketLabels";
import {formatAmountInput, parseAmountInput} from "./money";

export type WorkFormMode = "quote" | "done";

export type WorkFormValue = {
  workType: string;
  amount: number | null;
  invoiceRef: string;
};

type Props = {
  t: Strings;
  ticketLabel: string;
  mode: WorkFormMode;
  status: string;
  busy: boolean;
  error: string | null;
  initialWorkType?: string | null;
  initialInvoiceRef?: string | null;
  onSubmit: (value: WorkFormValue) => void;
  onClose: () => void;
};

export default function WorkSheet({t, ticketLabel, mode, status, busy, error, initialWorkType, initialInvoiceRef, onSubmit, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [workType, setWorkType] = useState(typeof initialWorkType === "string" ? initialWorkType : "");
  const [amount, setAmount] = useState("");
  const [invoiceRef, setInvoiceRef] = useState(typeof initialInvoiceRef === "string" ? initialInvoiceRef : "");
  const [localError, setLocalError] = useState<string | null>(null);
  function send(): void {
    if (mode === "quote") {
      const parsed = parseAmountInput(amount);
      if (parsed === null) {
        setLocalError(t.provider.invalidAmount);
        return;
      }
      setLocalError(null);
      onSubmit({workType: workType.trim(), amount: parsed, invoiceRef: ""});
      return;
    }
    onSubmit({workType: workType.trim(), amount: null, invoiceRef: invoiceRef.trim()});
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${mode === "quote" ? t.assist.sendQuote : t.provider.workDone} · ${ticketLabel}`}
      right={
        <View style={[styles.pill, {backgroundColor: statusPillColor(status, theme)}]}>
          <Text style={styles.pillText}>{ticketStatusLabel(status, t)}</Text>
        </View>
      }
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: mode === "quote" ? t.assist.sendQuote : t.provider.saveWork, tone: "primary", busy, onPress: send}]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <Text style={[styles.label, {color: theme.text}]}>{t.provider.workType}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={workType}
          onChangeText={setWorkType}
          placeholder={t.provider.workPlaceholder}
          placeholderTextColor={theme.muted}
        />
        {mode === "quote" ? (
          <>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.quotedAmount}</Text>
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
          </>
        ) : (
          <>
            <Text style={[styles.label, {color: theme.text}]}>{t.provider.invoiceRef}</Text>
            <TextInput
              style={[styles.input, {borderColor: theme.border, color: theme.text}]}
              value={invoiceRef}
              onChangeText={setInvoiceRef}
              placeholder={t.provider.invoicePlaceholder}
              placeholderTextColor={theme.muted}
              maxLength={80}
            />
          </>
        )}
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
