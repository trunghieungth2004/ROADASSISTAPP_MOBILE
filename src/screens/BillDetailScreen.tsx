import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation, useRoute} from "@react-navigation/native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {toMessage} from "../api/client";
import {fetchBill, type Bill, type BillItem} from "../api/bills";
import {createPayment} from "../api/dispatch";
import {paymentMethodLabel} from "../api/payments";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Snack from "../components/ui/Snack";
import {snackBottom} from "../components/ui/snackOffset";
import {billDateLabel, billItemCount, billItemLabel, billItemStatusColor, billItemStatusLabel, billPayeeLabel, billStatusColor, billStatusLabel, billTitle} from "./bills/billLabels";

type BillParams = {ticketId?: string; billId?: string; payFirst?: boolean};

export default function BillDetailScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {mode} = useThemeMode();
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const params = (route.params ?? {}) as BillParams;
  const ticketId = params.ticketId;
  const billId = params.billId;
  const [bill, setBill] = useState<Bill | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyTicket, setBusyTicket] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async (): Promise<void> => {
    if (!token) return;
    try {
      setBill(await fetchBill(token, ticketId ? {ticketId} : {billId}));
      setError(null);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, ticketId, billId]);
  useEffect(() => {
    navigation.setOptions({title: t.bills.title});
  }, [navigation, t]);
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
    if (!token || busyTicket !== null) return;
    setBusyTicket(item.ticketId);
    setError(null);
    try {
      const created = await createPayment(item.ticketId, method, token);
      await load();
      if (method === "SEPAY") {
        if (created.checkoutUrl) await Linking.openURL(created.checkoutUrl);
        else setError(t.bills.qrMissing);
      } else {
        setNotice(t.bills.cashArmed);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusyTicket(null);
    }
  }
  const payee = bill ? billPayeeLabel(bill) : null;
  const meta = bill ? [billDateLabel(bill.createdAt), billItemCount(bill, t), payee].filter((value) => typeof value === "string" && value !== "").join(" · ") : "";
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        {loading && !bill ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
        {params.payFirst === true ? (
          <View style={[styles.banner, {borderColor: theme.primary, backgroundColor: theme.paper}]}>
            <MaterialIcons name="info-outline" size={18} color={theme.primary} />
            <Text style={[styles.bannerText, {color: theme.primary}]}>{t.bills.payFirst}</Text>
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
                <View style={[styles.pill, {backgroundColor: billStatusColor(bill.status, theme)}]}>
                  <Text style={styles.pillText}>{billStatusLabel(bill.status, t)}</Text>
                </View>
              </View>
              <Text style={[styles.muted, {color: theme.muted}]}>{meta}</Text>
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
            </View>
            {bill.items.map((item) => {
              const label = billItemLabel(item, t);
              const busy = busyTicket === item.ticketId;
              return (
                <View key={item.ticketId} style={[styles.item, {backgroundColor: theme.paper, borderColor: theme.border}]}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemTitle, {color: theme.text}]}>{label}</Text>
                    <Text style={[styles.itemAmount, {color: theme.text}]}>{`${item.amount.toLocaleString()} VND`}</Text>
                  </View>
                  {item.waitingFee > 0 ? (
                    <Text style={[styles.muted, {color: theme.muted}]}>{`${t.bills.waiting}: ${item.waitingFee.toLocaleString()} VND`}</Text>
                  ) : null}
                  {item.payeeName ? <Text style={[styles.muted, {color: theme.muted}]}>{item.payeeName}</Text> : null}
                  <View style={styles.rowBetween}>
                    <Text style={[styles.itemStatus, {color: billItemStatusColor(item.status, theme)}]}>{billItemStatusLabel(item.status, t)}</Text>
                    {item.payment ? <Text style={[styles.muted, {color: theme.muted}]}>{paymentMethodLabel(item.payment.method)}</Text> : null}
                  </View>
                  {item.status === "UNPAID" ? (
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
                  {item.status === "PENDING" && item.payment?.method === "SEPAY" && item.qrUrl ? (
                    <Pressable
                      style={[styles.payBtn, {backgroundColor: theme.primary}]}
                      onPress={() => void Linking.openURL(item.qrUrl as string)}
                      accessibilityRole="button"
                      accessibilityLabel={t.bills.openQr}
                    >
                      <Text style={styles.payText}>{t.bills.openQr}</Text>
                    </Pressable>
                  ) : null}
                  {item.status === "PENDING" && item.payment?.method === "CASH" ? (
                    <Text style={[styles.hint, {color: theme.muted}]}>{t.bills.cashArmed}</Text>
                  ) : null}
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
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
  totalRow: {flexDirection: "row", justifyContent: "space-between", alignItems: "center"},
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
