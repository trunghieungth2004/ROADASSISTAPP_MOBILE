import {Pressable, StyleSheet, View} from "react-native";
import ServiceIcon from "../../components/ui/ServiceIcon";
import {AppText as Text} from "../../components/ui/AppText";
import type {Bill} from "../../api/bills";
import type {Strings} from "../../i18n/en";
import {onColor, type AppTheme} from "../../theme";
import {billDateTimeLabel, billServiceType, billStatusColor, billStatusLabel, billTitle, payeeSummary, payoutStatusColor, payoutStatusLabel} from "./billLabels";

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
  const service = billServiceType(bill);
  const pillColor = summary !== null ?
    payoutStatusColor(summary.payout, theme) :
    billStatusColor(bill.status, theme);
  const pillLabel = summary !== null ?
    payoutStatusLabel(summary.payout, t) :
    billStatusLabel(bill.status, t);
  return (
    <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${billTitle(bill, t)} ${(summary?.net ?? bill.total).toLocaleString()} VND`}>
        <View style={styles.head}>
          <View style={[styles.icon, {backgroundColor: `${theme.primary}22`}]}>
            <ServiceIcon service={service} size={22} color={theme.primary} />
          </View>
          <View style={styles.headText}>
            <Text style={[styles.title, {color: theme.text}]}>{billTitle(bill, t)}</Text>
            <Text style={[styles.meta, {color: theme.muted}]}>
              {[billDateTimeLabel(bill.createdAt), `#${bill.ticketId.slice(-6)}`].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View style={[styles.pill, {backgroundColor: pillColor}]}>
            <Text style={[styles.pillText, {color: onColor(pillColor)}]}>{pillLabel}</Text>
          </View>
        </View>
        <View style={styles.money}>
          {payee && summary !== null ? (
            <>
              {summary.collected > 0 ? (
                <View style={styles.moneyRow}>
                  <Text style={[styles.moneyLabel, {color: theme.muted}]}>{`${t.payments.collected} ${summary.collected.toLocaleString()}`}</Text>
                </View>
              ) : null}
              <View style={styles.moneyRow}>
                <Text style={[styles.moneyLabel, {color: theme.muted}]}>{t.payments.gross}</Text>
                <Text style={[styles.moneyValue, {color: theme.text}]}>{`${bill.total.toLocaleString()} VND`}</Text>
              </View>
              <View style={styles.moneyRow}>
                <Text style={[styles.moneyLabel, {color: theme.muted}]}>{t.payments.commission}</Text>
                <Text style={[styles.moneyValue, {color: "#d97706"}]}>{`${summary.commission.toLocaleString()} VND`}</Text>
              </View>
              <View style={styles.moneyRow}>
                <Text style={[styles.moneyLabel, {color: theme.muted}]}>{t.payments.netPayout}</Text>
                <Text style={[styles.moneyStrong, {color: theme.success}]}>{`${summary.net.toLocaleString()} VND`}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.moneyRow}>
                <Text style={[styles.moneyLabel, {color: theme.muted}]}>{t.bills.total}</Text>
                <Text style={[styles.moneyValue, {color: theme.text}]}>{`${bill.total.toLocaleString()} VND`}</Text>
              </View>
              <View style={styles.moneyRow}>
                <Text style={[styles.moneyLabel, {color: theme.muted}]}>{t.bills.due}</Text>
                <Text style={[styles.moneyStrong, {color: bill.due > 0 ? "#d97706" : theme.success}]}>{`${bill.due.toLocaleString()} VND`}</Text>
              </View>
            </>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {borderWidth: 1, borderRadius: 18, padding: 16, gap: 12},
  head: {flexDirection: "row", alignItems: "center", gap: 10},
  icon: {width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center"},
  headText: {flex: 1, gap: 2},
  title: {fontWeight: "700", fontSize: 15.5},
  meta: {fontSize: 11},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {fontSize: 11, fontWeight: "700"},
  money: {gap: 3, marginTop: 2},
  moneyRow: {flexDirection: "row", justifyContent: "space-between", alignItems: "center"},
  moneyLabel: {fontSize: 12},
  moneyValue: {fontSize: 13, fontWeight: "600"},
  moneyStrong: {fontSize: 15, fontWeight: "800"},
});
