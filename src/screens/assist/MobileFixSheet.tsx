import {useState} from "react";
import {StyleSheet, View} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import Overlay from "../../components/overlay/Overlay";
import {formatAmountInput, parseAmountInput} from "./money";

type Props = {
  t: Strings;
  ticketLabel: string;
  busy: boolean;
  error: string | null;
  initialAmount: number | null;
  onSubmit: (amount: number) => void;
  onClose: () => void;
};

export default function MobileFixSheet({
  t,
  ticketLabel,
  busy,
  error,
  initialAmount,
  onSubmit,
  onClose,
}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [amount, setAmount] = useState(
    typeof initialAmount === "number" ? initialAmount.toLocaleString("en-US") : "",
  );
  const [localError, setLocalError] = useState<string | null>(null);
  function submit(): void {
    const parsed = parseAmountInput(amount);
    if (parsed === null) {
      setLocalError(t.provider.invalidAmount);
      return;
    }
    setLocalError(null);
    onSubmit(parsed);
  }
  return (
    <Overlay
      visible
      variant="dialog"
      title={`${t.assist.mobileFixTitle} · ${ticketLabel}`}
      closeLabel={t.common.cancel}
      onClose={onClose}
      scrollable={false}
      actions={[{label: t.assist.mobileFixSave, tone: "primary", busy, onPress: submit}]}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        {localError ? <Text style={[styles.hint, {color: theme.danger}]}>{localError}</Text> : null}
        <Text style={[styles.label, {color: theme.text}]}>{t.assist.mobileFixAmount}</Text>
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
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 15},
  hint: {fontSize: 13},
});