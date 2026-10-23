import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation, useRoute} from "@react-navigation/native";
import {toMessage} from "../api/client";
import {payeeBills, type Bill} from "../api/bills";
import {myPayouts, type PayoutSummary} from "../api/payouts";
import {myProviders, type Provider} from "../api/providers";
import {useAuth} from "../context/AuthContext";
import {useBills} from "../context/BillsContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {darkTheme, lightTheme, type AppTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import BillRow from "./bills/BillRow";
import {billDateLabel} from "./bills/billLabels";
import {operatedKinds} from "./more/providerUi";
import type {Strings} from "../i18n/en";

type Tab = "pay" | "receive";

function EmptyState({tab, t, theme}: {tab: Tab; t: Strings; theme: AppTheme}) {
  return (
    <View style={[styles.emptyCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <MaterialIcons name={tab === "pay" ? "receipt-long" : "account-balance-wallet"} size={32} color={theme.muted} />
      <Text style={[styles.emptyTitle, {color: theme.text}]}>{tab === "pay" ? t.bills.empty : t.payments.emptyReceive}</Text>
      <Text style={[styles.emptyHint, {color: theme.muted}]}>{tab === "pay" ? t.bills.emptyHint : t.payments.emptyReceiveHint}</Text>
    </View>
  );
}

function PayoutHistory({summary, t, theme, highlightId}: {summary: PayoutSummary; t: Strings; theme: AppTheme; highlightId?: string}) {
  return (
    <View style={styles.payoutSection}>
      <View style={[styles.payoutSummary, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <View style={styles.payoutSummaryCell}>
          <Text style={[styles.payoutSummaryLabel, {color: theme.muted}]}>{t.payments.payoutPending}</Text>
          <Text style={[styles.payoutSummaryValue, {color: theme.text}]}>{`${summary.pending.net.toLocaleString()} VND`}</Text>
        </View>
        <View style={[styles.payoutSummaryDivider, {backgroundColor: theme.divider}]} />
        <View style={styles.payoutSummaryCell}>
          <Text style={[styles.payoutSummaryLabel, {color: theme.muted}]}>{t.payments.payoutPaid}</Text>
          <Text style={[styles.payoutSummaryValue, {color: theme.success}]}>{`${summary.settled.net.toLocaleString()} VND`}</Text>
        </View>
      </View>
      <Text style={[styles.sectionLabel, {color: theme.text}]}>{t.payments.payoutHistory}</Text>
      {summary.batches.length === 0 ? (
        <Text style={[styles.payoutEmpty, {color: theme.muted}]}>{t.payments.noPayouts}</Text>
      ) : summary.batches.map((batch) => (
        <View
          key={batch.id}
          style={[styles.payoutCard, {backgroundColor: theme.paper, borderColor: batch.id === highlightId ? theme.primary : theme.border}]}
        >
          <View style={styles.payoutHead}>
            <Text style={[styles.payoutRef, {color: theme.text}]}>{batch.payoutRef}</Text>
            <Text style={[styles.payoutStatus, {color: theme.success}]}>{t.payments.payoutPaid}</Text>
          </View>
          <Text style={[styles.payoutMeta, {color: theme.muted}]}>
            {billDateLabel(batch.batchedAt)} · {batch.itemCount} {batch.itemCount === 1 ? t.bills.item : t.bills.items}
          </Text>
          <View style={styles.payoutMoneyRow}>
            <Text style={[styles.payoutMeta, {color: theme.muted}]}>{`${t.payments.collected} ${batch.gross.toLocaleString()}`}</Text>
            <Text style={[styles.payoutMeta, {color: "#d97706"}]}>{`${t.payments.commission} ${batch.commission.toLocaleString()}`}</Text>
            <Text style={[styles.payoutNet, {color: theme.success}]}>{`${t.payments.netPayout} ${batch.net.toLocaleString()} VND`}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function PaymentsScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {bills: riderBills, refresh: refreshRider, loading: riderLoading, error: riderError} = useBills();
  const {mode} = useThemeMode();
  const navigation = useNavigation() as unknown as {navigate: (name: string, params?: Record<string, unknown>) => void; setOptions: (options: {title?: string}) => void};
  const params = (useRoute().params ?? {}) as {tab?: Tab; payoutId?: string};
  const theme = mode === "dark" ? darkTheme : lightTheme;
  const [tab, setTab] = useState<Tab>(params.tab === "receive" ? "receive" : "pay");
  const [payee, setPayee] = useState<Bill[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [payouts, setPayouts] = useState<PayoutSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async (): Promise<void> => {
    if (!token) {
      setPayee([]);
      setProviders([]);
      setPayouts(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [payeeResult, providerResult, payoutResult] = await Promise.allSettled([
      payeeBills(token),
      myProviders(token),
      myPayouts(token),
    ]);
    if (payeeResult.status === "fulfilled") {
      setPayee(Array.isArray(payeeResult.value) ? payeeResult.value : []);
      setError(null);
    } else {
      setError(toMessage(payeeResult.reason));
    }
    if (providerResult.status === "fulfilled") {
      setProviders(Array.isArray(providerResult.value) ? providerResult.value : []);
    }
    setPayouts(payoutResult.status === "fulfilled" ? payoutResult.value : null);
    setLoading(false);
  }, [token]);
  const operated = operatedKinds(providers);
  const canReceive = operated.shop || operated.tow || payee.length > 0 || (payouts?.batches.length ?? 0) > 0;
  useEffect(() => {
    navigation.setOptions({title: t.payments.title});
  }, [navigation, t]);
  useEffect(() => {
    if (!loading && !canReceive && tab === "receive") setTab("pay");
  }, [canReceive, loading, tab]);
  useFocusEffect(useCallback(() => {
    void refreshRider();
    void load();
  }, [load, refreshRider]));
  const reload = (): void => {
    void refreshRider();
    void load();
  };
  const pay = (bill: Bill): void => {
    navigation.navigate("BillDetail", {ticketId: bill.ticketId});
  };
  const receive = (bill: Bill): void => {
    navigation.navigate("BillDetail", {ticketId: bill.ticketId, scope: "payee"});
  };
  const visible = tab === "pay" ? riderBills : payee;
  const visibleLoading = tab === "pay" ? riderLoading : loading;
  const visibleError = tab === "pay" ? (riderError ? t.payments.loadError : null) : error;
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        {canReceive ? (
          <View style={[styles.tabs, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            {(["pay", "receive"] as Tab[]).map((id) => {
              const active = tab === id;
              const label = id === "pay" ? t.payments.toPay : t.payments.toReceive;
              return (
                <Pressable
                  key={id}
                  style={[styles.tab, active && {backgroundColor: theme.primary}]}
                  onPress={() => setTab(id)}
                  accessibilityRole="button"
                  accessibilityState={{selected: active}}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.tabText, {color: active ? "#fff" : theme.text}]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.sectionLabel, {color: theme.text}]}>{t.payments.toPay}</Text>
        )}
        {visibleLoading && visible.length === 0 ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
        {visibleError ? (
          <View style={[styles.errorCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <Text style={[styles.errorText, {color: theme.danger}]}>{visibleError}</Text>
            <Pressable style={[styles.retryBtn, {borderColor: theme.primary}]} onPress={reload} accessibilityRole="button" accessibilityLabel={t.common.retry}>
              <Text style={{color: theme.primary}}>{t.common.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {tab === "receive" && payouts ? <PayoutHistory summary={payouts} t={t} theme={theme} highlightId={params.payoutId} /> : null}
        {!visibleLoading && !visibleError && visible.length === 0 ? <EmptyState tab={tab} t={t} theme={theme} /> : null}
        {visible.map((bill) => (
          <BillRow
            key={bill.billId}
            bill={bill}
            t={t}
            theme={theme}
            mode={tab === "pay" ? "rider" : "payee"}
            onPress={() => (tab === "pay" ? pay(bill) : receive(bill))}
          />
        ))}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 10, flexGrow: 1},
  tabs: {borderWidth: 1, borderRadius: 12, padding: 4, flexDirection: "row", gap: 4},
  tab: {flex: 1, borderRadius: 9, paddingVertical: 8, alignItems: "center"},
  tabText: {fontSize: 13, fontWeight: "700"},
  sectionLabel: {fontSize: 15, fontWeight: "700", marginTop: 4},
  loader: {marginTop: 24},
  errorCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 8},
  errorText: {fontSize: 13},
  retryBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center"},
  emptyCard: {borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 8, marginTop: 24},
  emptyTitle: {fontWeight: "700", fontSize: 16},
  emptyHint: {fontSize: 13, textAlign: "center"},
  payoutSection: {gap: 10},
  payoutSummary: {borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "center"},
  payoutSummaryCell: {flex: 1, gap: 4, alignItems: "center"},
  payoutSummaryLabel: {fontSize: 12, fontWeight: "600"},
  payoutSummaryValue: {fontSize: 16, fontWeight: "700"},
  payoutSummaryDivider: {width: 1, alignSelf: "stretch"},
  payoutEmpty: {fontSize: 13, paddingVertical: 6},
  payoutCard: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
  payoutHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  payoutRef: {fontWeight: "700", fontSize: 14},
  payoutStatus: {fontSize: 11, fontWeight: "700"},
  payoutMeta: {fontSize: 12},
  payoutMoneyRow: {gap: 2},
  payoutNet: {fontSize: 13, fontWeight: "700"},
});
