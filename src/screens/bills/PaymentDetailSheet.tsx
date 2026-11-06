import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Linking, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import {useAppMode} from "../../context/ThemeContext";
import {darkTheme, lightTheme} from "../../theme";
import {useStrings} from "../../context/LanguageContext";
import type {Strings} from "../../i18n/en";
import {useAuth} from "../../context/AuthContext";
import {toMessage} from "../../api/client";
import {fetchBill, requestInvoice, type Bill} from "../../api/bills";
import {confirmCashReceipt, createPayment, type DispatchTicket, type TicketPayment} from "../../api/dispatch";
import {useBills} from "../../context/BillsContext";
import Overlay, {type OverlayAction} from "../../components/overlay/Overlay";
import ServiceIcon from "../../components/ui/ServiceIcon";
import SePayCheckoutSheet from "../assist/SePayCheckoutSheet";
import {
  billDateTimeLabel,
  billServiceType,
  billTitle,
  payeeSummary,
} from "./billLabels";
import {
  BillChargesCard,
  BillPartiesCard,
  BillPaymentCard,
  BillStatusPill,
  BillTotalsCard,
  billHeroStatus,
} from "./BillSections";

type Props = {
  ticketId: string;
  scope?: "payee";
  ticket?: DispatchTicket | null;
  onClose: () => void;
  onChanged?: () => void;
};

type TowFarePreview = {
  estimate: number;
  ceiling: number;
  baseFee: number | null;
  perKmFee: number | null;
  includedKm: number | null;
  billableKm: number | null;
  loadedKm: number | null;
};

function previewOf(ticket: DispatchTicket | null | undefined): TowFarePreview | null {
  if (!ticket || ticket.ticketType !== "TOW" || !ticket.towFare) return null;
  const fare = ticket.towFare;
  const estimate = typeof fare.estimate === "number" ? fare.estimate : null;
  const ceiling = typeof fare.ceiling === "number" ? fare.ceiling : estimate;
  if (estimate === null || ceiling === null) return null;
  return {
    estimate,
    ceiling,
    baseFee: typeof fare.baseFee === "number" ? fare.baseFee : null,
    perKmFee: typeof fare.perKmFee === "number" ? fare.perKmFee : null,
    includedKm: typeof fare.includedKm === "number" ? fare.includedKm : null,
    billableKm: typeof fare.billableKm === "number" ? fare.billableKm : null,
    loadedKm: typeof fare.loadedKm === "number" ? fare.loadedKm : null,
  };
}

function PreviewRow({label, value, theme}: {label: string; value: string; theme: {muted: string; text: string}}) {
  return (
    <View style={styles.previewRow}>
      <Text style={[styles.previewLabel, {color: theme.muted}]}>{label}</Text>
      <Text style={[styles.previewValue, {color: theme.text}]}>{value}</Text>
    </View>
  );
}

function TowFarePreviewCard({preview, theme, t}: {
  preview: TowFarePreview;
  theme: {border: string; paper: string; muted: string; text: string};
  t: Strings;
}) {
  return (
    <>
      <View style={[styles.amountCard, {borderColor: theme.border}]}>
        <View style={styles.amountHead}>
          <Text style={[styles.amountLabel, {color: theme.muted}]}>{t.assist.fareUpTo}</Text>
        </View>
        <Text style={[styles.amount, {color: theme.text}]}>{`${preview.ceiling.toLocaleString()} VND`}</Text>
      </View>
      <View style={[styles.previewCard, {borderColor: theme.border, backgroundColor: theme.paper}]}>
        <Text style={[styles.previewTitle, {color: theme.text}]}>{t.assist.farePreviewTitle}</Text>
        {preview.baseFee !== null ? <PreviewRow label={t.bills.baseFare} value={`${preview.baseFee.toLocaleString()} VND`} theme={theme} /> : null}
        {preview.includedKm !== null ? <PreviewRow label={t.bills.includedDistance} value={`${preview.includedKm} km`} theme={theme} /> : null}
        {preview.loadedKm !== null ? <PreviewRow label={t.bills.loadedDistance} value={`${preview.loadedKm.toFixed(2)} km`} theme={theme} /> : null}
        {preview.billableKm !== null ? <PreviewRow label={t.bills.billableDistance} value={`${preview.billableKm.toFixed(2)} km`} theme={theme} /> : null}
        {preview.perKmFee !== null ? <PreviewRow label={t.bills.perKmRate} value={`${preview.perKmFee.toLocaleString()} VND/km`} theme={theme} /> : null}
        <PreviewRow label={t.bills.fareCeiling} value={`${preview.ceiling.toLocaleString()} VND`} theme={theme} />
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.farePreviewHint}</Text>
      </View>
    </>
  );
}

export default function PaymentDetailSheet({ticketId, scope, ticket = null, onClose, onChanged}: Props) {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {refresh: refreshBills} = useBills();
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const payee = scope === "payee";
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sepay, setSepay] = useState<{url: string; checkout?: TicketPayment["checkout"] | null; status: string} | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      setBill(await fetchBill(token, {
        ticketId,
        ...(payee ? {scope: "payee" as const} : {}),
      }));
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, ticketId, payee]);

  useEffect(() => {
    void load();
  }, [load]);

  const item = bill?.items[0] ?? null;
  const preview = previewOf(ticket);
  const showPreview = preview !== null && !loading &&
    (bill === null || bill.items.length === 0);
  const summary = bill && payee ? payeeSummary(bill) : null;
  const pendingSepay = item?.status === "PENDING" && item.payment?.method === "SEPAY";
  const status = bill ? billHeroStatus(bill, payee, t, theme) : null;

  function reload(): void {
    void load();
    void refreshBills();
    onChanged?.();
  }

  async function pay(method: "SEPAY" | "CASH"): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createPayment(ticketId, method, token);
      if (method === "SEPAY" && created.checkoutUrl) {
        setSepay({url: created.checkoutUrl, checkout: created.checkout ?? null, status: created.status});
      }
      reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function openInvoice(): Promise<void> {
    if (!token || invoiceBusy) return;
    setInvoiceBusy(true);
    setError(null);
    try {
      const invoice = await requestInvoice(ticketId, token);
      await Linking.openURL(invoice.url);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setInvoiceBusy(false);
    }
  }

  async function confirmCash(): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      await confirmCashReceipt(ticketId, token);
      reload();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const actions: OverlayAction[] = [];
  if (bill && item) {
    if (!payee && bill.canPay) {
      if (item.status === "UNPAID") {
        actions.push({label: t.bills.paySepay, tone: "primary", busy, onPress: () => void pay("SEPAY")});
        actions.push({label: t.bills.payCash, tone: "neutral", outline: true, busy, onPress: () => void pay("CASH")});
      } else if (pendingSepay) {
        actions.push({label: t.bills.openQr, tone: "primary", busy, onPress: () => void pay("SEPAY")});
        actions.push({label: t.bills.payCash, tone: "neutral", outline: true, busy, onPress: () => void pay("CASH")});
      }
    }
    if (payee && item.payment?.canConfirmCash === true) {
      actions.push({label: t.assist.cashConfirmReceipt, tone: "primary", busy, onPress: () => void confirmCash()});
    }
    if (bill.status === "PAID") {
      actions.push({
        label: t.bills.invoicePdf,
        tone: "neutral",
        outline: actions.length > 0,
        busy: invoiceBusy,
        onPress: () => void openInvoice(),
      });
    }
  }

  return (
    <>
      <Overlay
        visible
        variant="sheet"
        title={t.payments.detailTitle}
        closeLabel={t.common.close}
        onClose={onClose}
        actions={actions}
        actionLayout="ticket"
        scrollable
      >
        {loading && bill === null ? <ActivityIndicator color={theme.primary} /> : null}
        {error && !showPreview ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        {bill ? (
          <View style={styles.body}>
            <View style={styles.head}>
              <View style={[styles.icon, {backgroundColor: `${theme.primary}22`}]}>
                <ServiceIcon service={billServiceType(bill)} size={24} color={theme.primary} />
              </View>
              <View style={styles.headText}>
                <Text style={[styles.title, {color: theme.text}]}>{billTitle(bill, t)}</Text>
                <Text style={[styles.meta, {color: theme.muted}]}>{`#${bill.ticketId.slice(-6)} · ${billDateTimeLabel(bill.createdAt)}`}</Text>
              </View>
            </View>
            {item ? (
              <>
                <View style={[styles.amountCard, {borderColor: theme.border}]}>
                  <View style={styles.amountHead}>
                    <Text style={[styles.amountLabel, {color: theme.muted}]}>
                      {summary !== null ? t.payments.netPayout : t.bills.due}
                    </Text>
                    {status !== null ? <BillStatusPill label={status.label} color={status.color} theme={theme} /> : null}
                  </View>
                  <Text style={[styles.amount, {color: theme.text}]}>
                    {`${(summary?.net ?? bill.due).toLocaleString()} VND`}
                  </Text>
                </View>
                <BillPartiesCard item={item} t={t} theme={theme} lang={lang} />
                <BillChargesCard item={item} t={t} theme={theme} />
                <BillTotalsCard bill={bill} payee={payee} t={t} theme={theme} />
                <BillPaymentCard item={item} payee={payee} t={t} theme={theme} />
                {pendingSepay && !payee ? <Text style={[styles.hint, {color: theme.muted}]}>{t.payments.awaitingRider}</Text> : null}
                {item.status === "PENDING" && item.payment?.method === "CASH" ? (
                  <Text style={[styles.hint, {color: theme.muted}]}>{payee ? t.payments.cashPending : t.bills.cashArmed}</Text>
                ) : null}
              </>
            ) : showPreview && preview !== null ? (
              <TowFarePreviewCard preview={preview} theme={theme} t={t} />
            ) : null}
          </View>
        ) : null}
      </Overlay>
      {sepay ? (
        <SePayCheckoutSheet
          t={t}
          url={sepay.url}
          checkout={sepay.checkout ?? null}
          status={sepay.status}
          busy={false}
          error={error}
          onClose={() => setSepay(null)}
          onSuccess={() => { setSepay(null); reload(); }}
          onCancel={() => setSepay(null)}
          onFailure={() => setSepay(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  body: {gap: 10},
  head: {flexDirection: "row", alignItems: "center", gap: 10},
  icon: {width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center"},
  headText: {flex: 1, gap: 2},
  title: {fontSize: 17, fontWeight: "800"},
  meta: {fontSize: 11},
  amountCard: {borderWidth: 1, borderRadius: 14, padding: 12, gap: 2},
  amountHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  amountLabel: {fontSize: 11, fontWeight: "600"},
  amount: {fontSize: 26, fontWeight: "800"},
  previewCard: {borderWidth: 1, borderRadius: 14, padding: 12, gap: 6},
  previewTitle: {fontSize: 13, fontWeight: "700"},
  previewRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  previewLabel: {fontSize: 12},
  previewValue: {fontSize: 12, fontWeight: "600"},
  hint: {fontSize: 12, lineHeight: 17},
  error: {fontSize: 12},
});
