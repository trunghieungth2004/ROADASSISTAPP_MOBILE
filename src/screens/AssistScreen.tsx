import {useCallback, useEffect, useRef, useState} from "react";
import {ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useNavigation} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {CameraRef} from "@maplibre/maplibre-react-native";
import {acceptTicket, cancelTicket, createTicket, getTicket, myTickets, nearTickets, updateTicketStatus, type DispatchTicket, type TicketType} from "../api/dispatch";
import {toMessage} from "../api/client";
import type {Place} from "../components/place-search/PlaceSearch.types";
import {PlaceSearchField, usePlaceSearch} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import Snack from "../components/Snack";
import StatusRow from "../components/StatusRow";
import {snackAbove} from "../components/snackOffset";
import {Fab, FabColumn} from "../components/Fab";
import {formatPoint, reverseLabel} from "../api/places";
import {ensurePushConfigured, subscribeDispatchPush} from "../services/push";
import {hasProviderLicense} from "../services/licenses";
import {createTaskEpoch, type TaskEpoch} from "./route/taskEpoch";
import AssistMapView from "./assist/AssistMapView";
import {coordOf, ticketById, toggleSelected} from "./assist/assistPick";

const ACTIVE_KEY = "roadassist.activeTicket";

export default function AssistScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {activeVehicle, bundle} = useProfile();
  const provider = hasProviderLicense(bundle?.user.services);
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const cameraRef = useRef<CameraRef | null>(null);
  const centeredRef = useRef(false);
  const pendingCenterRef = useRef<{lat: number; lng: number} | null>(null);
  const destSearch = usePlaceSearch({token: token ?? undefined, lang});
  const [ticketType, setTicketType] = useState<TicketType>("SOS");
  const [note, setNote] = useState("");
  const [dest, setDest] = useState<Place | null>(null);
  const [mine, setMine] = useState<DispatchTicket[]>([]);
  const [nearby, setNearby] = useState<DispatchTicket[]>([]);
  const [gps, setGps] = useState<{lat: number; lng: number} | null>(null);
  const [at, setAt] = useState<{lat: number; lng: number} | null>(null);
  const [atLabel, setAtLabel] = useState("");
  const [picking, setPicking] = useState(false);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickEpoch] = useState<TaskEpoch>(createTaskEpoch);
  const pickAbortRef = useRef<AbortController | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<DispatchTicket | null>(null);
  const [reqBusy, setReqBusy] = useState(false);
  const [respBusy, setRespBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  const snackBottom = cardH > 0 ? snackAbove(12, cardH) : insets.bottom + 24;
  const selectedTicket = selectedId ? ticketById([...mine, ...nearby], selectedId) : null;
  const selectedIsMine = selectedTicket ? mine.some((item) => item.id === selectedTicket.id) : false;
  function applyCenter(): boolean {
    const pending = pendingCenterRef.current;
    const cam = cameraRef.current;
    if (!pending || !cam) return false;
    pendingCenterRef.current = null;
    centeredRef.current = true;
    void cam.setStop({center: [pending.lng, pending.lat], zoom: 15, duration: 800});
    return true;
  }
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
  const reloadAll = useCallback(async (): Promise<void> => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const perm = await Location.getForegroundPermissionsAsync();
      const granted = perm.status === "granted";
      let pos: {lat: number; lng: number} | null = null;
      if (granted) {
        try {
          const live = await Location.getCurrentPositionAsync({});
          pos = {lat: live.coords.latitude, lng: live.coords.longitude};
          setGps(pos);
          if (!centeredRef.current) {
            pendingCenterRef.current = pos;
            applyCenter();
          }
        } catch {
          pos = null;
        }
      }
      setMine(await myTickets(token));
      if (provider) {
        if (!granted) throw new Error(t.nav.locationDenied);
        if (pos) {
          setNearby(await nearTickets(pos.lat, pos.lng, token));
        } else {
          setNearby([]);
        }
      } else {
        setNearby([]);
      }
      const saved = await AsyncStorage.getItem(ACTIVE_KEY).catch(() => null);
      await loadActive(saved, token);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, provider, loadActive, t]);
  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);
  useEffect(() => {
    ensurePushConfigured();
    return subscribeDispatchPush((data) => {
      void reloadAll();
      if (data.status && token) void loadActive(data.ticketId, token);
    }, "assist");
  }, [reloadAll, loadActive, token]);
  useEffect(() => {
    navigation.setOptions({headerShown: false});
    return () => {
      navigation.setOptions({headerShown: true});
    };
  }, [navigation]);
  function cancelPick(): void {
    pickEpoch.invalidate();
    pickAbortRef.current?.abort();
    pickAbortRef.current = null;
    setPickBusy(false);
    setPicking(false);
  }
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (picking) {
        cancelPick();
        return true;
      }
      if (selectedId) {
        setSelectedId(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [picking, selectedId]);
  useEffect(() => {
    return () => {
      pickEpoch.invalidate();
      pickAbortRef.current?.abort();
      pickAbortRef.current = null;
    };
  }, [pickEpoch]);
  async function currentPoint(): Promise<{lat: number; lng: number}> {
    const {status} = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") throw new Error(t.nav.locationDenied);
    const pos = await Location.getCurrentPositionAsync({});
    return {lat: pos.coords.latitude, lng: pos.coords.longitude};
  }
  async function useGpsPoint(): Promise<void> {
    if (gpsBusy) return;
    setGpsBusy(true);
    setError(null);
    try {
      const p = await currentPoint();
      setGps(p);
      setAt(p);
      setAtLabel(await reverseLabel(p.lat, p.lng, lang));
      void cameraRef.current?.setStop({center: [p.lng, p.lat], zoom: 15, duration: 600});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setGpsBusy(false);
    }
  }
  async function onMapPress(e: unknown): Promise<void> {
    if (!picking || pickAbortRef.current) return;
    const c = coordOf(e);
    if (!c) return;
    Keyboard.dismiss();
    const ctrl = new AbortController();
    pickAbortRef.current = ctrl;
    const id = pickEpoch.claim();
    setPickBusy(true);
    try {
      const label = await reverseLabel(c.lat, c.lng, lang, ctrl.signal);
      if (!pickEpoch.current(id)) return;
      setAt({lat: c.lat, lng: c.lng});
      setAtLabel(label);
    } catch (err) {
      if (!pickEpoch.current(id)) return;
      setError(toMessage(err));
    } finally {
      if (pickAbortRef.current === ctrl) pickAbortRef.current = null;
      if (pickEpoch.current(id)) {
        setPickBusy(false);
        setPicking(false);
      }
    }
  }
  function onPickTicket(id: string): void {
    const next = toggleSelected(selectedId, id);
    setSelectedId(next);
    if (!next) return;
    const ticket = ticketById([...mine, ...nearby], id);
    if (ticket) void cameraRef.current?.setStop({center: [ticket.lng, ticket.lat], zoom: 15, duration: 600});
  }
  async function onRequest(): Promise<void> {
    if (!token) return;
    if (ticketType === "TOW" && !dest) {
      setError(t.assist.towNeedsDest);
      return;
    }
    setReqBusy(true);
    setError(null);
    setNotice(null);
    try {
      Keyboard.dismiss();
      const point = at ?? await currentPoint();
      await createTicket({ticketType, lat: point.lat, lng: point.lng, note: note.trim() || undefined, destinationPoint: ticketType === "TOW" && dest ? {lat: dest.lat, lng: dest.lng, label: dest.label} : undefined, vehicleType: activeVehicle?.type, vehicleWidth: activeVehicle?.baseWidth}, token);
      setNotice(t.assist.requested);
      setNote("");
      setAt(null);
      setAtLabel("");
      setPicking(false);
      setDest(null);
      destSearch.clear();
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setReqBusy(false);
    }
  }
  async function onCancel(id: string): Promise<void> {
    if (!token) return;
    try {
      await cancelTicket(id, token);
      if (selectedId === id) setSelectedId(null);
      setNotice(t.assist.cancelled);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    }
  }
  async function onAccept(id: string): Promise<void> {
    if (!token || respBusy) return;
    setRespBusy(true);
    setError(null);
    try {
      await acceptTicket(id, token);
      await AsyncStorage.setItem(ACTIVE_KEY, id).catch(() => undefined);
      setNotice(t.assist.accepted);
      setActive(await getTicket(id, token));
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRespBusy(false);
    }
  }
  async function onStatus(status: string): Promise<void> {
    if (!token || !active || respBusy) return;
    setRespBusy(true);
    setError(null);
    try {
      await updateTicketStatus(active.id, status, token);
      if (status === "4") {
        await AsyncStorage.removeItem(ACTIVE_KEY).catch(() => undefined);
        setActive(null);
      } else {
        setActive(await getTicket(active.id, token));
      }
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRespBusy(false);
    }
  }
  async function onLocate(): Promise<void> {
    try {
      const p = await currentPoint();
      setGps(p);
      void cameraRef.current?.setStop({center: [p.lng, p.lat], zoom: 15, duration: 600});
    } catch (err) {
      setError(toMessage(err));
    }
  }
  return (
    <View style={styles.root}>
      <AssistMapView
        t={t}
        lang={lang}
        theme={theme}
        cameraRef={cameraRef}
        gps={gps}
        at={at}
        dest={dest ? {lat: dest.lat, lng: dest.lng} : null}
        mine={mine}
        nearby={provider ? nearby : []}
        picking={picking}
        pickBusy={pickBusy}
        onMapPress={(e) => void onMapPress(e)}
        onMapReady={() => applyCenter()}
        onPickTicket={onPickTicket}
        onCancelPick={cancelPick}
      />
      <FabColumn bottom={cardH + 92}>
        <Fab theme={theme} label={t.common.currentLocation} onPress={() => void onLocate()}>
          <MaterialIcons name="my-location" size={22} color={theme.primary} />
        </Fab>
        <Fab theme={theme} label={t.assist.refresh} onPress={() => void reloadAll()}>
          <MaterialIcons name="refresh" size={22} color={theme.primary} />
        </Fab>
      </FabColumn>
      {selectedTicket ? (
        <View style={[styles.selectedWrap, {bottom: cardH + 24}]} pointerEvents="box-none">
          <View style={[styles.selectedCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
            <View style={styles.selectedRow}>
              <Text style={[styles.cardTitle, {color: theme.text}]}>{selectedTicket.ticketType} · {selectedTicket.status}</Text>
              <Pressable onPress={() => setSelectedId(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.close}>
                <MaterialIcons name="close" size={18} color={theme.muted} />
              </Pressable>
            </View>
            {typeof selectedTicket.note === "string" && selectedTicket.note ? <Text style={{color: theme.text}}>{selectedTicket.note}</Text> : null}
            <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(selectedTicket.lat, selectedTicket.lng)}</Text>
            {selectedIsMine ? (
              selectedTicket.status === "1" || selectedTicket.status === "2" ? (
                <Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => void onCancel(selectedTicket.id)} accessibilityRole="button" accessibilityLabel={t.assist.cancel}>
                  <Text style={{color: theme.primary}}>{t.assist.cancel}</Text>
                </Pressable>
              ) : null
            ) : (
              <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, (respBusy || !!active) && styles.disabled]} disabled={respBusy || !!active} onPress={() => void onAccept(selectedTicket.id)} accessibilityRole="button" accessibilityLabel={t.assist.accept}>
                <Text style={styles.actionText}>{t.assist.accept}</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : null}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.bottomContainer}>
        <View onLayout={(e) => setCardH(e.nativeEvent.layout.height)} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <ScrollView contentContainerStyle={styles.cardScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {active ? (
              <View style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: theme.primary}]}>
                <Text style={[styles.cardTitle, {color: theme.text}]}>{t.assist.activeJob} · {active.ticketType} · {active.status}</Text>
                {typeof active.note === "string" && active.note ? <Text style={{color: theme.text}}>{active.note}</Text> : null}
                <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(active.lat, active.lng)}</Text>
                <View style={styles.actionRow}>
                  {active.status === "2" ? (
                    <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, respBusy && styles.disabled]} disabled={respBusy} onPress={() => void onStatus("3")} accessibilityRole="button" accessibilityLabel={t.assist.arrived}>
                      <Text style={styles.actionText}>{t.assist.arrived}</Text>
                    </Pressable>
                  ) : null}
                  <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, respBusy && styles.disabled]} disabled={respBusy} onPress={() => void onStatus("4")} accessibilityRole="button" accessibilityLabel={t.assist.resolved}>
                    <Text style={styles.actionText}>{t.assist.resolved}</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            <Text style={[styles.title, {color: theme.text}]}>{t.assist.title}</Text>
            <View style={styles.row}>{(["SOS", "TOW", "MECHANIC"] as TicketType[]).map((kind) => (<Pressable key={kind} style={[styles.chip, {borderColor: theme.primary}, ticketType === kind && {backgroundColor: theme.primary}]} onPress={() => setTicketType(kind)}><Text style={{color: ticketType === kind ? "#fff" : theme.text}}>{kind === "SOS" ? t.assist.sos : kind === "TOW" ? t.assist.tow : t.assist.mechanic}</Text></Pressable>))}</View>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.assist.note} placeholderTextColor={theme.muted} value={note} onChangeText={setNote} />
            {ticketType === "TOW" ? <PlaceSearchField search={destSearch} placeholder={t.common.searchPlaceholder} noResultsText={t.common.noResults} onSelect={setDest} /> : null}
            <View style={styles.row}>
              <Pressable style={[styles.chip, {borderColor: theme.primary}, gpsBusy && styles.disabled]} disabled={gpsBusy} onPress={() => void useGpsPoint()} accessibilityRole="button" accessibilityLabel={t.assist.useGps}>
                <Text style={{color: theme.primary}}>{t.assist.useGps}</Text>
              </Pressable>
              <Pressable style={[styles.chip, {borderColor: theme.primary}, picking && {backgroundColor: theme.primary}]} onPress={() => (picking ? cancelPick() : (Keyboard.dismiss(), setSelectedId(null), setPicking(true)))} accessibilityRole="button" accessibilityLabel={t.assist.pickLocation}>
                <Text style={{color: picking ? "#fff" : theme.primary}}>{t.assist.pickLocation}</Text>
              </Pressable>
              {at ? (
                <Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => { setAt(null); setAtLabel(""); }} accessibilityRole="button" accessibilityLabel={t.assist.clearPoint}>
                  <Text style={{color: theme.muted}}>{t.assist.clearPoint}</Text>
                </Pressable>
              ) : null}
            </View>
            {at ? <Text style={[styles.coords, {color: theme.muted}]}>{atLabel || formatPoint(at.lat, at.lng)}</Text> : null}
            <Pressable style={[styles.primary, {backgroundColor: theme.primary}, reqBusy && styles.disabled]} disabled={reqBusy} onPress={() => void onRequest()} accessibilityRole="button" accessibilityLabel={t.assist.request}>{reqBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.assist.request}</Text>}</Pressable>
            <Text style={[styles.section, {color: theme.text}]}>{t.assist.myTickets}</Text>
            {loading && mine.length === 0 ? (
              <StatusRow theme={theme} text={t.common.loading} />
            ) : mine.length === 0 ? (
              <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.empty}</Text>
            ) : (
              mine.map((item) => (
                <View key={item.id} style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: selectedId === item.id ? theme.primary : theme.border}]}>
                  <Pressable onPress={() => onPickTicket(item.id)} accessibilityRole="button">
                    <Text style={[styles.cardTitle, {color: theme.text}]}>{item.ticketType} · {item.status}</Text>
                  </Pressable>
                  {typeof item.note === "string" && item.note ? <Text style={{color: theme.text}}>{item.note}</Text> : null}
                  {item.status === "1" || item.status === "2" ? (
                    <Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => void onCancel(item.id)} accessibilityRole="button" accessibilityLabel={t.assist.cancel}>
                      <Text style={{color: theme.primary}}>{t.assist.cancel}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
            {provider ? (
              <>
                <Text style={[styles.section, {color: theme.text}]}>{t.assist.nearby}</Text>
                {loading && nearby.length === 0 ? (
                  <StatusRow theme={theme} text={t.common.loading} />
                ) : nearby.length === 0 ? (
                  <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.noNearby}</Text>
                ) : (
                  nearby.map((item) => (
                    <View key={item.id} style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: selectedId === item.id ? theme.primary : theme.border}]}>
                      <Pressable onPress={() => onPickTicket(item.id)} accessibilityRole="button">
                        <Text style={[styles.cardTitle, {color: theme.text}]}>{item.ticketType} · {item.status}</Text>
                      </Pressable>
                      {typeof item.note === "string" && item.note ? <Text style={{color: theme.text}}>{item.note}</Text> : null}
                      <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(item.lat, item.lng)}</Text>
                      <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, (respBusy || !!active) && styles.disabled]} disabled={respBusy || !!active} onPress={() => void onAccept(item.id)} accessibilityRole="button" accessibilityLabel={t.assist.accept}>
                        <Text style={styles.actionText}>{t.assist.accept}</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
      {picking ? (
        <Snack message={t.assist.tapToSet} sticky bottom={snackBottom} accentColor={theme.primary} onHide={() => {}} />
      ) : error ? (
        <Snack message={error} severity="error" sticky bottom={snackBottom} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  bottomContainer: {position: "absolute", left: 12, right: 12, bottom: 12},
  card: {width: "100%", borderWidth: 1, borderRadius: 16, padding: 12, maxHeight: 420, overflow: "hidden"},
  cardScroll: {gap: 8, paddingBottom: 4},
  title: {fontSize: 20, fontWeight: "700"},
  section: {fontSize: 16, fontWeight: "700", marginTop: 8},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6},
  activeCard: {borderWidth: 2},
  cardTitle: {fontWeight: "700"},
  coords: {fontSize: 12},
  hint: {fontSize: 12},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  selectedWrap: {position: "absolute", left: 12, right: 12, zIndex: 10, elevation: 5},
  selectedCard: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
  selectedRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
});
