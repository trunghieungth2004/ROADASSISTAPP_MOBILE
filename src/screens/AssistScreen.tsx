import {useCallback, useEffect, useRef, useState} from "react";
import {ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useFocusEffect, useNavigation} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {CameraRef} from "@maplibre/maplibre-react-native";
import {acceptTicket, cancelTicket, createTicket, getTicket, myTickets, nearTickets, updateTicketStatus, type DispatchTicket, type TicketType} from "../api/dispatch";
import {myProviders, nearProviders, pingProviderLocation, reportProvider, REPORT_REASONS, type Provider, type ReportReason} from "../api/providers";
import {findRoute, type RouteOption} from "../api/routes";
import {toMessage} from "../api/client";
import type {Place} from "../components/place-search/PlaceSearch.types";
import {PlaceSearchField, usePlaceSearch} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import Snack from "../components/Snack";
import Overlay from "../components/overlay/Overlay";
import StatusRow from "../components/StatusRow";
import {snackAboveTabs} from "../components/snackOffset";
import {Fab, FabColumn} from "../components/Fab";
import {formatPoint} from "../api/places";
import {ensurePushConfigured, subscribeDispatchPush} from "../services/push";
import {capturePosition, useLocationBeat} from "../services/locationBeats";
import {ticketTitle} from "./assist/ticketLabels";
import {boundsOf} from "./route/routeGeo";
import AssistMapView from "./assist/AssistMapView";
import {ticketById, toggleSelected} from "./assist/assistPick";
import {WALK_RADII, walkKm, walkMinutes} from "./assist/walkShop";

const ACTIVE_KEY = "roadassist.activeTicket";

export default function AssistScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {activeVehicle, bundle} = useProfile();
  const [ownProviders, setOwnProviders] = useState<Provider[]>([]);
  const provider = (bundle?.user.services ?? []).includes("VOLUNTEER") ||
    ownProviders.some((p) => p.kind === "TOW" && p.status === "ACTIVE");
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [active, setActive] = useState<DispatchTicket | null>(null);
  const [reportFor, setReportFor] = useState<{id: string; name: string} | null>(null);
  const [reportReason, setReportReason] = useState<ReportReason>("FAKE_BUSINESS");
  const [reportNote, setReportNote] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const towOnDuty = ownProviders.some((item) => item.kind === "TOW" && item.status === "ACTIVE" && item.accepting !== false && item.suspended !== true);
  useLocationBeat(!!token && towOnDuty, active ? 60 * 1000 : 5 * 60 * 1000, async () => {
    if (!token) return;
    const pos = await capturePosition();
    if (!pos) return;
    await pingProviderLocation(pos.lat, pos.lng, token);
  });
  async function onReport(): Promise<void> {
    if (!token || !reportFor || reportBusy) return;
    setReportBusy(true);
    setReportError(null);
    try {
      await reportProvider({providerId: reportFor.id, reason: reportReason, ...(reportNote.trim() ? {note: reportNote.trim()} : {})}, token);
      setReportFor(null);
      setReportNote("");
      setNotice(t.report.filed);
    } catch (err) {
      setReportError(toMessage(err));
    } finally {
      setReportBusy(false);
    }
  }
  const [radius, setRadius] = useState(1000);
  const [shops, setShops] = useState<Provider[]>([]);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopSel, setShopSel] = useState<Provider | null>(null);
  const [walkRoute, setWalkRoute] = useState<RouteOption | null>(null);
  const [walkBusy, setWalkBusy] = useState(false);
  const [reqBusy, setReqBusy] = useState(false);
  const [respBusy, setRespBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  const snackBottom = snackAboveTabs(insets.bottom);
  const selectedTicket = selectedId ? ticketById([...mine, ...nearby], selectedId) : null;
  const selectedIsMine = selectedTicket ? mine.some((item) => item.id === selectedTicket.id) : false;
  const mechanic = ticketType === "MECHANIC";
  function radiusLabel(r: number): string {
    if (r < 1000) return t.shop.radiusM.replace("{n}", String(r));
    return t.shop.radiusKm.replace("{n}", String(r / 1000));
  }
  function openBadge(shop: Provider): {label: string; color: string} {
    if (shop.openNow === true) return {label: t.shop.open, color: theme.primary};
    if (shop.openNow === false) return {label: t.shop.closed, color: theme.danger};
    return {label: t.shop.unknownHours, color: theme.muted};
  }
  function applyCenter(): boolean {
    const pending = pendingCenterRef.current;
    const cam = cameraRef.current;
    if (!pending || !cam) return false;
    pendingCenterRef.current = null;
    centeredRef.current = true;
    void cam.setStop({center: [pending.lng, pending.lat], zoom: 15, duration: 800});
    return true;
  }
  function fitWalk(route: RouteOption): void {
    const b = boundsOf(route.geometry.coordinates);
    if (b) void cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800});
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
      let fetched: Provider[] = [];
      try {
        fetched = await myProviders(token);
        setOwnProviders(fetched);
      } catch {
        setOwnProviders([]);
      }
      const gate = (bundle?.user.services ?? []).includes("VOLUNTEER") ||
        fetched.some((item) => item.kind === "TOW" && item.status === "ACTIVE");
      if (gate) {
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
  }, [token, bundle?.user.services, loadActive, t]);
  useFocusEffect(useCallback(() => {
    void reloadAll();
  }, [reloadAll]));
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
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedId) {
        setSelectedId(null);
        return true;
      }
      if (shopSel) {
        setShopSel(null);
        setWalkRoute(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selectedId, shopSel]);
  const loadShops = useCallback(async (): Promise<void> => {
    if (!token || !gps) {
      setShops([]);
      return;
    }
    setShopLoading(true);
    setError(null);
    try {
      setShops(await nearProviders(gps.lat, gps.lng, token, {radiusMeters: radius, kind: "SHOP", acceptingOnly: true}));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setShopLoading(false);
    }
  }, [token, gps, radius]);
  useEffect(() => {
    if (!mechanic) return;
    void loadShops();
  }, [mechanic, loadShops]);
  async function currentPoint(): Promise<{lat: number; lng: number}> {
    const {status} = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") throw new Error(t.nav.locationDenied);
    const pos = await Location.getCurrentPositionAsync({});
    return {lat: pos.coords.latitude, lng: pos.coords.longitude};
  }
  function onPickTicket(id: string): void {
    const next = toggleSelected(selectedId, id);
    setSelectedId(next);
    if (!next) return;
    const ticket = ticketById([...mine, ...nearby], id);
    if (ticket) void cameraRef.current?.setStop({center: [ticket.lng, ticket.lat], zoom: 15, duration: 600});
  }
  async function onPickShop(id: string): Promise<void> {
    const shop = shops.find((s) => s.id === id) ?? null;
    setShopSel(shop);
    setWalkRoute(null);
    if (!shop || !token) return;
    let origin = gps;
    if (!origin) {
      try {
        origin = await currentPoint();
        setGps(origin);
      } catch (err) {
        setError(toMessage(err));
        return;
      }
    }
    setWalkBusy(true);
    setError(null);
    try {
      const res = await findRoute({originLat: origin.lat, originLng: origin.lng, destLat: shop.lat, destLng: shop.lng, mode: "foot"}, token);
      const route = res.routes?.[0] ?? null;
      setWalkRoute(route);
      if (route) fitWalk(route);
      else void cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setWalkBusy(false);
    }
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
      const point = await currentPoint();
      await createTicket({ticketType, lat: point.lat, lng: point.lng, note: note.trim() || undefined, destinationPoint: ticketType === "TOW" && dest ? {lat: dest.lat, lng: dest.lng, label: dest.label} : undefined, vehicleType: activeVehicle?.type, vehicleWidth: activeVehicle?.baseWidth}, token);
      setNotice(t.assist.requested);
      setNote("");
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
        theme={theme}
        cameraRef={cameraRef}
        gps={gps}
        dest={ticketType === "TOW" && dest ? {lat: dest.lat, lng: dest.lng} : null}
        mine={mine}
        nearby={provider ? nearby : []}
        shops={mechanic ? shops : []}
        selectedShop={mechanic ? shopSel : null}
        walkRoute={mechanic ? walkRoute : null}
        onMapReady={() => applyCenter()}
        onPickTicket={onPickTicket}
        onPickShop={(id) => void onPickShop(id)}
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
              <Text style={[styles.cardTitle, {color: theme.text}]}>{ticketTitle(selectedTicket, t)}</Text>
              <Pressable onPress={() => setSelectedId(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.close}>
                <MaterialIcons name="close" size={18} color={theme.muted} />
              </Pressable>
            </View>
            {typeof selectedTicket.note === "string" && selectedTicket.note ? <Text style={{color: theme.text}}>{selectedTicket.note}</Text> : null}
            <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(selectedTicket.lat, selectedTicket.lng)}</Text>
            {typeof selectedTicket.towPlate === "string" && selectedTicket.towPlate ? (
              <Text style={[styles.coords, {color: theme.text}]}>{t.tow.plate}: {selectedTicket.towPlate}</Text>
            ) : null}
            {typeof selectedTicket.assignedShopId === "string" && selectedTicket.assignedShopId ? (
              <Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => { setReportReason("FAKE_BUSINESS"); setReportNote(""); setReportError(null); setReportFor({id: selectedTicket.assignedShopId as string, name: selectedTicket.towPlate ?? t.report.unknownProvider}); }} accessibilityRole="button" accessibilityLabel={t.report.title}>
                <Text style={{color: theme.primary}}>{t.report.title}</Text>
              </Pressable>
            ) : null}
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
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.bottomContainer}>
        <View onLayout={(e) => setCardH(e.nativeEvent.layout.height)} style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <ScrollView contentContainerStyle={styles.cardScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {active ? (
              <View style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: theme.primary}]}>
                <Text style={[styles.cardTitle, {color: theme.text}]}>{t.assist.activeJob} · {ticketTitle(active, t)}</Text>
                {typeof active.note === "string" && active.note ? <Text style={{color: theme.text}}>{active.note}</Text> : null}
                <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(active.lat, active.lng)}</Text>
                {typeof active.towPlate === "string" && active.towPlate ? (
                  <Text style={[styles.coords, {color: theme.text}]}>{t.tow.plate}: {active.towPlate}</Text>
                ) : null}
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
            <Text style={[styles.title, {color: theme.text}]}>{mechanic ? t.shop.title : t.assist.title}</Text>
            <View style={styles.row}>{(["SOS", "TOW", "MECHANIC"] as TicketType[]).map((kind) => (<Pressable key={kind} style={[styles.chip, {borderColor: theme.primary}, ticketType === kind && {backgroundColor: theme.primary}]} onPress={() => setTicketType(kind)}><Text style={{color: ticketType === kind ? "#fff" : theme.text}}>{kind === "SOS" ? t.assist.sos : kind === "TOW" ? t.assist.tow : t.assist.mechanic}</Text></Pressable>))}</View>
            {mechanic ? (
              <>
                <View style={styles.row}>
                  {WALK_RADII.map((r) => (
                    <Pressable key={r} style={[styles.chip, {borderColor: theme.primary}, radius === r && {backgroundColor: theme.primary}]} onPress={() => { setRadius(r); setShopSel(null); setWalkRoute(null); }} accessibilityRole="button">
                      <Text style={{color: radius === r ? "#fff" : theme.text}}>{radiusLabel(r)}</Text>
                    </Pressable>
                  ))}
                </View>
                {shopSel ? (
                  <View style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: theme.primary}]}>
                    <View style={styles.selectedRow}>
                      <Text style={[styles.cardTitle, {color: theme.text}]}>{shopSel.name}</Text>
                      <Pressable onPress={() => { setShopSel(null); setWalkRoute(null); }} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.shop.clearRoute}>
                        <MaterialIcons name="close" size={18} color={theme.muted} />
                      </Pressable>
                    </View>
                    {walkBusy ? (
                      <StatusRow theme={theme} text={t.common.loading} />
                    ) : walkRoute ? (
                      <Text style={[styles.coords, {color: theme.muted}]}>{t.shop.walkRoute} · {((walkRoute.distanceMeters ?? 0) / 1000).toFixed(1)} {t.route.km} · {Math.round((walkRoute.durationSeconds ?? 0) / 60)} {t.route.min}</Text>
                    ) : (
                      <Text style={[styles.coords, {color: theme.muted}]}>{t.shop.walkTo}</Text>
                    )}
                  </View>
                ) : null}
                <Text style={[styles.section, {color: theme.text}]}>{t.shop.nearby}</Text>
                {shopLoading ? (
                  <StatusRow theme={theme} text={t.shop.loading} />
                ) : shops.length === 0 ? (
                  <Text style={[styles.hint, {color: theme.muted}]}>{t.shop.empty}</Text>
                ) : (
                  shops.map((shop) => {
                    const badge = openBadge(shop);
                    const dist = typeof shop.distance === "number" ? shop.distance : null;
                    return (
                      <View key={shop.id} style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: shopSel?.id === shop.id ? theme.primary : theme.border}]}>
                        <Pressable onPress={() => void onPickShop(shop.id)} accessibilityRole="button">
                          <Text style={[styles.cardTitle, {color: theme.text}]}>{shop.name}</Text>
                        </Pressable>
                        <View style={styles.metaRow}>
                          {dist !== null ? <Text style={[styles.coords, {color: theme.muted}]}>{walkKm(dist)} {t.route.km} · {walkMinutes(dist)} {t.route.min}</Text> : null}
                          <Text style={[styles.badge, {color: badge.color}]}>{badge.label}</Text>
                        </View>
                        <View style={styles.actionRow}>
                          <Pressable style={[styles.actionBtn, styles.actionGrow, {backgroundColor: theme.primary}, walkBusy && styles.disabled]} disabled={walkBusy} onPress={() => void onPickShop(shop.id)} accessibilityRole="button" accessibilityLabel={t.shop.walkTo}>
                            <Text style={styles.actionText}>{t.shop.walkTo}</Text>
                          </Pressable>
                          <Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => { setReportReason("FAKE_BUSINESS"); setReportNote(""); setReportError(null); setReportFor({id: shop.id, name: shop.name}); }} accessibilityRole="button" accessibilityLabel={t.report.title}>
                            <MaterialIcons name="flag" size={18} color={theme.primary} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
            ) : (
              <>
                <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.assist.note} placeholderTextColor={theme.muted} value={note} onChangeText={setNote} />
                {ticketType === "TOW" ? <PlaceSearchField search={destSearch} placeholder={t.common.searchPlaceholder} noResultsText={t.common.noResults} groupLabels={{saved: t.route.savedPlaces, directory: t.route.directory, map: t.route.mapResults}} onSelect={setDest} /> : null}
                <Pressable style={[styles.primary, {backgroundColor: theme.primary}, reqBusy && styles.disabled]} disabled={reqBusy} onPress={() => void onRequest()} accessibilityRole="button" accessibilityLabel={t.assist.request}>{reqBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.assist.request}</Text>}</Pressable>
              </>
            )}
            <Text style={[styles.section, {color: theme.text}]}>{t.assist.myTickets}</Text>
            {loading && mine.length === 0 ? (
              <StatusRow theme={theme} text={t.common.loading} />
            ) : mine.length === 0 ? (
              <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.empty}</Text>
            ) : (
              mine.map((item) => (
                <View key={item.id} style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: selectedId === item.id ? theme.primary : theme.border}]}>
                  <Pressable onPress={() => onPickTicket(item.id)} accessibilityRole="button">
                    <Text style={[styles.cardTitle, {color: theme.text}]}>{ticketTitle(item, t)}</Text>
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
                        <Text style={[styles.cardTitle, {color: theme.text}]}>{ticketTitle(item, t)}</Text>
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
      <Overlay
        visible={reportFor !== null}
        variant="dialog"
        title={reportFor ? `${t.report.title} · ${reportFor.name}` : t.report.title}
        closeLabel={t.common.cancel}
        onClose={() => setReportFor(null)}
        actions={[{label: t.report.submit, tone: "primary", busy: reportBusy, onPress: () => void onReport()}]}
      >
        {reportError ? <Text style={[styles.hint, {color: theme.danger}]}>{reportError}</Text> : null}
        <View style={styles.row}>
          {REPORT_REASONS.map((reason) => (
            <Pressable key={reason} onPress={() => setReportReason(reason)} style={[styles.chip, {borderColor: theme.primary}, reportReason === reason && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{checked: reportReason === reason}}>
              <Text style={{color: reportReason === reason ? "#fff" : theme.text}}>{{FAKE_BUSINESS: t.report.reasonFakeBusiness, WRONG_LOCATION: t.report.reasonWrongLocation, UNSAFE: t.report.reasonUnsafe, HARASSMENT: t.report.reasonHarassment, SPAM: t.report.reasonSpam, OTHER: t.report.reasonOther}[reason]}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.report.notePlaceholder} placeholderTextColor={theme.muted} value={reportNote} onChangeText={setReportNote} maxLength={280} />
      </Overlay>
      {error ? (
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
  metaRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  badge: {fontSize: 12, fontWeight: "700"},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  actionGrow: {flex: 1},
  actionText: {color: "#fff", fontWeight: "700"},
  selectedWrap: {position: "absolute", left: 12, right: 12, zIndex: 10, elevation: 5},
  selectedCard: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
  selectedRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
});
