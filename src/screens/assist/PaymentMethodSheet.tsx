import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {themeForMode, darkTheme, lightTheme} from "../../theme";
import {useAppMode} from "../../context/ThemeContext";
import Overlay from "../../components/overlay/Overlay";
import TicketStatusPill from "./TicketStatusPill";

type Props = {
  t: Strings;
  amount: number | null;
  status: string;
  busy: boolean;
  error: string | null;
  pendingSepay?: boolean;
  onChoose: (method: "CASH" | "SEPAY") => void;
  onClose: () => void;
};

export default function PaymentMethodSheet({t, amount, status, busy, error, pendingSepay = false, onChoose, onClose}: Props) {
  const scheme = useAppMode();
  const theme = themeForMode(scheme);
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.assist.paymentChoiceTitle}
      right={<TicketStatusPill t={t} theme={theme} status={status} />}
      closeLabel={t.common.cancel}
      onClose={busy ? () => undefined : onClose}
      scrollable={false}
    >
      <View style={styles.body}>
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.paymentChoiceHint}</Text>
        {pendingSepay ? <Text style={[styles.hint, {color: theme.danger}]}>{t.assist.switchCashHint}</Text> : null}
        {amount !== null ? (
          <View style={[styles.amountRow, {borderColor: theme.border}]}>
            <Text style={[styles.amountLabel, {color: theme.muted}]}>{t.bills.total}</Text>
            <Text style={[styles.amount, {color: theme.text}]}>{`${amount.toLocaleString()} ₫`}</Text>
          </View>
        ) : null}
        {error ? <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text> : null}
        <Pressable
          style={[styles.choice, {borderColor: theme.border, backgroundColor: theme.paper}, busy && styles.disabled]}
          disabled={busy}
          onPress={() => onChoose("CASH")}
          accessibilityRole="button"
          accessibilityLabel={t.bills.payCash}
        >
          <View style={[styles.icon, {backgroundColor: theme.primary}]}>
            <MaterialIcons name="payments" size={22} color="#fff" />
          </View>
          <View style={styles.choiceBody}>
            <Text style={[styles.choiceTitle, {color: theme.text}]}>{t.bills.payCash}</Text>
            <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.paymentCashHint}</Text>
          </View>
          
        </Pressable>
        <Pressable
          style={[styles.choice, {borderColor: theme.border, backgroundColor: theme.paper}, busy && styles.disabled]}
          disabled={busy}
          onPress={() => onChoose("SEPAY")}
          accessibilityRole="button"
          accessibilityLabel={t.bills.paySepay}
        >
          <View style={[styles.icon, {backgroundColor: "#0d9488"}]}>
            <MaterialIcons name="qr-code-2" size={22} color="#fff" />
          </View>
          <View style={styles.choiceBody}>
            <Text style={[styles.choiceTitle, {color: theme.text}]}>{t.bills.paySepay}</Text>
            <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.paymentSepayHint}</Text>
          </View>
          
        </Pressable>
        {busy ? <ActivityIndicator color={theme.primary} /> : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10, width: "100%"},
  hint: {fontSize: 12},
  amountRow: {borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  amountLabel: {fontSize: 12, fontWeight: "600"},
  amount: {fontSize: 17, fontWeight: "800"},
  choice: {borderWidth: 1, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 10},
  icon: {width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center"},
  choiceBody: {flex: 1, gap: 2, minWidth: 0},
  choiceTitle: {fontSize: 14, fontWeight: "700"},
  disabled: {opacity: 0.55},
});
