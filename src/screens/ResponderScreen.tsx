import {useCallback, useEffect, useState} from "react";
import {FlatList, Pressable, RefreshControl, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {acceptTicket, getTicket, nearTickets, updateTicketStatus, type DispatchTicket} from "../api/dispatch";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
import Snack from "../components/Snack";
import StatusRow from "../components/StatusRow";
import {snackAbove} from "../components/snackOffset";
import {formatPoint} from "../api/places";
import {ensurePushConfigured, subscribeDispatchPush, type DispatchPushData} from "../services/push";

const ACTIVE_KEY = "roadassist.activeTicket";

export default function ResponderScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [tickets, setTickets] = useState<DispatchTicket[]>([]);
  const [active, setActive] = useState<DispatchTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const loadActive = useCallback(async (id: string | null, key: string | null): Promise<void> => {
    if (!key || !id) {
      setActive(null);
      return;
    }
    try {
      const ticket = await getTicket(id, key);
      if (ticket.status === "2" || ticket.status === "3") {
        setActive(ticket);
      } else {
        setActive(null);
        await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => undefined);
      }
    } catch {
      setActive(null);
    }
  }, []);
  const reload = useCallback(
    async (mode: "initial" | "refresh" = "initial"): Promise<void> => {
      if (!token) return;
      if (mode === "initial") setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const {status} = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") throw new Error(t.nav.locationDenied);
        const pos = await Location.getCurrentPositionAsync({});
        setTickets(await nearTickets(pos.coords.latitude, pos.coords.longitude, token));
        const saved = await AsyncStorage.getItem(ACTIVE_KEY).catch(() => null);
        await loadActive(saved, token);
      } catch (err) {
        setError(toMessage(err));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [token, loadActive, t],
  );
  useEffect(() => {
    void reload();
  }, [reload]);
  useEffect(() => {
    ensurePushConfigured();
    return subscribeDispatchPush((data: DispatchPushData) => {
      if (!token) return;
      if (data.status) void loadActive(data.ticketId, token);
      else void reload("refresh");
    }, "responder");
  }, [token, reload, loadActive]);
  async function onAccept(id: string): Promise<void> {
    if (!token || busy) return;
    setBusy(true);
    setError(null);
    try {
      await acceptTicket(id, token);
      await AsyncStorage.setItem(ACTIVE_KEY, id).catch(() => undefined);
      setNotice(t.assist.accepted);
      setActive(await getTicket(id, token));
      await reload("refresh");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function onStatus(status: string): Promise<void> {
    if (!token || !active || busy) return;
    setBusy(true);
    setError(null);
    try {
      await updateTicketStatus(active.id, status, token);
      if (status === "4") {
        await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => undefined);
        setActive(null);
      } else {
        setActive(await getTicket(active.id, token));
      }
      await reload("refresh");
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScreenContainer>
      <View style={styles.root}>
        <Text style={[styles.title, {color: theme.text}]}>{t.assist.nearby}</Text>
        {active ? (
          <View style={[styles.card, styles.activeCard, {backgroundColor: theme.paper, borderColor: theme.primary}]}>
            <Text style={[styles.cardTitle, {color: theme.text}]}>
              {t.assist.activeJob} · {active.ticketType} · {active.status}
            </Text>
            {typeof active.note === "string" && active.note ? <Text style={{color: theme.text}}>{active.note}</Text> : null}
            <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(active.lat, active.lng)}</Text>
            <View style={styles.actionRow}>
              {active.status === "2" ? (
                <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onStatus("3")} accessibilityRole="button" accessibilityLabel={t.assist.arrived}>
                  <Text style={styles.actionText}>{t.assist.arrived}</Text>
                </Pressable>
              ) : null}
              <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onStatus("4")} accessibilityRole="button" accessibilityLabel={t.assist.resolved}>
                <Text style={styles.actionText}>{t.assist.resolved}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {loading ? (
          <StatusRow theme={theme} text={t.common.loading} />
        ) : (
          <FlatList
            data={tickets}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void reload("refresh")} tintColor={theme.primary} />}
            ListEmptyComponent={<Text style={[styles.hint, {color: theme.muted}]}>{t.assist.noNearby}</Text>}
            renderItem={({item}) => (
              <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
                <Text style={[styles.cardTitle, {color: theme.text}]}>
                  {item.ticketType} · {item.status}
                </Text>
                {typeof item.note === "string" && item.note ? <Text style={{color: theme.text}}>{item.note}</Text> : null}
                <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(item.lat, item.lng)}</Text>
                <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, (busy || !!active) && styles.disabled]} disabled={busy || !!active} onPress={() => void onAccept(item.id)} accessibilityRole="button" accessibilityLabel={t.assist.accept}>
                  <Text style={styles.actionText}>{t.assist.accept}</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </View>
      {error ? (
        <Snack message={error} severity="error" sticky bottom={snackAbove(insets.bottom, 24)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackAbove(insets.bottom, 24)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, padding: 16, gap: 12},
  title: {fontSize: 20, fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
  activeCard: {borderWidth: 2},
  cardTitle: {fontWeight: "700"},
  coords: {fontSize: 12},
  hint: {fontSize: 12, textAlign: "center", marginTop: 24},
  list: {gap: 8, paddingBottom: 8},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
