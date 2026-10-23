import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../../components/ui/AppText";
import type {Strings} from "../../../i18n/en";
import {onColor, type AppTheme} from "../../../theme";
import {DISPATCH_STATUS, type FeedTicket} from "../../../api/dispatch";
import {paymentMethodLabel, paymentStatusLabel} from "../../../api/payments";
import type {Bill} from "../../../api/bills";
import {billStatusColor, billStatusLabel} from "../../bills/billLabels";
import type {EstimateState} from "../recordActions";
import {CardHead, DetailCard, FeeRow, detailStyles} from "./parts";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticket: FeedTicket;
  bill: Bill | null;
  busy: boolean;
  payable: boolean;
  waitingMinutes: number | null;
  waitingFee: number | null;
  showWaiting: boolean;
  estimateAmount: number | null;
  estimateNote: string | null;
  estimateState: EstimateState;
  onApproveEstimate: ((ticket: FeedTicket) => void) | null;
  onDeclineEstimate: ((ticket: FeedTicket) => void) | null;
  onApproveFinal: ((ticket: FeedTicket) => void) | null;
  payMethod: string | null;
  payStatus: string | null;
  onConfirmCash: ((ticket: FeedTicket) => void) | null;
  onOpenBill: ((ticket: FeedTicket) => void) | null;
};

function vnd(amount: number): string {
  return `${amount.toLocaleString()} VND`;
}

export default function FeesCard({t, theme, ticket, bill, busy, payable, waitingMinutes, waitingFee, showWaiting, estimateAmount, estimateNote, estimateState, onApproveEstimate, onDeclineEstimate, onApproveFinal, payMethod, payStatus, onConfirmCash, onOpenBill}: Props) {
  const towFare = ticket.ticketType === "TOW" && ticket.towFare !== null && typeof ticket.towFare === "object" ? ticket.towFare : null;
  const towHasFare = towFare !== null && typeof towFare.estimate === "number";
  const towFinal = towHasFare && typeof towFare.final === "number" ? towFare.final : null;
  const towCeiling = towHasFare && typeof towFare.ceiling === "number" ? towFare.ceiling : null;
  const shopQuote = typeof ticket.shopQuotedAmount === "number" ? ticket.shopQuotedAmount : null;
  const finalAmount = typeof ticket.finalAmount === "number" ? ticket.finalAmount : null;
  const waitingExtra = waitingFee !== null && waitingFee > 0 ? waitingFee : 0;
  const isTow = ticket.ticketType === "TOW";
  let total: {label: string; amount: number} | null = null;
  if (bill !== null) total = {label: t.bills.total, amount: bill.total};
  else if (towFinal !== null) total = {label: t.bills.total, amount: towFinal + waitingExtra};
  else if (shopQuote !== null) total = {label: t.bills.total, amount: shopQuote + (isTow ? waitingExtra : 0)};
  else if (finalAmount !== null) total = {label: t.bills.total, amount: finalAmount + (isTow ? waitingExtra : 0)};
  else if (estimateAmount !== null) total = {label: t.assist.estimatedTotal, amount: estimateAmount + (isTow ? waitingExtra : 0)};
  const hasBillable = towHasFare || shopQuote !== null || finalAmount !== null || bill !== null;
  const towResolved = !isTow || ticket.status === DISPATCH_STATUS.RESOLVED;
  const hasShopBill = bill !== null && bill.items.some((item) => item.kind !== "TOW_FARE");
  const billLink = onOpenBill !== null && (isTow || ticket.ticketType === "WALK_IN" || ticket.ticketType === "MECHANIC") && (ticket.direction === "out" || hasBillable) && (towResolved || hasShopBill);
  const billPillColor = bill !== null ? billStatusColor(bill.status, theme) : theme.primary;
  const payColor = payStatus === "CONFIRMED" ? theme.success : payStatus === "HELD" || payStatus === "PENDING" ? "#d97706" : payStatus === "REFUNDED" || payStatus === "PARTIAL" ? "#8b5cf6" : theme.primary;
  const showFinalActions = ticket.direction === "out" && payable && finalAmount !== null;
  if (!towHasFare && shopQuote === null && finalAmount === null && estimateAmount === null && !showWaiting && payMethod === null && bill === null && !billLink) return null;
  return (
    <DetailCard theme={theme}>
      <CardHead
        theme={theme}
        icon="payments"
        title={t.assist.paymentTitle}
        right={bill !== null ? (
          <View style={[detailStyles.pill, {backgroundColor: billPillColor}]}>
            <Text style={[detailStyles.pillText, {color: onColor(billPillColor)}]}>{billStatusLabel(bill.status, t)}</Text>
          </View>
        ) : undefined}
      />
      {towFinal !== null ? (
        <Text style={[styles.fareLine, {color: theme.text}]}>{`${towFare?.partial === true ? t.assist.farePartial : t.assist.fareFinal}: ${vnd(towFinal)}`}</Text>
      ) : towCeiling !== null ? (
        <Text style={[styles.fareLine, {color: theme.text}]}>{`${t.assist.fareUpTo}: ${vnd(towCeiling)}`}</Text>
      ) : null}
      {estimateAmount !== null ? (
        <View style={styles.block}>
          <View style={detailStyles.rowBetween}>
            <Text style={[detailStyles.name, {color: theme.text}]}>{t.assist.estimateTitle}</Text>
            <Text style={[detailStyles.name, {color: theme.text}]}>{vnd(estimateAmount)}</Text>
          </View>
          {estimateNote !== null ? <Text style={[detailStyles.muted, {color: theme.muted}]}>{estimateNote}</Text> : null}
          <Text style={[detailStyles.muted, {color: estimateState === "expired" ? theme.danger : theme.muted}]}>
            {estimateState === "approved" ? t.assist.estimateStateApproved : estimateState === "expired" ? t.assist.estimateStateExpired : t.assist.estimateStateAwaiting}
          </Text>
          {ticket.direction === "out" && estimateState === "pending" && (onApproveEstimate !== null || onDeclineEstimate !== null) ? (
            <View style={styles.estimateActions}>
              {onDeclineEstimate !== null ? (
                <Pressable style={[styles.halfBtn, styles.declineBtn, {borderColor: theme.danger}, busy && detailStyles.disabled]} disabled={busy} onPress={() => onDeclineEstimate(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.declineEstimate}>
                  <Text style={[styles.halfText, {color: theme.danger}]}>{t.assist.decline}</Text>
                </Pressable>
              ) : null}
              {onApproveEstimate !== null ? (
                <Pressable style={[styles.halfBtn, {backgroundColor: theme.primary}, busy && detailStyles.disabled]} disabled={busy} onPress={() => onApproveEstimate(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.approve}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.halfText}>{t.assist.approve}</Text>}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
      {estimateAmount !== null && (shopQuote !== null || finalAmount !== null || showWaiting) ? (
        <View style={[detailStyles.divider, {backgroundColor: theme.divider}]} />
      ) : null}
      {shopQuote !== null ? <FeeRow theme={theme} label={t.assist.quote} value={vnd(shopQuote)} /> : null}
      {finalAmount !== null ? <FeeRow theme={theme} label={t.assist.finalTitle} value={vnd(finalAmount)} /> : null}
      {showWaiting ? (
        <View style={styles.waitRow}>
          <MaterialIcons name="schedule" size={15} color="#f59e0b" />
          <Text style={[detailStyles.muted, {color: theme.text, flex: 1}]}>
            {t.assist.waitingTitle}{waitingMinutes !== null && waitingMinutes > 0 ? ` · ${waitingMinutes} ${t.route.min}` : ""}{waitingFee !== null && waitingFee > 0 ? ` · ${vnd(waitingFee)}` : ""}
          </Text>
        </View>
      ) : null}
      {total !== null ? (
        <View style={[styles.total, {borderTopColor: theme.divider}]}>
          <FeeRow theme={theme} label={total.label} value={vnd(total.amount)} strong />
        </View>
      ) : null}
      {bill !== null && bill.paid > 0 ? <FeeRow theme={theme} label={t.bills.paid} value={vnd(bill.paid)} valueColor={theme.success} /> : null}
      {bill !== null && bill.due > 0 ? <FeeRow theme={theme} label={t.bills.due} value={vnd(bill.due)} valueColor="#d97706" /> : null}
      {payMethod !== null ? (
        <View style={[styles.payBlock, {borderTopColor: theme.divider}]}>
          <View style={styles.payRow}>
            <MaterialIcons name="credit-card" size={15} color={theme.primary} />
            <View style={[styles.payPill, {backgroundColor: payColor}]}>
              <Text style={[styles.payPillText, {color: "#fff"}]}>
                {paymentMethodLabel(payMethod)}{payStatus !== null ? ` · ${payStatus === "HELD" && payMethod === "SEPAY" ? t.assist.sepayHeld : paymentStatusLabel(payStatus)}` : ""}
              </Text>
            </View>
          </View>
          {payMethod === "CASH" && payStatus !== "CONFIRMED" && onConfirmCash !== null ? (
            <Pressable style={[styles.primaryBtn, {backgroundColor: theme.primary}, busy && detailStyles.disabled]} disabled={busy} onPress={() => onConfirmCash(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.cashConfirmReceipt}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.assist.cashConfirmReceipt}</Text>}
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {showFinalActions && onApproveFinal !== null ? (
        <View style={detailStyles.inlineActions}>
          <Pressable style={[styles.primaryBtn, {backgroundColor: theme.primary}, busy && detailStyles.disabled]} disabled={busy} onPress={() => onApproveFinal(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.approve}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.assist.approve}</Text>}
          </Pressable>
        </View>
      ) : null}
      {billLink ? (
        <Pressable style={[styles.linkRow, {borderColor: theme.border}]} onPress={() => onOpenBill?.(ticket)} accessibilityRole="button" accessibilityLabel={t.bills.openBill}>
          <MaterialIcons name="receipt-long" size={16} color={theme.primary} />
          <Text style={[detailStyles.muted, {color: theme.primary, flex: 1}]}>{t.bills.openBill}</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.muted} />
        </Pressable>
      ) : null}
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  fareLine: {fontSize: 13, fontWeight: "600"},
  block: {gap: 6},
  payBlock: {borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 6},
  waitRow: {flexDirection: "row", alignItems: "center", gap: 6},
  total: {borderTopWidth: 1, paddingTop: 8},
  payRow: {flexDirection: "row", alignItems: "center", gap: 6},
  primaryBtn: {borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center"},
  primaryText: {color: "#fff", fontWeight: "700"},
  linkRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10},
  estimateActions: {flexDirection: "row", gap: 8, marginTop: 4},
  halfBtn: {flex: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center", justifyContent: "center"},
  declineBtn: {borderWidth: 1},
  halfText: {fontWeight: "700"},
  payPill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  payPillText: {fontSize: 12, fontWeight: "700"},
});
