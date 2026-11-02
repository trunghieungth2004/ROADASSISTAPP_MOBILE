import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Alert, AppState, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation, useRoute} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {toMessage} from "../api/client";
import {fetchBill, type Bill, type BillItem} from "../api/bills";
import {cancelPayment, confirmCashReceipt, createPayment, fetchTicketPayments, type TicketPayment} from "../api/dispatch";
import {paymentMethodLabel} from "../api/payments";
import {useAuth} from "../context/AuthContext";
import {useBills} from "../context/BillsContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import SePayCheckoutSheet from "./assist/SePayCheckoutSheet";
import {billDateLabel, billItemCount, billItemLabel, billItemStatusColor, billItemStatusLabel, billPayeeLabel, billStatusColor, billStatusLabel, billTitle, itemNetPayout, itemPayoutStatus, payeeSummary, payoutStatusColor, payoutStatusLabel} from "./bills/billLabels";

type BillParams = {
  ticketId?: string;
  billId?: string;
  payFirst?: boolean;
  readOnly?: boolean;
  scope?: "payee";
};

const RECEIVED = new Set(["HELD", "CONFIRMED", "PARTIAL"]);

export default function BillDetailScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {refresh: refreshBills} = useBills();
  const {mode} = useThemeMode();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const params = (route.params ?? {}) as BillParams;
  const ticketId = params.ticketId;
  const billId = params.billId;
  const payeeMode = params.scope === "payee";
  const readOnly = params.readOnly === true;
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);
  const [sepayCheckout, setSepayCheckout] = useState<{ticketId: string; status: string; url: string; checkout: TicketPayment["checkout"]} | null>(null);
  const [sepayBusy, setSepayBusy] = useState(false);
  const [sepayError, setSepayError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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
    navigation.setOptions({title: payeeMode ? t.payments.detailTitle : t.bills.title});
  }, [navigation, t, payeeMode]);
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
    if (!token || busyTicket !== null || readOnly || payeeMode || !bill?.canPay) return;
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
    if (!token || busyTicket !== null || readOnly || !item.payment?.canConfirmCash) return;
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
  const summary = bill && payeeMode ? payeeSummary(bill) : null;
  const payeeLabel = bill ? billPayeeLabel(bill) : null;
  const meta = bill ? [
    billDateLabel(bill.createdAt),
    billItemCount(bill, t),
    payeeMode ? null : payeeLabel,
  ].filter((value) => typeof value === "string" && value !== "").join(" · ") : "";
  const headerLabel = summary !== null ? payoutStatusLabel(summary.payout, t) : bill ? billStatusLabel(bill.status, t) : "";
  const headerColor = summary !== null ? payoutStatusColor(summary.payout, theme) : bill ? billStatusColor(bill.status, theme) : theme.muted;
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        {loading && !bill ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
        {params.payFirst === true && !readOnly && !payeeMode ? (
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
        {payeeMode ? (
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
            <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={styles.rowBetween}>
                <Text style={[styles.cardTitle, {color: theme.text}]}>{billTitle(bill, t)}</Text>
                <View style={[styles.pill, {backgroundColor: headerColor}]}>
                  <Text style={styles.pillText}>{headerLabel}</Text>
                </View>
              </View>
              <Text style={[styles.muted, {color: theme.muted}]}>{meta}</Text>
              {summary !== null ? (
                <>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.yourItems}</Text>
                    <Text style={[styles.totalText, {color: theme.text}]}>{`${bill.total.toLocaleString()} VND`}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.collected}</Text>
                    <Text style={[styles.totalText, {color: theme.text}]}>{`${summary.collected.toLocaleString()} VND`}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.commission}</Text>
                    <Text style={[styles.totalText, {color: "#d97706"}]}>{`${summary.commission.toLocaleString()} VND`}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.netPayout}</Text>
                    <Text style={[styles.totalText, {color: theme.success}]}>{`${summary.net.toLocaleString()} VND`}</Text>
                  </View>
                  <View style={[styles.totalRow, styles.payoutRow, {borderTopColor: theme.divider}]}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.payout}</Text>
                    <Text style={[styles.itemStatus, {color: payoutStatusColor(summary.payout, theme)}]}>{payoutStatusLabel(summary.payout, t)}</Text>
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.bills.total}</Text>
                    <Text style={[styles.totalText, {color: theme.text}]}>{`${bill.total.toLocaleString()} VND`}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.bills.paid}</Text>
                    <Text style={[styles.totalText, {color: theme.success}]}>{`${bill.paid.toLocaleString()} VND`}</Text>
                  </View>
                  <View style={styles.totalRow}>
                    <Text style={[styles.muted, {color: theme.muted}]}>{t.bills.due}</Text>
                    <Text style={[styles.totalText, {color: bill.due > 0 ? "#d97706" : theme.muted}]}>{`${bill.due.toLocaleString()} VND`}</Text>
                  </View>
                  {bill.due === 0 ? <Text style={[styles.hint, {color: theme.muted}]}>{t.bills.nothingDue}</Text> : null}
                </>
              )}
            </View>
            {bill.items.map((item) => {
              const label = billItemLabel(item, t);
              const busy = busyTicket === item.ticketId;
              const itemPayment = item.payment;
              const received = itemPayment !== null && RECEIVED.has(itemPayment.status);
              const payout = itemPayoutStatus(item);
              return (
                <View key={item.ticketId} style={[styles.item, {backgroundColor: theme.paper, borderColor: theme.border}]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemTitle, {color: theme.text}]}>{label}</Text>
                    <Text style={[styles.itemAmount, {color: theme.text}]}>{`${item.amount.toLocaleString()} VND`}</Text>
                  </View>
                  {item.waitingFee > 0 ? (
                    <Text style={[styles.muted, {color: theme.muted}]}>{`${t.bills.waiting}: ${item.waitingFee.toLocaleString()} VND`}</Text>
                  ) : null}
                  {Array.isArray(item.items) && item.items.length > 0 ? (
                    <View style={styles.itemLines}>
                      {item.items.map((line, index) => (
                        <View key={`${line.name}-${index}`} style={styles.rowBetween}>
                          <Text style={[styles.muted, {color: theme.muted, flex: 1}]} numberOfLines={2}>{`${line.name} × ${line.qty}`}</Text>
                          <Text style={[styles.muted, {color: theme.text}]}>{`${line.amount.toLocaleString()} VND`}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                  {item.payeeName ? <Text style={[styles.muted, {color: theme.muted}]}>{item.payeeName}</Text> : null}
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemStatus, {color: billItemStatusColor(item.status, theme)}]}>{billItemStatusLabel(item.status, t)}</Text>
                    {itemPayment ? <Text style={[styles.muted, {color: theme.muted}]}>{paymentMethodLabel(itemPayment.method)}</Text> : null}
                  </View>
                  {payeeMode ? (
                    <>
                      {itemPayment === null ? <Text style={[styles.hint, {color: theme.muted}]}>{t.payments.notCollected}</Text> : null}
                      {received ? (
                        <>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.commission}</Text>
                            <Text style={[styles.itemStatus, {color: "#d97706"}]}>{`${(itemPayment.commissionAmount ?? 0).toLocaleString()} VND`}</Text>
                          </View>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.netPayout}</Text>
                            <Text style={[styles.itemStatus, {color: theme.success}]}>{`${itemNetPayout(item).toLocaleString()} VND`}</Text>
                          </View>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.muted, {color: theme.muted}]}>{t.payments.payout}</Text>
                            <Text style={[styles.itemStatus, {color: payoutStatusColor(payout, theme)}]}>{payoutStatusLabel(payout, t)}</Text>
                          </View>
                        </>
                      ) : null}
                      {itemPayment?.status === "PENDING" && itemPayment.method === "CASH" && !readOnly && itemPayment.canConfirmCash ? (
                        <Pressable
                          style={[styles.payBtn, {backgroundColor: theme.primary}, busy && styles.disabled]}
                          disabled={busy}
                          onPress={() => void confirmCash(item)}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.assist.cashConfirmReceipt} ${label}`}
                        >
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>{t.assist.cashConfirmReceipt}</Text>}
                        </Pressable>
                      ) : null}
                      {itemPayment?.status === "PENDING" && itemPayment.method === "CASH" && !itemPayment.canConfirmCash ? (
                        <Text style={[styles.hint, {color: theme.muted}]}>{t.payments.cashPending}</Text>
                      ) : null}
                      {itemPayment?.status === "PENDING" && itemPayment.method === "SEPAY" ? (
                        <Text style={[styles.hint, {color: theme.muted}]}>{t.payments.awaitingRider}</Text>
                      ) : null}
                    </>
                  ) : null}
                  {!payeeMode && item.status === "UNPAID" && !readOnly && bill.canPay ? (
                    <>
                      <View style={styles.payRow}>
                        <Pressable
                          style={[styles.payBtn, {backgroundColor: theme.primary}, busy && styles.disabled]}
                          disabled={busy}
                          onPress={() => void pay(item, "SEPAY")}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.bills.paySepay} ${label}`}
                        >
                          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>{t.bills.paySepay}</Text>}
                        </Pressable>
                        <Pressable
                          style={[styles.payBtn, styles.cashBtn, {borderColor: theme.primary}, busy && styles.disabled]}
                          disabled={busy}
                          onPress={() => void pay(item, "CASH")}
                          accessibilityRole="button"
                          accessibilityLabel={`${t.bills.payCash} ${label}`}
                        >
                          <Text style={[styles.cashText, {color: theme.primary}]}>{t.bills.payCash}</Text>
                        </Pressable>
                      </View>
                      <Text style={[styles.hint, {color: theme.muted}]}>{t.bills.payCashHint}</Text>
                    </>
                  ) : null}
                  {!payeeMode && item.status === "PENDING" && itemPayment?.method === "SEPAY" && !readOnly && bill.canPay ? (
                    <View style={styles.payRow}>
                      <Pressable
                        style={[styles.payBtn, {backgroundColor: theme.primary}, busy && styles.disabled]}
                        disabled={busy}
                        onPress={() => void pay(item, "SEPAY")}
                        accessibilityRole="button"
                        accessibilityLabel={t.bills.openQr}
                      >
                        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.payText}>{t.bills.openQr}</Text>}
                      </Pressable>
                      <Pressable
                        style={[styles.payBtn, styles.cashBtn, {borderColor: theme.primary}, busy && styles.disabled]}
                        disabled={busy}
                        onPress={() => switchToCash(item)}
                        accessibilityRole="button"
                        accessibilityLabel={t.bills.payCash}
                      >
                        <Text style={[styles.cashText, {color: theme.primary}]}>{t.bills.payCash}</Text>
                      </Pressable>
                    </View>
                  ) : null}
                  {!payeeMode && item.status === "PENDING" && itemPayment?.method === "CASH" ? (
                    <Text style={[styles.hint, {color: theme.muted}]}>{t.bills.cashArmed}</Text>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
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
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 10, flexGrow: 1},
  loader: {marginTop: 24},
  banner: {borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 8},
  bannerText: {flex: 1, fontSize: 13, fontWeight: "600"},
  errorCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 8},
  retryBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center"},
  card: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 6},
  cardTitle: {fontWeight: "700", fontSize: 17},
  item: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 6},
  itemTitle: {fontWeight: "700", fontSize: 15},
  itemAmount: {fontWeight: "700", fontSize: 15},
  itemStatus: {fontSize: 12, fontWeight: "700"},
  rowBetween: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  muted: {fontSize: 12},
  hint: {fontSize: 12},
  itemLines: {gap: 3},
  totalRow: {flexDirection: "row", justifyContent: "space-between", alignItems: "center"},
  payoutRow: {borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 6, marginTop: 2},
  totalText: {fontWeight: "700", fontSize: 14},
  payRow: {flexDirection: "row", gap: 8, marginTop: 4},
  payBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  cashBtn: {borderWidth: 1, backgroundColor: "transparent"},
  payText: {color: "#fff", fontWeight: "700"},
  cashText: {fontWeight: "700"},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  disabled: {opacity: 0.6},
});
