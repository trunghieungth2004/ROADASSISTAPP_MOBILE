import {useCallback, useEffect, useRef, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation, useRoute} from "@react-navigation/native";
import {toMessage} from "../api/client";
import {payeeBills, type Bill} from "../api/bills";
import {
  myPayouts,
  payoutBanks,
  requestPayout,
  savePayoutAccount,
  type PayoutBank,
  type PayoutSummary,
} from "../api/payouts";
import {myProviders, type Provider} from "../api/providers";
import {myRefunds, type RefundRequest} from "../api/refunds";
import {useAuth} from "../context/AuthContext";
import {useBills} from "../context/BillsContext";
import {useStrings} from "../context/LanguageContext";
import {useThemeMode} from "../context/ThemeContext";
import {themeForMode, type AppTheme} from "../theme";
import ScreenContainer from "../components/ui/ScreenContainer";
import Overlay from "../components/overlay/Overlay";
import BillRow from "./bills/BillRow";
import PaymentDetailSheet from "./bills/PaymentDetailSheet";
import RefundDetailSheet from "./bills/RefundDetailSheet";
import RefundRow from "./bills/RefundRow";
import {
  billDateLabel,
  billMatchesService,
  payeeSummary,
  refundOpenAmount,
  refundReceivedAmount,
} from "./bills/billLabels";
import ServiceIcon from "../components/ui/ServiceIcon";
import {operatedKinds} from "./more/providerUi";
import type {Strings} from "../i18n/en";

type Tab = "pay" | "receive";
type ServiceFilter = "ALL" | "TOW" | "REPAIR" | "SOS";

function EmptyState({tab, t, theme}: {tab: Tab; t: Strings; theme: AppTheme}) {
  return (
    <View style={[styles.emptyCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <MaterialIcons name={tab === "pay" ? "receipt-long" : "account-balance-wallet"} size={32} color={theme.muted} />
      <Text style={[styles.emptyTitle, {color: theme.text}]}>{tab === "pay" ? t.bills.empty : t.payments.emptyReceive}</Text>
      <Text style={[styles.emptyHint, {color: theme.muted}]}>{tab === "pay" ? t.bills.emptyHint : t.payments.emptyReceiveHint}</Text>
    </View>
  );
}

function requestStatusLabel(status: string, t: Strings): string {
  if (status === "PAID") return t.payments.requestStatusPAID;
  if (status === "REJECTED") return t.payments.requestStatusREJECTED;
  if (status === "CANCELLED") return t.payments.requestStatusCANCELLED;
  return t.payments.requestStatusPENDING;
}

function PayoutHistory({
  summary,
  t,
  theme,
  highlightId,
  onEditAccount,
  onWithdraw,
}: {
  summary: PayoutSummary;
  t: Strings;
  theme: AppTheme;
  highlightId?: string;
  onEditAccount: () => void;
  onWithdraw: () => void;
}) {
  const account = summary.account;
  const masked = account ? `•••• ${account.accountNumber.slice(-4)}` : null;
  return (
    <View style={styles.payoutSection}>
      <View style={[styles.payoutSummary, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <View style={styles.payoutSummaryCell}>
          <Text style={[styles.payoutSummaryLabel, {color: theme.muted}]}>{t.payments.available}</Text>
          <Text style={[styles.payoutSummaryValue, {color: theme.text}]}>{`${(summary.pending.available ?? 0).toLocaleString()} VND`}</Text>
        </View>
        <View style={[styles.payoutSummaryDivider, {backgroundColor: theme.divider}]} />
        <View style={styles.payoutSummaryCell}>
          <Text style={[styles.payoutSummaryLabel, {color: theme.muted}]}>{t.payments.commissionOwed}</Text>
          <Text style={[styles.payoutSummaryValue, {color: summary.pending.commissionOwed > 0 ? theme.danger : theme.text}]}>{`${(summary.pending.commissionOwed ?? 0).toLocaleString()} VND`}</Text>
        </View>
        <View style={[styles.payoutSummaryDivider, {backgroundColor: theme.divider}]} />
        <View style={styles.payoutSummaryCell}>
          <Text style={[styles.payoutSummaryLabel, {color: theme.muted}]}>{t.payments.payoutPaid}</Text>
          <Text style={[styles.payoutSummaryValue, {color: theme.success}]}>{`${summary.settled.net.toLocaleString()} VND`}</Text>
        </View>
      </View>
      <View style={[styles.accountCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <MaterialIcons name="account-balance" size={20} color={theme.primary} />
        <View style={styles.accountText}>
          <Text style={[styles.accountTitle, {color: theme.text}]}>{account ? account.bankName : t.payments.addAccount}</Text>
          {account ? (
            <Text style={[styles.payoutMeta, {color: theme.muted}]}>{`${masked} · ${account.holderName}`}</Text>
          ) : null}
        </View>
        <Pressable style={[styles.smallBtn, {borderColor: theme.primary}]} onPress={onEditAccount} accessibilityRole="button">
          <Text style={{color: theme.primary, fontSize: 12, fontWeight: "700"}}>{account ? t.payments.editAccount : t.payments.addAccount}</Text>
        </Pressable>
      </View>
      {(summary.pendingRequestCount ?? 0) > 0 ? (
        <Text style={[styles.payoutMeta, {color: theme.muted}]}>{t.payments.requestPending}</Text>
      ) : (summary.pending.available ?? 0) > 0 ? (
        <Pressable style={[styles.withdrawBtn, {backgroundColor: theme.primary}]} onPress={onWithdraw} accessibilityRole="button">
          <MaterialIcons name="payments" size={18} color="#fff" />
          <Text style={styles.withdrawText}>{t.payments.withdraw}</Text>
        </Pressable>
      ) : null}
      {(summary.requests ?? []).length > 0 ? (
        <>
          <Text style={[styles.sectionLabel, {color: theme.text}]}>{t.payments.requests}</Text>
          {(summary.requests ?? []).map((request) => (
            <View key={request.id} style={[styles.requestRow, {backgroundColor: theme.paper, borderColor: theme.border}]}>
              <View style={styles.accountText}>
                <Text style={[styles.payoutRef, {color: theme.text}]}>{`${request.amount.toLocaleString()} VND`}</Text>
                <Text style={[styles.payoutMeta, {color: theme.muted}]}>{billDateLabel(request.requestedAt)}</Text>
              </View>
              <Text style={[styles.payoutStatus, {color: request.status === "PAID" ? theme.success : request.status === "REJECTED" ? theme.danger : theme.muted}]}>{requestStatusLabel(request.status, t)}</Text>
            </View>
          ))}
        </>
      ) : null}
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
            {typeof batch.commissionDeducted === "number" && batch.commissionDeducted > 0 ? (
              <Text style={[styles.payoutMeta, {color: theme.danger}]}>{`${t.payments.commissionOwed} -${batch.commissionDeducted.toLocaleString()}`}</Text>
            ) : null}
            <Text style={[styles.payoutNet, {color: theme.success}]}>{`${t.payments.netPayout} ${(batch.netPayout ?? batch.net).toLocaleString()} VND`}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function TabBar({tab, onSelect, t, theme}: {
  tab: Tab;
  onSelect: (tab: Tab) => void;
  t: Strings;
  theme: AppTheme;
}) {
  return (
    <View style={[styles.tabs, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      {(["pay", "receive"] as Tab[]).map((id) => {
        const active = tab === id;
        const label = id === "pay" ? t.payments.toPay : t.payments.toReceive;
        return (
          <Pressable
            key={id}
            style={[styles.tab, active && {backgroundColor: theme.primary}]}
            onPress={() => onSelect(id)}
            accessibilityRole="button"
            accessibilityState={{selected: active}}
            accessibilityLabel={label}
          >
            <Text style={[styles.tabText, {color: active ? "#fff" : theme.text}]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const SERVICE_FILTERS: ServiceFilter[] = ["ALL", "TOW", "REPAIR", "SOS"];

function ServiceFilterBar({value, onChange, t, theme}: {
  value: ServiceFilter;
  onChange: (value: ServiceFilter) => void;
  t: Strings;
  theme: AppTheme;
}) {
  return (
    <View style={styles.serviceFilters}>
      {SERVICE_FILTERS.map((id) => {
        const active = value === id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            style={[styles.serviceFilter, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : theme.paper}]}
            accessibilityRole="button"
            accessibilityState={{selected: active}}
            accessibilityLabel={id === "ALL" ? t.common.all : id === "TOW" ? t.assist.typeTow : id === "SOS" ? t.assist.typeSos : t.assist.typeWalkin}
          >
            {id === "ALL" ? (
              <MaterialIcons name="apps" size={18} color={active ? theme.primary : theme.muted} />
            ) : (
              <ServiceIcon service={id === "TOW" ? "TOW" : id === "SOS" ? "SOS" : "REPAIR"} color={active ? theme.primary : theme.muted} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

type TotalCell = {label: string; value: number; money?: boolean};

function TotalsRow({totals, theme}: {
  totals: TotalCell[];
  theme: AppTheme;
}) {
  return (
    <View style={[styles.filterTotals, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      {totals.map((cell) => (
        <View key={cell.label} style={styles.filterTotalCell}>
          <Text style={[styles.filterTotalLabel, {color: theme.muted}]}>{cell.label}</Text>
          <Text style={[styles.filterTotalValue, {color: theme.text}]}>
            {cell.money === false ?
              cell.value.toLocaleString() :
              `${cell.value.toLocaleString()} VND`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function RefundSection({refunds, billByTicket, total, t, theme, onOpen}: {
  refunds: RefundRequest[];
  billByTicket: Map<string, Bill>;
  total: number;
  t: Strings;
  theme: AppTheme;
  onOpen: (refund: RefundRequest) => void;
}) {
  if (refunds.length === 0) return null;
  return (
    <>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionLabel, {color: theme.text}]}>{t.payments.refunds}</Text>
        <Text style={[styles.sectionAmount, {color: theme.text}]}>{`${total.toLocaleString()} VND`}</Text>
      </View>
      {refunds.map((refund) => (
        <RefundRow
          key={refund.id}
          refund={refund}
          bill={billByTicket.get(refund.ticketId) ?? null}
          t={t}
          theme={theme}
          onPress={() => onOpen(refund)}
        />
      ))}
    </>
  );
}

function providerReceive(
  operated: {shop: boolean; tow: boolean},
  payee: Bill[],
  payouts: PayoutSummary | null,
): boolean {
  return operated.shop || operated.tow || payee.length > 0 ||
    (payouts?.batches?.length ?? 0) > 0 ||
    (payouts?.requests?.length ?? 0) > 0;
}

function refundsFor(
  refunds: RefundRequest[],
  billByTicket: Map<string, Bill>,
  serviceFilter: ServiceFilter,
): RefundRequest[] {
  if (serviceFilter === "ALL") return refunds;
  return refunds.filter((refund) => {
    const bill = billByTicket.get(refund.ticketId);
    return bill !== undefined && billMatchesService(bill, serviceFilter);
  });
}

function totalsFor({
  tab,
  t,
  hasProvider,
  filtered,
  payeeTotals,
  refunds,
}: {
  tab: Tab;
  t: Strings;
  hasProvider: boolean;
  filtered: Bill[];
  payeeTotals: {gross: number; commission: number; net: number};
  refunds: RefundRequest[];
}): TotalCell[] {
  const money = (label: string, value: number): TotalCell =>
    ({label, value});
  const count = (label: string, value: number): TotalCell =>
    ({label, value, money: false});
  if (tab === "pay") {
    const riderTotals = filtered.reduce(
      (sum, bill) => ({
        total: sum.total + bill.total,
        paid: sum.paid + bill.paid,
        due: sum.due + bill.due,
      }),
      {total: 0, paid: 0, due: 0},
    );
    return [
      money(t.bills.total, riderTotals.total),
      money(t.bills.paid, riderTotals.paid),
      money(t.bills.due, riderTotals.due),
    ];
  }
  if (hasProvider && filtered.length > 0) {
    return [
      money(t.payments.gross, payeeTotals.gross),
      money(t.payments.commission, payeeTotals.commission),
      money(t.payments.netPayout, payeeTotals.net),
    ];
  }
  return [
    money(t.payments.refundToReceive, refundOpenAmount(refunds)),
    money(t.payments.refundReceived, refundReceivedAmount(refunds)),
    count(t.payments.refunds, refunds.length),
  ];
}

function shouldShowEmpty({
  tab,
  loading,
  error,
  filtered,
  refunds,
  payouts,
}: {
  tab: Tab;
  loading: boolean;
  error: string | null;
  filtered: Bill[];
  refunds: RefundRequest[];
  payouts: PayoutSummary | null;
}): boolean {
  if (loading || error) return false;
  if (tab === "pay") return filtered.length === 0;
  const hasPayouts = (payouts?.batches?.length ?? 0) > 0 ||
    (payouts?.requests?.length ?? 0) > 0 ||
    (payouts?.pending?.available ?? 0) > 0;
  return refunds.length === 0 && filtered.length === 0 && !hasPayouts;
}

export default function PaymentsScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {bills: riderBills, refresh: refreshRider, loading: riderLoading, error: riderError} = useBills();
  const {mode} = useThemeMode();
  const navigation = useNavigation() as unknown as {setOptions: (options: {title?: string}) => void};
  const params = (useRoute().params ?? {}) as {tab?: Tab; payoutId?: string};
  const theme = themeForMode(mode);
  const [tab, setTab] = useState<Tab>(params.tab === "receive" ? "receive" : "pay");
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>("ALL");
  const [payee, setPayee] = useState<Bill[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [payouts, setPayouts] = useState<PayoutSummary | null>(null);
  const [refunds, setRefunds] = useState<RefundRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [providersLoaded, setProvidersLoaded] = useState(false);
  const receiveLoadedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [detailFor, setDetailFor] = useState<{ticketId: string; scope?: "payee"} | null>(null);
  const [refundFor, setRefundFor] = useState<RefundRequest | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [accountOpen, setAccountOpen] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [holderName, setHolderName] = useState("");
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBusy, setWithdrawBusy] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  useEffect(() => {
    if (params.tab === "pay" || params.tab === "receive") setTab(params.tab);
  }, [params.tab]);
  const loadProviders = useCallback(async (): Promise<void> => {
    if (!token || providersLoaded) return;
    const result = await myProviders(token).catch(() => null);
    if (result !== null) {
      setProviders(Array.isArray(result) ? result : []);
      setProvidersLoaded(true);
    }
  }, [token, providersLoaded]);
  const loadReceive = useCallback(async (): Promise<void> => {
    if (!token) {
      setPayee([]);
      setPayouts(null);
      setRefunds([]);
      setRefundError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setRefundError(null);
    const [payeeResult, payoutResult, refundResult] = await Promise.allSettled([
      payeeBills(token),
      myPayouts(token),
      myRefunds(token),
    ]);
    if (payeeResult.status === "fulfilled") {
      setPayee(Array.isArray(payeeResult.value) ? payeeResult.value : []);
      setError(null);
    } else {
      setError(toMessage(payeeResult.reason));
    }
    setPayouts(payoutResult.status === "fulfilled" ? payoutResult.value : null);
    if (refundResult.status === "fulfilled") {
      setRefunds(Array.isArray(refundResult.value) ? refundResult.value : []);
    } else {
      setRefunds([]);
      setRefundError(toMessage(refundResult.reason));
    }
    receiveLoadedRef.current = true;
    setLoading(false);
  }, [token]);
  const operated = operatedKinds(providers);
  const hasProviderReceive = operated.shop || operated.tow ||
    payee.length > 0 || (payouts?.batches?.length ?? 0) > 0 ||
    (payouts?.requests?.length ?? 0) > 0;
  useEffect(() => {
    navigation.setOptions({title: t.payments.title});
  }, [navigation, t]);
  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);
  useEffect(() => {
    if (tab === "receive") void loadReceive();
  }, [tab, loadReceive]);
  useFocusEffect(useCallback(() => {
    if (tab === "pay") {
      void refreshRider();
    } else if (receiveLoadedRef.current) {
      void loadReceive();
    }
  }, [tab, refreshRider, loadReceive]));
  const reload = (): void => {
    if (tab === "pay") {
      void refreshRider();
    } else {
      void loadReceive();
    }
  };
  const pay = (bill: Bill): void => {
    setDetailFor({ticketId: bill.ticketId});
  };
  const receive = (bill: Bill): void => {
    setDetailFor({ticketId: bill.ticketId, scope: "payee"});
  };
  const openAccount = (): void => {
    const account = payouts?.account ?? null;
    setBankCode(account?.bankCode ?? "");
    setAccountNumber(account?.accountNumber ?? "");
    setHolderName(account?.holderName ?? "");
    setAccountError(null);
    setAccountOpen(true);
    if (banks.length === 0 && token) {
      void payoutBanks(token).then(setBanks).catch(() => undefined);
    }
  };
  const saveAccount = async (): Promise<void> => {
    if (!token || accountBusy) return;
    if (!bankCode || accountNumber.trim() === "" || holderName.trim() === "") {
      setAccountError(t.payments.invalidAccount);
      return;
    }
    setAccountBusy(true);
    setAccountError(null);
    try {
      await savePayoutAccount({bankCode, accountNumber: accountNumber.trim(), holderName: holderName.trim()}, token);
      setAccountOpen(false);
      setNotice(t.payments.accountSaved);
      await loadReceive();
    } catch (err) {
      setAccountError(toMessage(err));
    } finally {
      setAccountBusy(false);
    }
  };
  const submitWithdraw = async (): Promise<void> => {
    if (!token || withdrawBusy) return;
    const amount = Number.parseInt(withdrawAmount.replace(/[^0-9]/g, ""), 10);
    const available = payouts?.pending.available ?? 0;
    if (!Number.isFinite(amount) || amount <= 0 || amount > available) {
      setWithdrawError(t.payments.invalidAmount);
      return;
    }
    setWithdrawBusy(true);
    setWithdrawError(null);
    try {
      await requestPayout({amount}, token);
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setNotice(t.payments.requestSent);
      await loadReceive();
    } catch (err) {
      setWithdrawError(toMessage(err));
    } finally {
      setWithdrawBusy(false);
    }
  };
  const billByTicket = new Map(riderBills.map((bill) => [bill.ticketId, bill]));
  const visible = tab === "pay" ? riderBills : payee;
  const filtered = serviceFilter === "ALL" ?
    visible :
    visible.filter((bill) => billMatchesService(bill, serviceFilter));
  const filteredRefunds = refundsFor(refunds, billByTicket, serviceFilter);
  const payeeTotals = filtered.reduce(
    (sum, bill) => {
      const row = payeeSummary(bill);
      return {
        gross: sum.gross + bill.total,
        commission: sum.commission + row.commission,
        net: sum.net + row.net,
      };
    },
    {gross: 0, commission: 0, net: 0},
  );
  const refundTotal = filteredRefunds.reduce(
    (sum, refund) => sum + refund.amount, 0);
  const totals = totalsFor({
    tab,
    t,
    hasProvider: hasProviderReceive,
    filtered,
    payeeTotals,
    refunds: filteredRefunds,
  });
  const showPayoutHistory = tab === "receive" && hasProviderReceive &&
    payouts !== null;
  const visibleLoading = tab === "pay" ? riderLoading : loading;
  const visibleError = tab === "pay" ? (riderError ? t.payments.loadError : null) : error;
  const showEmpty = shouldShowEmpty({
    tab,
    loading: visibleLoading,
    error: visibleError ?? (tab === "receive" ? refundError : null),
    filtered,
    refunds: filteredRefunds,
    payouts,
  });
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
        {notice !== null ? (
          <Pressable style={[styles.notice, {borderColor: theme.primary}]} onPress={() => setNotice(null)} accessibilityRole="button">
            <Text style={{color: theme.primary, fontSize: 13}}>{notice}</Text>
          </Pressable>
        ) : null}
        <TabBar tab={tab} onSelect={setTab} t={t} theme={theme} />
        <ServiceFilterBar value={serviceFilter} onChange={setServiceFilter} t={t} theme={theme} />
        <TotalsRow totals={totals} theme={theme} />
        {visibleLoading && visible.length === 0 ? <ActivityIndicator style={styles.loader} color={theme.primary} /> : null}
        {visibleError ? (
          <View style={[styles.errorCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <Text style={[styles.errorText, {color: theme.danger}]}>{visibleError}</Text>
            <Pressable style={[styles.retryBtn, {borderColor: theme.primary}]} onPress={reload} accessibilityRole="button" accessibilityLabel={t.common.retry}>
              <Text style={{color: theme.primary}}>{t.common.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {showPayoutHistory && payouts ? (
          <PayoutHistory
            summary={payouts}
            t={t}
            theme={theme}
            highlightId={params.payoutId}
            onEditAccount={openAccount}
            onWithdraw={() => {
              setWithdrawAmount(String(payouts.pending.available ?? 0));
              setWithdrawError(null);
              setWithdrawOpen(true);
            }}
          />
        ) : null}
        {tab === "receive" && refundError ? (
          <View style={[styles.errorCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <Text style={[styles.errorText, {color: theme.danger}]}>{refundError}</Text>
            <Pressable style={[styles.retryBtn, {borderColor: theme.primary}]} onPress={reload} accessibilityRole="button" accessibilityLabel={t.common.retry}>
              <Text style={{color: theme.primary}}>{t.common.retry}</Text>
            </Pressable>
          </View>
        ) : null}
        {tab === "receive" ? (
          <RefundSection
            refunds={filteredRefunds}
            billByTicket={billByTicket}
            total={refundTotal}
            t={t}
            theme={theme}
            onOpen={setRefundFor}
          />
        ) : null}
        {showEmpty ? <EmptyState tab={tab} t={t} theme={theme} /> : null}
        {filtered.map((bill) => (
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
      {detailFor ? (
        <PaymentDetailSheet
          ticketId={detailFor.ticketId}
          {...(detailFor.scope === "payee" ? {scope: "payee" as const} : {})}
          onClose={() => setDetailFor(null)}
          onChanged={reload}
        />
      ) : null}
      {refundFor ? (
        <RefundDetailSheet
          refund={refundFor}
          t={t}
          theme={theme}
          onClose={() => setRefundFor(null)}
          onOpenPayment={() => {
            const ticketId = refundFor.ticketId;
            setRefundFor(null);
            setDetailFor({ticketId});
          }}
        />
      ) : null}
      <Overlay
        visible={accountOpen}
        variant="dialog"
        title={t.payments.payoutAccount}
        closeLabel={t.common.cancel}
        onClose={() => setAccountOpen(false)}
        actions={[{label: t.common.save, tone: "primary", busy: accountBusy, onPress: () => void saveAccount()}]}
      >
        {accountError ? <Text style={[styles.errorText, {color: theme.danger}]}>{accountError}</Text> : null}
        <Text style={[styles.fieldLabel, {color: theme.text}]}>{t.payments.bank}</Text>
        <View style={styles.bankWrap}>
          {banks.map((bank) => {
            const selected = bank.code === bankCode;
            return (
              <Pressable
                key={bank.code}
                style={[styles.bankChip, {borderColor: selected ? theme.primary : theme.border}, selected && {backgroundColor: `${theme.primary}22`}]}
                onPress={() => setBankCode(bank.code)}
                accessibilityRole="button"
                accessibilityState={{selected}}
              >
                <Text style={{color: selected ? theme.primary : theme.text, fontSize: 12}}>{bank.name}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={[styles.fieldLabel, {color: theme.text}]}>{t.payments.accountNumber}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={accountNumber}
          onChangeText={setAccountNumber}
          placeholder={t.payments.accountNumber}
          placeholderTextColor={theme.muted}
          keyboardType="number-pad"
        />
        <Text style={[styles.fieldLabel, {color: theme.text}]}>{t.payments.holderName}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={holderName}
          onChangeText={setHolderName}
          placeholder={t.payments.holderName}
          placeholderTextColor={theme.muted}
          autoCapitalize="characters"
        />
      </Overlay>
      <Overlay
        visible={withdrawOpen}
        variant="dialog"
        title={t.payments.withdraw}
        closeLabel={t.common.cancel}
        onClose={() => setWithdrawOpen(false)}
        actions={[{label: t.payments.withdraw, tone: "primary", busy: withdrawBusy, onPress: () => void submitWithdraw()}]}
      >
        {withdrawError ? <Text style={[styles.errorText, {color: theme.danger}]}>{withdrawError}</Text> : null}
        <Text style={[styles.fieldLabel, {color: theme.text}]}>{t.payments.withdrawAmount}</Text>
        <TextInput
          style={[styles.input, {borderColor: theme.border, color: theme.text}]}
          value={withdrawAmount}
          onChangeText={setWithdrawAmount}
          placeholder={t.payments.withdrawAmount}
          placeholderTextColor={theme.muted}
          keyboardType="number-pad"
        />
        <Text style={[styles.payoutMeta, {color: theme.muted}]}>{t.payments.withdrawHint}</Text>
      </Overlay>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12, flexGrow: 1},
  tabs: {borderWidth: 1, borderRadius: 16, padding: 4, flexDirection: "row", gap: 4},
  tab: {flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center"},
  tabText: {fontSize: 13, fontWeight: "700"},
  serviceFilters: {flexDirection: "row", gap: 8, justifyContent: "center"},
  serviceFilter: {width: 42, height: 42, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center"},
  filterTotals: {borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: "row"},
  filterTotalCell: {flex: 1, alignItems: "center", gap: 2},
  filterTotalLabel: {fontSize: 10, fontWeight: "600"},
  filterTotalValue: {fontSize: 12, fontWeight: "800"},
  sectionLabel: {fontSize: 15, fontWeight: "700", marginTop: 4},
  sectionHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  sectionAmount: {fontSize: 14, fontWeight: "800"},
  loader: {marginTop: 24},
  errorCard: {borderWidth: 1, borderRadius: 16, padding: 14, gap: 8},
  errorText: {fontSize: 13},
  retryBtn: {borderWidth: 1, borderRadius: 12, paddingVertical: 10, alignItems: "center"},
  emptyCard: {borderWidth: 1, borderRadius: 20, padding: 28, alignItems: "center", gap: 8, marginTop: 24},
  emptyTitle: {fontWeight: "700", fontSize: 16},
  emptyHint: {fontSize: 13, textAlign: "center"},
  payoutSection: {gap: 10},
  payoutSummary: {borderWidth: 1, borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center"},
  payoutSummaryCell: {flex: 1, gap: 4, alignItems: "center"},
  payoutSummaryLabel: {fontSize: 12, fontWeight: "600"},
  payoutSummaryValue: {fontSize: 14, fontWeight: "700"},
  payoutSummaryDivider: {width: 1, alignSelf: "stretch"},
  payoutEmpty: {fontSize: 13, paddingVertical: 6},
  payoutCard: {borderWidth: 1, borderRadius: 18, padding: 14, gap: 6},
  payoutHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
  payoutRef: {fontWeight: "700", fontSize: 14},
  payoutStatus: {fontSize: 11, fontWeight: "700"},
  payoutMeta: {fontSize: 12},
  payoutMoneyRow: {gap: 2},
  payoutNet: {fontSize: 13, fontWeight: "700"},
  accountCard: {borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: "row", alignItems: "center", gap: 10},
  accountText: {flex: 1, gap: 2},
  accountTitle: {fontSize: 14, fontWeight: "700"},
  smallBtn: {borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  withdrawBtn: {borderRadius: 14, paddingVertical: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8},
  withdrawText: {color: "#fff", fontWeight: "700", fontSize: 14},
  requestRow: {borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 10},
  notice: {borderWidth: 1, borderRadius: 10, padding: 10},
  fieldLabel: {fontSize: 13, fontWeight: "700", marginTop: 6},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  bankWrap: {flexDirection: "row", flexWrap: "wrap", gap: 6},
  bankChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
});
