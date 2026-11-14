import {Pressable, StyleSheet, View} from "react-native";
import ServiceIcon from "../../components/ui/ServiceIcon";
import {AppText as Text} from "../../components/ui/AppText";
import type {Bill} from "../../api/bills";
import type {RefundRequest} from "../../api/refunds";
import type {Strings} from "../../i18n/en";
import {onColor, type AppTheme} from "../../theme";
import {
  billDateLabel,
  billServiceType,
  billTitle,
  refundStatusColor,
  refundStatusLabel,
} from "./billLabels";

type Props = {
  refund: RefundRequest;
  bill: Bill | null;
  t: Strings;
  theme: AppTheme;
  onPress: () => void;
};

export default function RefundRow({refund, bill, t, theme, onPress}: Props) {
  const service = bill ? billServiceType(bill) : "REPAIR";
  const title = bill ? billTitle(bill, t) : t.bills.refund;
  const pillColor = refundStatusColor(refund.status, theme);
  return (
    <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title} ${refund.amount.toLocaleString()} VND`}
      >
        <View style={styles.head}>
          <View style={[styles.icon, {backgroundColor: `${theme.primary}22`}]}>
            <ServiceIcon service={service} size={22} color={theme.primary} />
          </View>
          <View style={styles.headText}>
            <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
            <Text style={[styles.meta, {color: theme.muted}]}>
              {[billDateLabel(refund.requestedAt), `#${refund.ticketId.slice(-6)}`].filter(Boolean).join(" · ")}
            </Text>
          </View>
          <View style={[styles.pill, {backgroundColor: pillColor}]}>
            <Text style={[styles.pillText, {color: onColor(pillColor)}]}>
              {refundStatusLabel(refund.status, t)}
            </Text>
          </View>
        </View>
        <View style={styles.money}>
          <View style={styles.moneyRow}>
            <Text style={[styles.moneyLabel, {color: theme.muted}]}>{t.bills.refund}</Text>
            <Text style={[styles.moneyStrong, {color: theme.text}]}>
              {`${refund.amount.toLocaleString()} VND`}
            </Text>
          </View>
          {refund.reason ? (
            <Text style={[styles.reason, {color: theme.muted}]}>
              {`${t.bills.refundReason}: ${refund.reason}`}
            </Text>
          ) : null}
          {refund.transferRef ? (
            <Text style={[styles.reason, {color: theme.muted}]}>
              {`${t.payments.refundTransferRef}: ${refund.transferRef}`}
            </Text>
          ) : null}
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
  moneyStrong: {fontSize: 15, fontWeight: "800"},
  reason: {fontSize: 12},
});
