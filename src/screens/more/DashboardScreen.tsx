import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {AppText as Text} from "../../components/ui/AppText";
import ScreenContainer from "../../components/ui/ScreenContainer";
import {useAuth} from "../../context/AuthContext";
import {useProfile} from "../../context/ProfileContext";
import {useStrings} from "../../context/LanguageContext";
import {useThemeMode} from "../../context/ThemeContext";
import {themeForMode} from "../../theme";
import {toMessage} from "../../api/client";
import {myAnalytics, myAnalyticsDay, type MyAnalytics, type MyDayDetail, type MyDayTicket} from "../../api/analytics";
import {myProviders, type Provider} from "../../api/providers";
import {receivedRatings, type ReceivedRatings} from "../../api/ratings";
import {shopRequests} from "../../api/dispatch";
import {buildProviderDashboard, buildRiderDashboard} from "./dashboardData";
import DashboardView, {DashboardSkeleton} from "./DashboardView";
import DayDetailSheet, {DashboardTicketSheet, type DayTab} from "./DayDetailSheet";
import RangePickerSheet from "./RangePickerSheet";
import {profileServiceKinds} from "./providerUi";
import { formatDateDMY } from "../../utils/date";

type DashboardMode = "RIDER" | "PROVIDER";
type RangeState = {days?: number; startDate?: string; endDate?: string};

function dayKey(offsetDays = 0): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export default function DashboardScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const {bundle} = useProfile();
  const {mode: themeMode} = useThemeMode();
  const theme = themeForMode(themeMode);
  const navigation = useNavigation();
  const [mode, setMode] = useState<DashboardMode>("RIDER");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [received, setReceived] = useState<ReceivedRatings | null>(null);
  const [analytics, setAnalytics] = useState<MyAnalytics | null>(null);
  const [requests, setRequests] = useState(0);
  const [range, setRange] = useState<RangeState>({days: 30});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dayDate, setDayDate] = useState<string | null>(null);
  const [dayData, setDayData] = useState<MyDayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);
  const [dayTab, setDayTab] = useState<DayTab>("tickets");
  const [dayTicket, setDayTicket] = useState<MyDayTicket | null>(null);

  useEffect(() => {
    navigation.setOptions({title: t.more.dashboard});
  }, [navigation, t]);

  const services = bundle?.user.services ?? [];
  const providerKinds = profileServiceKinds(services, providers);
  const hasRiderRole = services.includes("RIDER");
  const canSwitch = hasRiderRole && providerKinds.length > 0;

  useEffect(() => {
    if (!hasRiderRole && providerKinds.length > 0) setMode("PROVIDER");
  }, [hasRiderRole, providerKinds.length]);

  const load = useCallback(async () => {
    if (!token) {
      setProviders([]);
      setReceived(null);
      setAnalytics(null);
      setRequests(0);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const providerRows = await myProviders(token).catch(() => []);
      const [ratingRows, analyticsRows, pendingRows] = await Promise.all([
        receivedRatings(token).catch(() => null),
        myAnalytics(token, range),
        Promise.all(providerRows
          .filter((item) => item.kind === "SHOP")
          .map((shop) => shopRequests(shop.id, token).catch(() => []))),
      ]);
      setProviders(providerRows);
      setReceived(ratingRows);
      setAnalytics(analyticsRows);
      setRequests(pendingRows.reduce((sum, rows) => sum + rows.length, 0));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  async function openDay(date: string): Promise<void> {
    if (!token) return;
    setDayDate(date);
    setDayTab("tickets");
    setDayData(null);
    setDayError(null);
    setDayTicket(null);
    setDayLoading(true);
    try {
      setDayData(await myAnalyticsDay(token, date, mode));
    } catch (err) {
      setDayError(toMessage(err));
    } finally {
      setDayLoading(false);
    }
  }

  function closeDay(): void {
    setDayDate(null);
    setDayData(null);
    setDayError(null);
    setDayTicket(null);
  }

  const startDate = analytics?.startDate ?? dayKey(-29);
  const endDate = analytics?.endDate ?? dayKey(0);
  const rider = analytics ? buildRiderDashboard({analytics, received, t}) : null;
  const provider = analytics ? buildProviderDashboard({analytics, requests, t}) : null;
  const selected = mode === "RIDER" ? rider : provider;
  const activeDays = typeof range.days === "number" ? range.days : null;
  const rangeLabel = activeDays === 7 ? t.more.dashboardLast7 :
    activeDays === 30 ? t.more.dashboardLast30 :
      activeDays === 90 ? t.more.dashboardLast90 :
        activeDays === 365 ? t.more.dashboardLast365 :
          `${formatDateDMY(startDate)} → ${formatDateDMY(endDate)}`;

  function applyRange(start: string, end: string): void {
    setRange({startDate: start, endDate: end});
    setPickerOpen(false);
  }

  return (
    <ScreenContainer>
      <ScrollView
        contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void load()}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        <View style={styles.scopeRow}>
          <Pressable
            style={[styles.scopePill, {borderColor: theme.border, backgroundColor: theme.paper}]}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t.more.dashboardRange}
          >
            <MaterialIcons name="date-range" size={18} color={theme.primary} />
            <Text style={[styles.scopeText, {color: theme.text}]}>{rangeLabel}</Text>
            <MaterialIcons name="expand-more" size={18} color={theme.muted} />
          </Pressable>
          <Pressable
            style={[styles.refreshBtn, {borderColor: theme.border, backgroundColor: theme.paper}]}
            onPress={() => void load()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={t.assist.refresh}
          >
            {loading ? (
              <ActivityIndicator color={theme.primary} />
            ) : (
              <MaterialIcons name="refresh" size={20} color={theme.primary} />
            )}
          </Pressable>
        </View>
        {analytics?.generatedAt ? (
          <Text style={[styles.updated, {color: theme.muted}]}>
            {`${t.more.dashboardLastUpdated} ${new Date(analytics.generatedAt).toLocaleTimeString()}`}
          </Text>
        ) : null}
        {canSwitch ? (
          <View style={[styles.switchRow, {borderColor: theme.border, backgroundColor: theme.paper}]}>
            <Pressable
              style={[styles.switchBtn, mode === "RIDER" && {backgroundColor: theme.primary}]}
              onPress={() => setMode("RIDER")}
              accessibilityRole="button"
              accessibilityLabel={t.more.dashboardRider}
              accessibilityState={{selected: mode === "RIDER"}}
            >
              <Text style={[styles.switchText, {color: mode === "RIDER" ? "#fff" : theme.muted}]}>{t.more.dashboardRider}</Text>
            </Pressable>
            <Pressable
              style={[styles.switchBtn, mode === "PROVIDER" && {backgroundColor: theme.success}]}
              onPress={() => setMode("PROVIDER")}
              accessibilityRole="button"
              accessibilityLabel={t.more.dashboardProvider}
              accessibilityState={{selected: mode === "PROVIDER"}}
            >
              <Text style={[styles.switchText, {color: mode === "PROVIDER" ? "#fff" : theme.muted}]}>{t.more.dashboardProvider}</Text>
            </Pressable>
          </View>
        ) : null}
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        {!selected && loading ? <DashboardSkeleton t={t} /> : null}
        {selected ? <DashboardView t={t} data={selected} onSelectDate={(date) => void openDay(date)} /> : null}
      </ScrollView>
      {pickerOpen ? (
        <RangePickerSheet
          t={t}
          startDate={startDate}
          endDate={endDate}
          onApply={applyRange}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
      {dayDate ? (
        <DayDetailSheet
          t={t}
          date={dayDate}
          data={dayData}
          loading={dayLoading}
          error={dayError}
          tab={dayTab}
          onTab={setDayTab}
          onOpenTicket={setDayTicket}
          onClose={closeDay}
        />
      ) : null}
      {dayTicket ? (
        <DashboardTicketSheet
          t={t}
          ticket={dayTicket}
          onClose={() => setDayTicket(null)}
        />
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 12, paddingBottom: 32},
  scopeRow: {flexDirection: "row", alignItems: "center", gap: 8},
  scopePill: {flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12},
  scopeText: {flex: 1, fontSize: 13, fontWeight: "700"},
  refreshBtn: {width: 44, height: 44, borderWidth: 1, borderRadius: 12, alignItems: "center", justifyContent: "center"},
  updated: {fontSize: 11, marginTop: -6},
  switchRow: {flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 6, gap: 6},
  switchBtn: {flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center"},
  switchText: {fontSize: 13, fontWeight: "700"},
  error: {fontSize: 12, lineHeight: 17},
});
