import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../../components/ui/AppText";
import type {Strings} from "../../../i18n/en";
import {onColor, type AppTheme} from "../../../theme";
import {DISPATCH_STATUS, isUnfixableStatus, type FeedTicket} from "../../../api/dispatch";
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
  waitingFee: number | null;
  estimateAmount: number | null;
  estimateNote: string | null;
  estimateState: EstimateState;
  onApproveEstimate: ((ticket: FeedTicket) => void) | null;
  onDeclineEstimate: ((ticket: FeedTicket) => void) | null;
  onApproveFinal: ((ticket: FeedTicket) => void) | null;
  onApproveQuote?: ((ticket: FeedTicket) => void) | null;
  onDeclineQuote?: ((ticket: FeedTicket) => void) | null;
  onApproveMobileFix?: ((ticket: FeedTicket) => void) | null;
  onDeclineMobileFix?: ((ticket: FeedTicket) => void) | null;
  quotePayMethod?: string | null;
  quoteFunded?: boolean;
  payMethod: string | null;
  payStatus: string | null;
  onConfirmCash: ((ticket: FeedTicket) => void) | null;
  onOpenBill: ((ticket: FeedTicket) => void) | null;
};

function vnd(amount: number): string {
  return `${amount.toLocaleString()} VND`;
}

export default function FeesCard({t, theme, ticket, bill, busy, payable, waitingFee, estimateAmount, estimateNote, estimateState, onApproveEstimate, onDeclineEstimate, onApproveFinal, onApproveQuote, onDeclineQuote, onApproveMobileFix, onDeclineMobileFix, quotePayMethod, quoteFunded, payMethod, payStatus, onConfirmCash, onOpenBill}: Props) {
  const towFare = ticket.ticketType === "TOW" && ticket.towFare !== null && typeof ticket.towFare === "object" ? ticket.towFare : null;
  const towHasFare = towFare !== null && typeof towFare.estimate === "number";
  const towFinal = towHasFare && typeof towFare.final === "number" ? towFare.final : null;
  const towCeiling = towHasFare && typeof towFare.ceiling === "number" ? towFare.ceiling : null;
  const shopQuote = ticket.invoiceApproval === "APPROVED" &&
    typeof ticket.invoiceAmount === "number" ?
    ticket.invoiceAmount :
    typeof ticket.shopQuotedAmount === "number" ? ticket.shopQuotedAmount : null;
  const finalAmount = typeof ticket.finalAmount === "number" ? ticket.finalAmount : null;
  const mobileHistory = ticket.ticketType === "SOS" && Array.isArray(ticket.mobileFeeHistory) ?
    ticket.mobileFeeHistory.reduce((sum, entry) =>
      sum + (typeof entry.callOutFee === "number" ? entry.callOutFee : 0) +
      (typeof entry.travelFee === "number" ? entry.travelFee : 0), 0) :
    0;
  const towHistory = ticket.ticketType === "TOW" && Array.isArray(ticket.towFeeHistory) ?
    ticket.towFeeHistory.reduce((sum, entry) =>
      sum + (typeof entry.amount === "number" ? entry.amount : 0), 0) :
    0;
  const callOutWaived = ticket.ticketType === "SOS" &&
    isUnfixableStatus(ticket.status) &&
    (ticket.mobileCallOutWaived === true || ticket.mobileCallOutFee === 0);
  const callOut = ticket.ticketType === "SOS" && isUnfixableStatus(ticket.status) ?
    (callOutWaived ? 0 :
      typeof ticket.mobileCallOutFee === "number" ? ticket.mobileCallOutFee : 50000) :
    null;
  const waitingExtra = waitingFee !== null && waitingFee > 0 ? waitingFee : 0;
  const isTow = ticket.ticketType === "TOW";
  let total: {label: string; amount: number} | null = null;
  if (bill !== null) total = {label: t.bills.total, amount: bill.total};
  else if (callOut !== null && callOut > 0) total = {label: t.bills.total, amount: callOut};
  else if (towFinal !== null) total = {label: t.bills.total, amount: towFinal + waitingExtra + towHistory};
  else if (shopQuote !== null) total = {label: t.bills.total, amount: shopQuote + (isTow ? waitingExtra : 0)};
  else if (finalAmount !== null) total = {label: t.bills.total, amount: finalAmount + (isTow ? waitingExtra : 0) + (ticket.ticketType === "SOS" ? mobileHistory : 0)};
  else if (mobileHistory > 0) total = {label: t.bills.total, amount: mobileHistory};
  else if (towHistory > 0) total = {label: t.bills.total, amount: towHistory + waitingExtra};
  else if (estimateAmount !== null) total = {label: t.assist.estimatedTotal, amount: estimateAmount + (isTow ? waitingExtra : 0)};
  else if (towCeiling !== null) total = {label: t.assist.fareUpTo, amount: towCeiling};
  const hasBillable = towHasFare || shopQuote !== null || finalAmount !== null || callOut !== null || mobileHistory > 0 || towHistory > 0 || bill !== null;
  const billLink = onOpenBill !== null &&
    (bill !== null || towHasFare || shopQuote !== null || finalAmount !== null);
  const showFinalActions = ticket.direction === "out" && payable &&
    finalAmount !== null && callOut === null && ticket.ticketType !== "SOS";
  const quotePayNow = quotePayMethod === "SEPAY" && quoteFunded !== true;
  const quoteApproval = (() => {
    if (ticket.direction !== "out" || ticket.status !== DISPATCH_STATUS.QUOTED) return null;
    if ((ticket.ticketType === "WALK_IN" || ticket.ticketType === "MECHANIC") && onApproveQuote) {
      return {
        label: quotePayNow ? t.assist.payToApprove : t.assist.approveQuote,
        onPress: () => onApproveQuote(ticket),
      };
    }
    if (ticket.ticketType === "SOS" && typeof ticket.finalAmount === "number" && onApproveMobileFix) {
      return {
        label: quotePayNow ? t.assist.payToApprove : t.assist.approve,
        onPress: () => onApproveMobileFix(ticket),
      };
    }
    return null;
  })();
  const quoteDecline = (() => {
    if (ticket.direction !== "out" || ticket.status !== DISPATCH_STATUS.QUOTED) return null;
    if ((ticket.ticketType === "WALK_IN" || ticket.ticketType === "MECHANIC") && onDeclineQuote) {
      return () => onDeclineQuote(ticket);
    }
    if (ticket.ticketType === "SOS" && typeof ticket.finalAmount === "number" && onDeclineMobileFix) {
      return () => onDeclineMobileFix(ticket);
    }
    return null;
  })();
  const billPill = bill !== null ? billStatusColor(bill.status, theme) : theme.primary;
  const cashReady = ticket.ticketType === "TOW" ||
    ticket.ticketType === "SOS" ||
    ticket.status === DISPATCH_STATUS.READY;
  if (!hasBillable && estimateAmount === null && waitingExtra === 0 && payMethod === null) return null;
  return (
    <DetailCard theme={theme}>
      <CardHead
        theme={theme}
        icon="payments"
        title={t.assist.paymentTitle}
        right={bill !== null ? (
          <View style={[detailStyles.pill, {backgroundColor: billPill}]}>
            <Text style={[detailStyles.pillText, {color: onColor(billPill)}]}>{billStatusLabel(bill.status, t)}</Text>
          </View>
        ) : undefined}
      />
      {total !== null ? (
        <View style={[styles.total, {borderTopColor: theme.divider}]}>
          <FeeRow theme={theme} label={total.label} value={vnd(total.amount)} strong />
        </View>
      ) : null}
      {callOutWaived ? <Text style={[detailStyles.muted, {color: theme.muted}]}>{t.assist.mobileCallOutWaived}</Text> : null}
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
      {payMethod === "CASH" && payStatus !== "CONFIRMED" && onConfirmCash !== null && cashReady ? (
        <Pressable style={[styles.primaryBtn, {backgroundColor: theme.primary}, busy && detailStyles.disabled]} disabled={busy} onPress={() => onConfirmCash(ticket)} accessibilityRole="button" accessibilityLabel={t.assist.cashConfirmReceipt}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.assist.cashConfirmReceipt}</Text>}
        </Pressable>
      ) : null}
      {quoteApproval !== null || quoteDecline !== null ? (
        <View style={styles.quoteActions}>
          {quoteDecline !== null ? (
            <View testID="fees-quote-decline-slot" style={styles.quoteSlot}>
              <Pressable
                testID="fees-quote-decline"
                style={[styles.quoteBtn, styles.declineBtn, {borderColor: theme.danger}, busy && detailStyles.disabled]}
                disabled={busy}
                onPress={quoteDecline}
                accessibilityRole="button"
                accessibilityLabel={t.assist.decline}
              >
                {busy ? <ActivityIndicator color={theme.danger} /> : <Text style={[styles.halfText, {color: theme.danger}]}>{t.assist.decline}</Text>}
              </Pressable>
            </View>
          ) : null}
          {quoteApproval !== null ? (
            <View testID="fees-quote-approve-slot" style={styles.quoteSlot}>
              <Pressable
                testID="fees-quote-approve"
                style={[styles.quoteBtn, {backgroundColor: theme.primary}, busy && detailStyles.disabled]}
                disabled={busy}
                onPress={quoteApproval.onPress}
                accessibilityRole="button"
                accessibilityLabel={quoteApproval.label}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{quoteApproval.label}</Text>}
              </Pressable>
            </View>
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
        <Pressable style={[styles.linkRow, {borderColor: theme.border}]} onPress={() => onOpenBill?.(ticket)} accessibilityRole="button" accessibilityLabel={t.payments.detailTitle}>
          <MaterialIcons name="receipt-long" size={16} color={theme.primary} />
          <Text style={[detailStyles.muted, {color: theme.primary, flex: 1}]}>{t.payments.detailTitle}</Text>
          <MaterialIcons name="chevron-right" size={18} color={theme.muted} />
        </Pressable>
      ) : null}
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  block: {gap: 6},
  total: {borderTopWidth: 1, paddingTop: 8},
  primaryBtn: {borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center"},
  primaryText: {color: "#fff", fontWeight: "700"},
  linkRow: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10},
  estimateActions: {flexDirection: "row", gap: 8, marginTop: 4},
  quoteActions: {flexDirection: "row", gap: 8, marginTop: 4, width: "100%", alignItems: "stretch"},
  quoteSlot: {flex: 1, minWidth: 0},
  quoteBtn: {width: "100%", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center", justifyContent: "center"},
  halfBtn: {flex: 1, borderRadius: 8, paddingVertical: 9, paddingHorizontal: 14, alignItems: "center", justifyContent: "center"},
  declineBtn: {borderWidth: 1},
  halfText: {fontWeight: "700"},
});
