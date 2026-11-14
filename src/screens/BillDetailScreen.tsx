import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Alert, AppState, Linking, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation, useRoute} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {toMessage} from "../api/client";
import {fetchBill, requestInvoice, type Bill, type BillItem} from "../api/bills";
import {requestRefund} from "../api/refunds";
import {cancelPayment, confirmCashReceipt, createPayment, DISPATCH_STATUS, fetchTicketPayments, type TicketPayment} from "../api/dispatch";
import {useAuth} from "../context/AuthContext";
import {useBills} from "../context/BillsContext";
import {useStrings} from "../context/LanguageContext";
import type {Strings} from "../i18n/en";
import {useThemeMode} from "../context/ThemeContext";
import {themeForMode, type AppTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import SePayCheckoutSheet from "./assist/SePayCheckoutSheet";
import WarrantyClaimDialog from "./bills/WarrantyClaimDialog";
import {ActionFooter, type OverlayAction} from "../components/overlay/Overlay";
import {
  billDateLabel,
  billDateTimeLabel,
  billItemCount,
  billPayeeLabel,
  billTitle,
  payeeSummary,
  refundStatusColor,
  refundStatusLabel,
} from "./bills/billLabels";
import {
  BillChargesCard,
  BillPartiesCard,
  BillPaymentCard,
  BillStatusPill,
  BillTotalsCard,
  billHeroStatus,
} from "./bills/BillSections";

type BillParams = {
  ticketId?: string;
  billId?: string;
  payFirst?: boolean;
  readOnly?: boolean;
  scope?: "payee";
};

const RECEIVED = new Set(["HELD", "CONFIRMED", "PARTIAL"]);

function BillHeroCard({bill, payeeMode, header, meta, t, theme}: {
  bill: Bill;
  payeeMode: boolean;
  header: {label: string; color: string} | null;
  meta: string;
  t: Strings;
  theme: AppTheme;
}) {
  const summary = payeeMode ? payeeSummary(bill) : null;
  return (
    <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, {color: theme.text}]}>{billTitle(bill, t)}</Text>
        {header !== null ? <BillStatusPill label={header.label} color={header.color} theme={theme} /> : null}
      </View>
      <Text style={[styles.muted, {color: theme.muted}]}>{meta}</Text>
      <View style={[styles.hero, {borderColor: theme.border}]}>
        <Text style={[styles.heroLabel, {color: theme.muted}]}>{summary !== null ? t.payments.netPayout : t.bills.due}</Text>
        <Text style={[styles.heroAmount, {color: theme.text}]}>{`${(summary?.net ?? bill.due).toLocaleString()} VND`}</Text>
      </View>
    </View>
  );
}

function BillExtras({item, payeeMode, payerMode, canceledTow, theme, t, onRefund, onClaim}: {
  item: BillItem;
  payeeMode: boolean;
  payerMode: boolean;
  canceledTow: boolean;
  theme: AppTheme;
  t: Strings;
  onRefund: () => void;
  onClaim: (line: NonNullable<BillItem["services"]>[number]) => void;
}) {
  return (
    <>
      {item.deposit ? (
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <DepositLine item={item} theme={theme} t={t} />
        </View>
      ) : null}
      {item.refundRequest ? (
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <RefundLine request={item.refundRequest} theme={theme} t={t} />
        </View>
      ) : null}
      <WarrantyLinks item={item} theme={theme} t={t} canClaim={payerMode} onClaim={onClaim} />
      {payerMode ? <RefundAction item={item} theme={theme} label={t.bills.refundRequest} onPress={onRefund} /> : null}
      {payeeMode && !item.payment ? <Text style={[styles.hint, {color: theme.muted}]}>{t.payments.notCollected}</Text> : null}
      {payeeMode && item.payment?.status === "PENDING" && item.payment.method === "CASH" && !item.payment.canConfirmCash ? (
        <Text style={[styles.hint, {color: theme.muted}]}>{t.payments.cashPending}</Text>
      ) : null}
      {payerMode && item.status === "PENDING" && item.payment?.method === "CASH" ? (
        <Text style={[styles.hint, {color: theme.muted}]}>
          {canceledTow ? t.bills.cancellationCashHint : t.bills.cashArmed}
        </Text>
      ) : null}
      {payerMode && item.status === "PENDING" && item.payment?.method === "SEPAY" ? (
        <Text style={[styles.hint, {color: theme.muted}]}>{t.payments.awaitingRider}</Text>
      ) : null}
    </>
  );
}

function billActionsFor({bill, actionItem, payerMode, payeeMode, readOnly, busyTicket, invoiceBusy, t, onPay, onSwitchToCash, onConfirmCash, onInvoice}: {
  bill: Bill;
  actionItem: BillItem | null;
  payerMode: boolean;
  payeeMode: boolean;
  readOnly: boolean;
  busyTicket: string | null;
  invoiceBusy: boolean;
  t: Strings;
  onPay: (item: BillItem, method: "SEPAY" | "CASH") => void;
  onSwitchToCash: (item: BillItem) => void;
  onConfirmCash: (item: BillItem) => void;
  onInvoice: () => void;
}): OverlayAction[] {
  const actions: OverlayAction[] = [];
  const canceledTow = bill.ticketType === "TOW" &&
    bill.ticketStatus === DISPATCH_STATUS.CANCELLED;
  if (actionItem !== null && payerMode && bill.canPay) {
    const busy = busyTicket === actionItem.ticketId;
    if (actionItem.status === "UNPAID") {
      actions.push({
        label: canceledTow ? t.bills.payCancellation : t.bills.paySepay,
        tone: "primary",
        busy,
        onPress: () => onPay(actionItem, "SEPAY"),
      });
      if (!canceledTow) {
        actions.push({label: t.bills.payCash, tone: "neutral", outline: true, busy, onPress: () => onPay(actionItem, "CASH")});
      }
    } else if (actionItem.status === "PENDING" && actionItem.payment?.method === "SEPAY") {
      actions.push({
        label: canceledTow ? t.bills.payCancellation : t.bills.openQr,
        tone: "primary",
        busy,
        onPress: () => onPay(actionItem, "SEPAY"),
      });
      if (!canceledTow) {
        actions.push({label: t.bills.payCash, tone: "neutral", outline: true, busy, onPress: () => onSwitchToCash(actionItem)});
      }
    } else if (actionItem.status === "PENDING" &&
      actionItem.payment?.method === "CASH") {
      actions.push({
        label: canceledTow ? t.bills.payCancellation : t.bills.paySepay,
        tone: "primary",
        busy,
        onPress: () => onPay(actionItem, "SEPAY"),
      });
    }
  }
  if (actionItem !== null && payeeMode && !readOnly && actionItem.payment?.canConfirmCash === true) {
    actions.push({label: t.assist.cashConfirmReceipt, tone: "primary", busy: busyTicket === actionItem.ticketId, onPress: () => onConfirmCash(actionItem)});
  }
  if (bill.status === "PAID") {
    actions.push({
      label: t.bills.invoicePdf,
      tone: "neutral",
      outline: actions.length > 0,
      busy: invoiceBusy,
      onPress: onInvoice,
    });
  }
  return actions;
}

function RefundAction({item, theme, label, onPress}: {item: BillItem; theme: AppTheme; label: string; onPress: () => void}) {
  if (item.refundRequest || !item.payment || !RECEIVED.has(item.payment.status)) return null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Text style={[styles.link, {color: theme.primary}]}>{label}</Text>
    </Pressable>
  );
}

function RefundLine({request, theme, t}: {
  request: BillItem["refundRequest"];
  theme: AppTheme;
  t: Strings;
}) {
  if (!request) return null;
  const color = refundStatusColor(request.status, theme);
  const open = request.status === "REQUESTED" ||
    request.status === "APPROVED" ||
    request.status === "SENT";
  const rejected = request.status === "REJECTED" ||
    request.status === "FAILED";
  return (
    <>
      <View style={styles.rowBetween}>
        <Text style={[styles.cardTitle, {color: theme.text}]}>{t.bills.refund}</Text>
        <BillStatusPill
          label={refundStatusLabel(request.status, t)}
          color={color}
          theme={theme}
        />
      </View>
      <Text style={[styles.muted, {color: theme.muted}]}>
        {`${request.amount.toLocaleString()} VND · ${billDateLabel(request.requestedAt)}`}
      </Text>
      {request.transferRef ? (
        <Text style={[styles.muted, {color: theme.muted}]}>
          {`${t.payments.refundTransferRef}: ${request.transferRef}`}
        </Text>
      ) : null}
      {open ? (
        <Text style={[styles.hint, {color: theme.muted}]}>
          {t.payments.refundPaidNote}
        </Text>
      ) : rejected ? (
        <Text style={[styles.hint, {color: theme.danger}]}>
          {t.payments.refundRejectedNote}
        </Text>
      ) : null}
    </>
  );
}

function DepositLine({item, theme, t}: {item: BillItem; theme: {muted: string; text: string}; t: Strings}) {
  const deposit = item.deposit;
  if (!deposit) return null;
  const label = deposit.status === "DUE" || deposit.status === "REQUESTED" ?
    t.provider.depositDue :
    deposit.status === "NONE" || deposit.status === "WAIVED" ?
      t.provider.depositWaived :
      t.provider.depositCollected;
  return (
    <View style={styles.rowBetween}>
      <Text style={[styles.muted, {color: theme.muted}]}>{label}</Text>
      <Text style={[styles.itemStatus, {color: theme.text}]}>{`${deposit.amount.toLocaleString()} VND`}</Text>
    </View>
  );
}

function WarrantyLinks({item, theme, t, canClaim, onClaim}: {
  item: BillItem;
  theme: AppTheme;
  t: Strings;
  canClaim: boolean;
  onClaim: (line: NonNullable<BillItem["services"]>[number]) => void;
}) {
  const lines = canClaim ? (item.services ?? []).filter((line) => line.warrantyUntil &&
    Date.parse(line.warrantyUntil) > Date.now()) : [];
  if (lines.length === 0) return null;
  return (
    <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.paper}]}>
      <Text style={[styles.cardTitle, {color: theme.text}]}>{t.bills.warranty}</Text>
      {lines.map((line, index) => (
        <Pressable key={line.lineId ?? `claim-${index}`} onPress={() => onClaim(line)} accessibilityRole="button" accessibilityLabel={t.bills.claimWarranty}>
          <Text style={[styles.link, {color: theme.primary}]}>{`${t.bills.claimWarranty} · ${line.name}`}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function BillDetailScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {refresh: refreshBills} = useBills();
  const {mode} = useThemeMode();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const theme = themeForMode(mode);
  const params = (route.params ?? {}) as BillParams;
  const ticketId = params.ticketId;
  const billId = params.billId;
  const payeeMode = params.scope === "payee";
  const readOnly = params.readOnly === true;
  const [bill, setBill] = useState<Bill | null>(null);
  const viewer = bill?.viewer ?? null;
  const payeeView = payeeMode || viewer === "PAYEE";
  const riderView = viewer === "RIDER";
  const adminView = viewer === "ADMIN";
  const operatorView = viewer === "OPERATOR";
  const payerMode = !payeeMode && !readOnly && riderView;
  const [loading, setLoading] = useState(true);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);
  const [sepayCheckout, setSepayCheckout] = useState<{ticketId: string; status: string; url: string; checkout: TicketPayment["checkout"]} | null>(null);
  const [sepayBusy, setSepayBusy] = useState(false);
  const [sepayError, setSepayError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [warrantyFor, setWarrantyFor] = useState<{lineId: string; name: string} | null>(null);
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  async function openInvoice(): Promise<void> {
    if (!token || !bill || invoiceBusy) return;
    setInvoiceBusy(true);
    setError(null);
    try {
      const invoice = await requestInvoice(bill.ticketId, token);
      await Linking.openURL(invoice.url);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setInvoiceBusy(false);
    }
  }
  const requestItemRefund = (item: BillItem): void => {
    if (!token || !item.payment || !payerMode) return;
    Alert.alert(t.bills.refundRequest, t.bills.refundHint, [
      {text: t.common.cancel, style: "cancel"},
      {
        text: t.bills.refundSubmit,
        onPress: () => {
          void requestRefund({paymentId: item.payment?.id ?? ""}, token)
            .then(() => {
              setNotice(t.bills.refundRequested);
              void load();
            })
            .catch((err: unknown) => setError(toMessage(err)));
        },
      },
    ]);
  };

  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      const query = ticketId ?
        (payeeMode ? {ticketId, scope: "payee" as const} : {ticketId}) :
        (payeeMode ? {billId, scope: "payee" as const} : {billId});
      setBill(await fetchBill(token, query));
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, ticketId, billId, payeeMode]);
  useEffect(() => {
    navigation.setOptions({title: payeeView ? t.payments.detailTitle : t.bills.title});
  }, [navigation, t, payeeView]);
  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void load();
    });
    return () => sub.remove();
  }, [load]);
  async function pay(item: BillItem, method: "SEPAY" | "CASH"): Promise<void> {
    if (!token || busyTicket !== null || readOnly || payeeMode || !payerMode || !bill?.canPay) return;
    setBusyTicket(item.ticketId);
    setError(null);
    try {
      const created = await createPayment(item.ticketId, method, token);
      if (method === "SEPAY") {
        if (created.checkoutUrl) {
          setSepayError(null);
          setSepayCheckout({ticketId: item.ticketId, status: item.ticketStatus, url: created.checkoutUrl, checkout: created.checkout ?? null});
        } else {
          setError(t.bills.qrMissing);
        }
      } else {
        setNotice(t.bills.cashArmed);
      }
      await load();
      void refreshBills();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyTicket(null);
    }
  }
  async function waitForSepayPayment(ticketId: string): Promise<boolean> {
    if (!token) return false;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const rows = await fetchTicketPayments(ticketId, token).catch(() => []);
      const sepay = rows.find((row) => row.method === "SEPAY");
      if (sepay && (sepay.status === "HELD" || sepay.status === "CONFIRMED")) return true;
      if (attempt < 5) await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    }
    return false;
  }
  async function onSepaySuccess(): Promise<void> {
    const active = sepayCheckout;
    if (!active) return;
    setSepayBusy(true);
    setSepayError(null);
    try {
      const paid = await waitForSepayPayment(active.ticketId);
      await load();
      void refreshBills();
      setSepayCheckout(null);
      setNotice(paid ? t.bills.sepayPaid : t.bills.sepayPending);
    } catch (err) {
      setSepayCheckout(null);
      setError(toMessage(err));
    } finally {
      setSepayBusy(false);
    }
  }
  async function onSepayCancel(): Promise<void> {
    const active = sepayCheckout;
    if (!active || !token) {
      setSepayCheckout(null);
      return;
    }
    setSepayBusy(true);
    setSepayError(null);
    try {
      await cancelPayment(active.ticketId, token);
      setSepayCheckout(null);
      setNotice(t.bills.sepayCancelled);
      await load();
      void refreshBills();
    } catch (err) {
      setSepayError(toMessage(err));
    } finally {
      setSepayBusy(false);
    }
  }
  function onSepayFailure(): void {
    setSepayCheckout(null);
    setError(t.assist.sepayFailed);
  }
  function closeSepayCheckout(): void {
    if (sepayBusy) return;
    setSepayCheckout(null);
    void load();
  }
  function switchToCash(item: BillItem): void {
    Alert.alert(
      t.bills.switchCashTitle,
      t.bills.switchCashHint,
      [
        {text: t.common.cancel, style: "cancel"},
        {text: t.bills.payCash, style: "destructive", onPress: () => void pay(item, "CASH")},
      ],
    );
  }
  async function confirmCash(item: BillItem): Promise<void> {
    if (!token || busyTicket !== null || readOnly || viewer !== "PAYEE" || !item.payment?.canConfirmCash) return;
    setBusyTicket(item.ticketId);
    setError(null);
    try {
      await confirmCashReceipt(item.ticketId, token);
      await load();
      void refreshBills();
      setNotice(t.assist.cashReceiptDone);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyTicket(null);
    }
  }
  const item = bill?.items[0] ?? null;
  const header = bill ? billHeroStatus(bill, payeeView, t, theme) : null;
  const meta = bill ? [
    billDateTimeLabel(bill.createdAt),
    billItemCount(bill, t),
    payeeView ? null : billPayeeLabel(bill),
  ].filter((value) => typeof value === "string" && value !== "").join(" · ") : "";
  const canceledTow = bill !== null && bill.ticketType === "TOW" &&
    bill.ticketStatus === DISPATCH_STATUS.CANCELLED;
  const actionItem = bill?.items.find((row) => row.status === "UNPAID" && bill.canPay) ??
    bill?.items.find((row) => row.status === "PENDING") ?? bill?.items[0] ?? null;
  const actions: OverlayAction[] = bill ? billActionsFor({
    bill,
    actionItem,
    payerMode,
    payeeMode: payeeView,
    readOnly,
    busyTicket,
    invoiceBusy,
    t,
    onPay: (row, method) => void pay(row, method),
    onSwitchToCash: (row) => switchToCash(row),
    onConfirmCash: (row) => void confirmCash(row),
    onInvoice: () => void openInvoice(),
  }) : [];
  return (
    <ScreenContainer>
      <View style={styles.root}>
        <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
          {loading && !bill ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
          {params.payFirst === true && payerMode ? (
            <View style={[styles.banner, {borderColor: theme.primary, backgroundColor: theme.paper}]}>
              <MaterialIcons name="info-outline" size={18} color={theme.primary} />
              <Text style={[styles.bannerText, {color: theme.primary}]}>{t.bills.payFirst}</Text>
            </View>
          ) : null}
          {readOnly ? (
            <View style={[styles.banner, {borderColor: theme.border, backgroundColor: theme.paper}]}>
              <MaterialIcons name="visibility" size={18} color={theme.muted} />
              <Text style={[styles.bannerText, {color: theme.muted}]}>{t.bills.readOnly}</Text>
            </View>
          ) : null}
          {adminView ? (
            <View style={[styles.banner, {borderColor: theme.border, backgroundColor: theme.paper}]}>
              <MaterialIcons name="admin-panel-settings" size={18} color={theme.muted} />
              <Text style={[styles.bannerText, {color: theme.muted}]}>{t.bills.adminReadOnly}</Text>
            </View>
          ) : null}
          {operatorView ? (
            <View style={[styles.banner, {borderColor: theme.border, backgroundColor: theme.paper}]}>
              <MaterialIcons name="visibility" size={18} color={theme.muted} />
              <Text style={[styles.bannerText, {color: theme.muted}]}>{t.bills.readOnly}</Text>
            </View>
          ) : null}
          {payeeView ? (
            <View style={[styles.banner, {borderColor: theme.border, backgroundColor: theme.paper}]}>
              <MaterialIcons name="lock-outline" size={18} color={theme.muted} />
              <Text style={[styles.bannerText, {color: theme.muted}]}>{t.payments.payeeOnly}</Text>
            </View>
          ) : null}
          {error ? (
            <View style={[styles.errorCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <Text style={[styles.hint, {color: theme.danger}]}>{error}</Text>
              <Pressable style={[styles.retryBtn, {borderColor: theme.primary}]} onPress={() => void load()} accessibilityRole="button" accessibilityLabel={t.common.retry}>
                <Text style={{color: theme.primary}}>{t.common.retry}</Text>
              </Pressable>
            </View>
          ) : null}
          {bill ? (
            <>
              <BillHeroCard bill={bill} payeeMode={payeeView} header={header} meta={meta} t={t} theme={theme} />
              {item ? (
                <>
                  <BillPartiesCard item={item} t={t} theme={theme} lang={lang} />
                  <BillChargesCard item={item} t={t} theme={theme} />
                  <BillTotalsCard bill={bill} payee={payeeView} t={t} theme={theme} />
                  <BillPaymentCard item={item} payee={payeeView} t={t} theme={theme} />
                  <BillExtras
                    item={item}
                    payeeMode={payeeView}
                    payerMode={payerMode}
                    canceledTow={canceledTow}
                    theme={theme}
                    t={t}
                    onRefund={() => requestItemRefund(item)}
                    onClaim={(line) => {
                      if (!line.lineId) return;
                      setWarrantyFor({lineId: line.lineId, name: line.name});
                    }}
                  />
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
        {actions.length > 0 ? (
          <View style={[styles.footer, {backgroundColor: theme.paper, borderTopColor: theme.border, paddingBottom: insets.bottom + 12}]}>
            <ActionFooter actions={actions} layout="ticket" />
          </View>
        ) : null}
      </View>
      {sepayCheckout ? (
        <SePayCheckoutSheet
          t={t}
          url={sepayCheckout.url}
          checkout={sepayCheckout.checkout}
          status={sepayCheckout.status}
          busy={sepayBusy}
          error={sepayError}
          onClose={closeSepayCheckout}
          onSuccess={() => void onSepaySuccess()}
          onCancel={() => void onSepayCancel()}
          onFailure={onSepayFailure}
        />
      ) : null}
      <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      <WarrantyClaimDialog
        visible={warrantyFor !== null}
        ticketId={bill?.ticketId ?? ""}
        line={warrantyFor}
        token={token}
        theme={theme}
        t={t}
        onClose={() => setWarrantyFor(null)}
        onFiled={async () => {
          setWarrantyFor(null);
          setNotice(t.bills.warrantyClaimed);
          await load();
        }}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  scroll: {padding: 16, gap: 14, flexGrow: 1},
  loader: {marginTop: 24},
  banner: {borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center", gap: 8},
  bannerText: {flex: 1, fontSize: 13, fontWeight: "600"},
  errorCard: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 8},
  retryBtn: {borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center"},
  card: {borderWidth: 1, borderRadius: 20, padding: 16, gap: 8},
  cardTitle: {fontWeight: "700", fontSize: 17},
  hero: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 2, marginTop: 4},
  heroLabel: {fontSize: 11, fontWeight: "600"},
  heroAmount: {fontSize: 26, fontWeight: "800"},
  link: {fontSize: 13, fontWeight: "700"},
  muted: {fontSize: 12},
  hint: {fontSize: 12},
  itemStatus: {fontSize: 12, fontWeight: "700"},
  rowBetween: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  footer: {borderTopWidth: 1, padding: 12},
});
