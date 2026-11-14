import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View} from "react-native";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import {AppText as Text} from "../../components/ui/AppText";
import ScreenContainer from "../../components/ui/ScreenContainer";
import {useAuth} from "../../context/AuthContext";
import {useProfile} from "../../context/ProfileContext";
import {useStrings} from "../../context/LanguageContext";
import {useThemeMode} from "../../context/ThemeContext";
import {useBills} from "../../context/BillsContext";
import {themeForMode} from "../../theme";
import {toMessage} from "../../api/client";
import {myProviders, providerStats as fetchProviderStats, type Provider, type ProviderStats} from "../../api/providers";
import {receivedRatings, type ReceivedRatings} from "../../api/ratings";
import {shopBookings, type Booking} from "../../api/bookings";
import {shopRequests, shopRecords, type DispatchTicket} from "../../api/dispatch";
import {buildProviderDashboard, buildRiderDashboard} from "./dashboardData";
import DashboardView from "./DashboardView";
import {profileServiceKinds} from "./providerUi";

type DashboardMode = "RIDER" | "PROVIDER";

export default function DashboardScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {bundle} = useProfile();
  const {mode: themeMode} = useThemeMode();
  const theme = themeForMode(themeMode);
  const navigation = useNavigation();
  const {bills, refresh: refreshBills} = useBills();
  const [mode, setMode] = useState<DashboardMode>("RIDER");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [received, setReceived] = useState<ReceivedRatings | null>(null);
  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [requests, setRequests] = useState(0);
  const [records, setRecords] = useState<DispatchTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setStats(null);
      setBookings([]);
      setRequests(0);
      setRecords([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const providerRows = await myProviders(token).catch(() => []);
      const [ratingRows, statRows, groups] = await Promise.all([
        receivedRatings(token).catch(() => null),
        fetchProviderStats(token).catch(() => null),
        Promise.all(providerRows
          .filter((item) => item.kind === "SHOP")
          .map(async (shop) => {
            const [pending, recent, bookingRows] = await Promise.all([
              shopRequests(shop.id, token).catch(() => []),
              shopRecords(shop.id, 50, token).catch(() => []),
              shopBookings(shop.id, token).then((row) => row.bookings).catch(() => []),
            ]);
            return {pending, recent, bookingRows};
          })),
      ]);
      setProviders(providerRows);
      setReceived(ratingRows);
      setStats(statRows);
      const bookingMap = new Map<string, Booking>();
      const recordMap = new Map<string, DispatchTicket>();
      let pending = 0;
      for (const group of groups) {
        pending += group.pending.length;
        for (const row of group.bookingRows) bookingMap.set(row.id, row);
        for (const row of group.recent) recordMap.set(row.id, row);
      }
      setRequests(pending);
      setBookings([...bookingMap.values()]);
      setRecords([...recordMap.values()]);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => {
    void refreshBills();
    void load();
  }, [load, refreshBills]));

  const rider = buildRiderDashboard({bills, received, t, lang});
  const provider = buildProviderDashboard({stats, bookings, requests, records, t, lang});
  const selected = mode === "RIDER" ? rider : provider;

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.scroll, {backgroundColor: theme.background}]}>
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
        <Text style={[styles.summary, {color: theme.muted}]}>{selected.summary}</Text>
        {loading ? <ActivityIndicator color={theme.primary} /> : null}
        {error ? <Text style={[styles.summary, {color: theme.danger}]}>{error}</Text> : null}
        <DashboardView t={t} data={selected.data} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scroll: {padding: 16, gap: 16, paddingBottom: 32},
  switchRow: {flexDirection: "row", borderWidth: 1, borderRadius: 14, padding: 6, gap: 6},
  switchBtn: {flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: "center"},
  switchText: {fontSize: 13, fontWeight: "700"},
  summary: {fontSize: 12, lineHeight: 17},
});
