import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Bill} from "../../api/bills";
import type {Strings} from "../../i18n/en";
import {onColor, type AppTheme} from "../../theme";
import {
  billDateLabel,
  billItemCount,
  billPayeeLabel,
  billStatusColor,
  billStatusLabel,
  billTitle,
  payeeSummary,
  payoutStatusColor,
  payoutStatusLabel,
} from "./billLabels";

type Props = {
  bill: Bill;
  t: Strings;
  theme: AppTheme;
  mode?: "rider" | "payee";
  onPress: () => void;
};

export default function BillRow({bill, t, theme, mode = "rider", onPress}: Props) {
  const payee = mode === "payee";
  const summary = payee ? payeeSummary(bill) : null;
  const amount = summary !== null && summary.net > 0 ? summary.net : bill.total;
  const payees = billPayeeLabel(bill);
  const meta = [
    billDateLabel(bill.createdAt),
    billItemCount(bill, t),
    payee ? null : payees,
  ].filter((value) => typeof value === "string" && value !== "").join(" · ");
  const pillColor = summary !== null ?
    payoutStatusColor(summary.payout, theme) :
    billStatusColor(bill.status, theme);
  const pillLabel = summary !== null ?
    payoutStatusLabel(summary.payout, t) :
    billStatusLabel(bill.status, t);
  return (
    <Pressable
      style={[styles.row, {backgroundColor: theme.paper, borderColor: theme.border}]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${billTitle(bill, t)} ${amount.toLocaleString()} VND`}
    >
      <View style={[styles.rowIcon, {backgroundColor: `${theme.primary}22`}]}>
        <MaterialIcons name={bill.ticketType === "TOW" ? "local-shipping" : "build"} size={22} color={theme.primary} />
      </View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowTitle, {color: theme.text}]}>{billTitle(bill, t)}</Text>
        <Text style={[styles.rowMeta, {color: theme.muted}]} numberOfLines={1}>{meta}</Text>
        <Text style={[styles.rowAmount, {color: theme.text}]}>{`${amount.toLocaleString()} VND`}</Text>
      </View>
      <View style={styles.rowSide}>
        <View style={[styles.pill, {backgroundColor: pillColor}]}>
          <Text style={[styles.pillText, {color: onColor(pillColor)}]}>{pillLabel}</Text>
        </View>
        {!payee && bill.due > 0 ? (
          <Text style={[styles.rowDue, {color: "#d97706"}]}>{`${t.bills.due} ${bill.due.toLocaleString()}`}</Text>
        ) : null}
        {payee && summary !== null && summary.collected > 0 ? (
          <Text style={[styles.rowDue, {color: theme.muted}]}>{`${t.payments.collected} ${summary.collected.toLocaleString()}`}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", gap: 12, alignItems: "center"},
  rowIcon: {width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center"},
  rowBody: {flex: 1, gap: 2},
  rowTitle: {fontWeight: "700", fontSize: 15},
  rowMeta: {fontSize: 12},
  rowAmount: {fontWeight: "700", fontSize: 15, marginTop: 2},
  rowSide: {alignItems: "flex-end", gap: 6},
  rowDue: {fontSize: 11, fontWeight: "600"},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {fontSize: 11, fontWeight: "700"},
});
