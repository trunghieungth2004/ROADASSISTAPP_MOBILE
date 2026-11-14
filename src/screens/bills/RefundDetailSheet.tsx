import {StyleSheet, View} from "react-native";
import Overlay from "../../components/overlay/Overlay";
import {AppText as Text} from "../../components/ui/AppText";
import type {RefundRequest} from "../../api/refunds";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {BillStatusPill} from "./BillSections";
import {
  billDateLabel,
  refundStatusColor,
  refundStatusLabel,
} from "./billLabels";

type Props = {
  refund: RefundRequest;
  t: Strings;
  theme: AppTheme;
  onClose: () => void;
  onOpenPayment: () => void;
};

function InfoRow({label, value, theme}: {
  label: string;
  value: string;
  theme: AppTheme;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.label, {color: theme.muted}]}>{label}</Text>
      <Text style={[styles.value, {color: theme.text}]}>{value}</Text>
    </View>
  );
}

export default function RefundDetailSheet({
  refund,
  t,
  theme,
  onClose,
  onOpenPayment,
}: Props) {
  const color = refundStatusColor(refund.status, theme);
  const open = refund.status === "REQUESTED" ||
    refund.status === "APPROVED" ||
    refund.status === "SENT";
  const rejected = refund.status === "REJECTED" || refund.status === "FAILED";
  return (
    <Overlay
      visible
      variant="dialog"
      title={t.payments.refundDetails}
      closeLabel={t.common.close}
      onClose={onClose}
      scrollable={false}
      actions={[{
        label: t.payments.openPayment,
        tone: "primary",
        onPress: onOpenPayment,
      }]}
    >
      <View style={styles.body}>
        <Text style={[styles.subtitle, {color: theme.muted}]}>
          {`${t.payments.paymentRef} · #${refund.ticketId.slice(-6)}`}
        </Text>
        <View style={[styles.amountCard, {borderColor: theme.border}]}>
          <View style={styles.amountHead}>
            <Text style={[styles.amountLabel, {color: theme.muted}]}>{t.bills.refund}</Text>
            <BillStatusPill
              label={refundStatusLabel(refund.status, t)}
              color={color}
              theme={theme}
            />
          </View>
          <Text style={[styles.amount, {color: theme.text}]}>
            {`${refund.amount.toLocaleString()} VND`}
          </Text>
        </View>
        <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
          <InfoRow
            label={t.payments.refundRequestedAt}
            value={billDateLabel(refund.requestedAt)}
            theme={theme}
          />
          {refund.reason ? (
            <InfoRow
              label={t.bills.refundReason}
              value={refund.reason}
              theme={theme}
            />
          ) : null}
          {refund.transferRef ? (
            <InfoRow
              label={t.payments.refundTransferRef}
              value={refund.transferRef}
              theme={theme}
            />
          ) : null}
          {refund.decisionNote ? (
            <InfoRow
              label={t.payments.refundDecisionNote}
              value={refund.decisionNote}
              theme={theme}
            />
          ) : null}
          {refund.failureReason ? (
            <InfoRow
              label={t.payments.refundFailureReason}
              value={refund.failureReason}
              theme={theme}
            />
          ) : null}
        </View>
        {open ? (
          <Text style={[styles.note, {color: theme.muted}]}>
            {t.payments.refundPaidNote}
          </Text>
        ) : rejected ? (
          <Text style={[styles.note, {color: theme.danger}]}>
            {t.payments.refundRejectedNote}
          </Text>
        ) : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  subtitle: {fontSize: 12},
  amountCard: {borderWidth: 1, borderRadius: 14, padding: 14, gap: 4},
  amountHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  amountLabel: {fontSize: 12, fontWeight: "600"},
  amount: {fontSize: 26, fontWeight: "800"},
  card: {borderWidth: 1, borderRadius: 14, padding: 14, gap: 8},
  row: {flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12},
  label: {fontSize: 12, flexShrink: 0},
  value: {fontSize: 12, fontWeight: "600", flex: 1, textAlign: "right"},
  note: {fontSize: 12, lineHeight: 17},
});
