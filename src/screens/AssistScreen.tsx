import {useCallback, useEffect, useRef, useState} from "react";
import {ActivityIndicator, BackHandler, Keyboard, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useFocusEffect, useIsFocused, useNavigation} from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type {CameraRef} from "@maplibre/maplibre-react-native";
import {acceptTicket, cancelTicket, createTicket, declineTicket, feedTickets, getTicket, myTickets, nearTickets, riderActionsFor, updateTicketStatus, updateWorkOrder, type DeclineReason, type DispatchTicket, type FeedTicket, type TicketType} from "../api/dispatch";
import {myProviders, nearProviders, pingProviderLocation, reportProvider, searchProviders, REPORT_REASONS, type Provider, type ReportReason} from "../api/providers";
import {ratingsByTicket, replyRating, submitRating, type UserRating} from "../api/ratings";
import {findRoute, type RouteOption} from "../api/routes";
import {toMessage, ApiError} from "../api/client";
import type {Place} from "../components/place-search/PlaceSearch.types";
import {PlaceSearchField, usePlaceSearch} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useNavSession} from "../context/NavSessionContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import Snack from "../components/ui/Snack";
import Overlay from "../components/overlay/Overlay";
import StatusRow from "../components/ui/StatusRow";
import {snackBottom} from "../components/ui/snackOffset";
import {Fab, FabColumn} from "../components/ui/Fab";
import {formatPoint} from "../api/places";
import {ensurePushConfigured, drainDispatchLaunch, subscribeDispatchPush} from "../services/push";
import {capturePosition, useLocationBeat} from "../services/locationBeats";
import {getFix} from "../services/geo";
import {ticketTitle} from "./assist/ticketLabels";
import {vehicleClassOf} from "./assist/vehicleClass";
import AssistSectionTabs, {type AssistSection} from "./assist/AssistSectionTabs";
import StatusStepper from "./assist/StatusStepper";
import RequestSection from "./assist/RequestSection";
import ShopsSection from "./assist/ShopsSection";
import RecordsSection, {type WorkPatch} from "./assist/RecordsSection";
import RatingSheet from "./assist/RatingSheet";
import {boundsOf} from "./route/routeGeo";
import AssistMapView from "./assist/AssistMapView";
import {ticketById, toggleSelected} from "./assist/assistPick";
import ShopDetailSheet from "./assist/ShopDetailSheet";
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
  const [feed, setFeed] = useState<FeedTicket[]>([]);
  const [ticketRatings, setTicketRatings] = useState<Record<string, UserRating[]>>({});
  const [recBusy, setRecBusy] = useState(false);
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
  const assistFocused = useIsFocused();
  useLocationBeat(!!token && towOnDuty && assistFocused, active ? 60 * 1000 : 5 * 60 * 1000, async () => {
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
  const [shopSheet, setShopSheet] = useState<Provider | null>(null);
  const [walkRoute, setWalkRoute] = useState<RouteOption | null>(null);
  const [walkBusy, setWalkBusy] = useState(false);
  const [navBusy, setNavBusy] = useState(false);
  const {start: startNavSession} = useNavSession();
  const [reqBusy, setReqBusy] = useState(false);
  const [respBusy, setRespBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locateBusy, setLocateBusy] = useState(false);
  const [section, setSection] = useState<AssistSection>("request");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Provider[]>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [imHereBusy, setImHereBusy] = useState(false);
  const [ratingFor, setRatingFor] = useState<DispatchTicket | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingRider, setRatingRider] = useState(false);
  const [ratedScores, setRatedScores] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cardH, setCardH] = useState(0);
  const selectedTicket = selectedId ? ticketById([...mine, ...nearby, ...feed], selectedId) : null;
  const selectedIsMine = selectedTicket ? mine.some((item) => item.id === selectedTicket.id) : false;
  const vehicleClass = vehicleClassOf(activeVehicle?.type);
  const showShops = vehicleClass !== "CAR";
  function cycleRadius(): void {
    const at = WALK_RADII.indexOf(radius);
    const next = WALK_RADII[(at + 1) % WALK_RADII.length] ?? radius;
    setRadius(next);
    setShopSel(null);
    setWalkRoute(null);
  }
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
      if (ticket.status === "2" || ticket.status === "3" || ticket.status === "6" || ticket.status === "7") {
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
          pos = await getFix();
          setGps(pos);
          if (!centeredRef.current) {
            pendingCenterRef.current = pos;
            applyCenter();
          }
        } catch {
          pos = null;
        }
      }
      const [mineList, fetched, feedList] = await Promise.all([
        myTickets(token),
        myProviders(token).catch((): Provider[] => []),
        feedTickets(undefined, token).catch((): FeedTicket[] => []),
      ]);
      setMine(mineList);
      setFeed(feedList);
      setOwnProviders(fetched);
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
    const applyLaunch = (data: {ticketId: string; ticketType?: string; status?: string} | null): void => {
      if (!data) return;
      void reloadAll();
      if (data.status && token) void loadActive(data.ticketId, token);
      if (data.ticketType === "WALK_IN") setSection("records");
    };
    void drainDispatchLaunch().then(applyLaunch);
    return subscribeDispatchPush((data) => {
      applyLaunch(data);
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
      if (shopSheet) {
        setShopSheet(null);
        return true;
      }
      if (shopSel) {
        setShopSel(null);
        setWalkRoute(null);
        return true;
      }
      if (section !== "request") {
        setSection("request");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [selectedId, shopSheet, shopSel, section]);
  const loadShops = useCallback(async (): Promise<void> => {
    if (!token || !gps) {
      setShops([]);
      return;
    }
    setShopLoading(true);
    setError(null);
    try {
      setShops(await nearProviders(gps.lat, gps.lng, token, {radiusMeters: radius, kind: "SHOP", acceptingOnly: true, ...(vehicleClass ? {vehicleClass} : {})}));
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setShopLoading(false);
    }
  }, [token, gps, radius, vehicleClass]);
  useEffect(() => {
    if (section !== "shops") return;
    void loadShops();
  }, [section, loadShops]);
  useEffect(() => {
    const q = query.trim();
    if (q === "" || !token || !gps) {
      setSearchResults([]);
      return;
    }
    setSearchBusy(true);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          setSearchResults(await searchProviders(gps.lat, gps.lng, q, token, {radiusMeters: 10000, ...(vehicleClass ? {vehicleClass} : {})}));
        } catch (err) {
          setError(toMessage(err));
        } finally {
          setSearchBusy(false);
        }
      })();
    }, 250);
    return () => clearTimeout(timer);
  }, [query, token, gps, vehicleClass]);
  async function currentPoint(): Promise<{lat: number; lng: number}> {
    const {status} = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") throw new Error(t.nav.locationDenied);
    return getFix({timeoutMs: 5000});
  }
  function onPickTicket(id: string): void {
    const next = toggleSelected(selectedId, id);
    setSelectedId(next);
    if (!next) return;
    const ticket = ticketById([...mine, ...nearby, ...feed], id);
    if (ticket) void cameraRef.current?.setStop({center: [ticket.lng, ticket.lat], zoom: 15, duration: 600});
  }
  function onPickShop(id: string): void {
    const shop = shops.find((s) => s.id === id) ?? null;
    if (!shop) return;
    setShopSheet(shop);
    void cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600});
  }
  function shopMinutesLabel(shop: Provider | null): string | null {
    if (!shop || typeof shop.distance !== "number") return null;
    return t.shop.walkMinutesShort.replace("{n}", String(walkMinutes(shop.distance)));
  }
  function shopDistanceLabel(shop: Provider | null): string | null {
    if (!shop || typeof shop.distance !== "number") return null;
    return `${walkKm(shop.distance)} ${t.route.km}`;
  }
  async function onWalkPreview(shop: Provider): Promise<void> {
    if (!token) return;
    setShopSheet(null);
    setShopSel(shop);
    setWalkRoute(null);
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
  async function onNavigateToShop(shop: Provider): Promise<void> {
    if (!token || navBusy) return;
    setNavBusy(true);
    setError(null);
    try {
      const live = await currentPoint();
      setShopSheet(null);
      const res = await findRoute(
        {originLat: live.lat, originLng: live.lng, destLat: shop.lat, destLng: shop.lng, width: activeVehicle?.baseWidth, vehicleType: activeVehicle?.type},
        token,
      );
      const first = res.routes?.[0];
      if (!first) throw new Error(t.route.noResults);
      startNavSession({route: first, dest: {lat: shop.lat, lng: shop.lng}, stops: [], seed: live, ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}), ...(activeVehicle?.type ? {vehicleType: activeVehicle.type} : {})});
      navigation.navigate("Navigation" as never);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setNavBusy(false);
    }
  }
  function onPickSearch(id: string): void {
    const shop = searchResults.find((s) => s.id === id) ?? null;
    if (!shop) return;
    setShopSheet(shop);
    void cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600});
  }
  function classChips(shop: Provider): string[] {
    const classes = shop.vehicleClasses;
    if (!Array.isArray(classes) || classes.length === 0) return [];
    return classes.map((c) => (c === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike));
  }
  function closesLabel(shop: Provider): string | null {
    if (shop.openNow !== true || typeof shop.closesInMinutes !== "number") return null;
    return t.shop.closesIn.replace("{n}", String(shop.closesInMinutes));
  }
  async function onImHere(shop: Provider): Promise<void> {
    if (!token || imHereBusy) return;
    setImHereBusy(true);
    setError(null);
    try {
      const point = await currentPoint();
      await createTicket({ticketType: "WALK_IN", lat: point.lat, lng: point.lng, providerId: shop.id, vehicleType: activeVehicle?.type, vehicleWidth: activeVehicle?.baseWidth}, token);
      setShopSheet(null);
      setNotice(t.assist.checkedIn);
      setSection("records");
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setImHereBusy(false);
    }
  }
  function rateTarget(ticket: DispatchTicket): {targetId: string; targetKind: "VOLUNTEER" | "SHOP"} | null {
    if (typeof ticket.assignedUid === "string" && ticket.assignedUid) return {targetId: ticket.assignedUid, targetKind: "VOLUNTEER"};
    if (typeof ticket.assignedShopId === "string" && ticket.assignedShopId) return {targetId: ticket.assignedShopId, targetKind: "SHOP"};
    if (typeof ticket.destinationShopId === "string" && ticket.destinationShopId) return {targetId: ticket.destinationShopId, targetKind: "SHOP"};
    return null;
  }
  function onRate(ticket: DispatchTicket): void {
    if (!rateTarget(ticket)) {
      setError(t.assist.noOneToRate);
      return;
    }
    setRatingRider(false);
    setRatingFor(ticket);
  }
  async function onSubmitRating(score: number): Promise<void> {
    if (!token || !ratingFor || ratingBusy) return;
    const target = ratingRider ? {targetId: ratingFor.userId, targetKind: "RIDER" as const} : rateTarget(ratingFor);
    if (!target) {
      setError(t.assist.noOneToRate);
      return;
    }
    setRatingBusy(true);
    setError(null);
    try {
      await submitRating({targetId: target.targetId, targetKind: target.targetKind, ticketId: ratingFor.id, score}, token);
      setRatedScores((prev) => ({...prev, [ratingFor.id]: score}));
      setRatingFor(null);
      setRatingRider(false);
      setNotice(t.rating.sent);
      await reloadAll();
    } catch (err) {
      if (err instanceof ApiError && err.statusCode === 404) {
        setRatingFor(null);
        setRatingRider(false);
        setNotice(t.assist.alreadyGone);
        await reloadAll();
      } else {
        setError(toMessage(err));
      }
    } finally {
      setRatingBusy(false);
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
  async function onAcceptTicket(ticket: FeedTicket): Promise<void> {
    if (!token || recBusy) return;
    if (typeof ticket.providerId !== "string" || !ticket.providerId) {
      setError(t.assist.alreadyGone);
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await acceptTicket(ticket.id, token, ticket.providerId);
      setNotice(t.assist.accepted);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onDeclineTicket(ticket: FeedTicket, reason: DeclineReason, note: string | undefined): Promise<void> {
    if (!token || recBusy) return;
    if (typeof ticket.providerId !== "string" || !ticket.providerId) {
      setError(t.assist.alreadyGone);
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await declineTicket(ticket.id, ticket.providerId, reason, note, token);
      setNotice(t.provider.declineSent);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onSaveWork(ticket: FeedTicket, patch: WorkPatch): Promise<void> {
    if (!token || recBusy) return;
    const q = patch.quoted.trim() === "" ? undefined : Number(patch.quoted.trim());
    const f = patch.final.trim() === "" ? undefined : Number(patch.final.trim());
    if ((q !== undefined && (!Number.isInteger(q) || q < 0)) || (f !== undefined && (!Number.isInteger(f) || f < 0))) {
      setError(t.provider.invalidAmount);
      return;
    }
    setRecBusy(true);
    setError(null);
    try {
      await updateWorkOrder({ticketId: ticket.id, ...(patch.workType.trim() ? {workType: patch.workType.trim()} : {}), ...(q !== undefined ? {quotedAmount: q} : {}), ...(f !== undefined ? {finalAmount: f} : {})}, token);
      setNotice(t.provider.workSaved);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  async function onLoadRatings(ticket: FeedTicket): Promise<void> {
    if (!token) return;
    try {
      const list = await ratingsByTicket(ticket.id, token);
      setTicketRatings((prev) => ({...prev, [ticket.id]: list}));
    } catch (err) {
      setError(toMessage(err));
    }
  }
  async function onReplyRating(ratingId: string, text: string): Promise<void> {
    if (!token || recBusy || text === "") return;
    setRecBusy(true);
    setError(null);
    try {
      await replyRating(ratingId, text, token);
      setNotice(t.rating.replied);
      await reloadAll();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setRecBusy(false);
    }
  }
  function onRateRider(ticket: FeedTicket): void {
    setRatingFor(ticket);
    setRatingRider(true);
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
    if (locateBusy) return;
    setLocateBusy(true);
    setError(null);
    try {
      const p = await currentPoint();
      setGps(p);
      void cameraRef.current?.setStop({center: [p.lng, p.lat], zoom: 15, duration: 600});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLocateBusy(false);
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
        shops={section === "shops" && showShops ? shops : []}
        selectedShop={section === "shops" && showShops ? (shopSheet ?? shopSel) : null}
        selectedShopLabel={section === "shops" && showShops ? shopMinutesLabel(shopSheet ?? shopSel) : null}
        walkRoute={section === "shops" && showShops ? walkRoute : null}
        onMapReady={() => applyCenter()}
        onPickTicket={onPickTicket}
        onPickShop={(id) => void onPickShop(id)}
      />
      <FabColumn top={insets.top + 24 + cardH}>
        <Fab theme={theme} label={t.common.currentLocation} disabled={locateBusy} onPress={() => void onLocate()}>
          {locateBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={22} color={theme.primary} />}
        </Fab>
        <Fab theme={theme} label={t.assist.refresh} disabled={loading} onPress={() => void reloadAll()}>
          {loading ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="refresh" size={22} color={theme.primary} />}
        </Fab>
      </FabColumn>
      {selectedTicket ? (
        <View style={[styles.selectedWrap, {top: insets.top + 24 + cardH}]} pointerEvents="box-none">
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
      <View style={[styles.topContainer, {top: insets.top + 12}]}>
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
                {typeof active.shopQuotedAmount === "number" || typeof active.finalAmount === "number" ? (
                  <Text style={[styles.coords, {color: theme.text}]}>
                    {typeof active.shopQuotedAmount === "number" ? `${t.assist.quote}: ${active.shopQuotedAmount} VND` : ""}
                    {typeof active.shopQuotedAmount === "number" && typeof active.finalAmount === "number" ? " · " : ""}
                    {typeof active.finalAmount === "number" ? `${t.assist.finalPrice}: ${active.finalAmount} VND` : ""}
                  </Text>
                ) : null}
                <StatusStepper t={t} theme={theme} ticketType={active.ticketType} status={active.status} declineReason={null} />
                <View style={styles.actionRow}>
                  {riderActionsFor(active.status).includes("arrived") ? (
                    <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, respBusy && styles.disabled]} disabled={respBusy} onPress={() => void onStatus("3")} accessibilityRole="button" accessibilityLabel={t.assist.arrived}>
                      <Text style={styles.actionText}>{t.assist.arrived}</Text>
                    </Pressable>
                  ) : null}
                  {riderActionsFor(active.status).includes("resolved") ? (
                    <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, respBusy && styles.disabled]} disabled={respBusy} onPress={() => void onStatus("4")} accessibilityRole="button" accessibilityLabel={t.assist.resolved}>
                      <Text style={styles.actionText}>{t.assist.resolved}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : null}
            <AssistSectionTabs
              theme={theme}
              tabs={[
                {id: "request", label: t.assist.sectionRequest},
                ...(showShops ? [{id: "shops", label: t.assist.sectionShops}] : []),
                {id: "records", label: t.assist.sectionRecords},
              ]}
              selected={section}
              onChange={(id) => setSection(id as AssistSection)}
            />
            {section === "request" ? (
              <RequestSection
                t={t}
                theme={theme}
                ticketType={ticketType}
                onTicketType={setTicketType}
                showMechanic={showShops}
                note={note}
                onNote={setNote}
                towDest={ticketType === "TOW" ? <PlaceSearchField search={destSearch} placeholder={t.common.searchPlaceholder} noResultsText={t.common.noResults} groupLabels={{saved: t.route.savedPlaces, directory: t.route.directory, map: t.route.mapResults}} onSelect={setDest} /> : null}
                reqBusy={reqBusy}
                onRequest={() => void onRequest()}
              />
            ) : null}
            {section === "shops" && showShops ? (
              vehicleClass ? (
                <ShopsSection
                  t={t}
                  theme={theme}
                  query={query}
                  onQuery={setQuery}
                  searchResults={searchResults}
                  searchBusy={searchBusy}
                  searching={query.trim() !== ""}
                  onPickSearch={(id) => onPickSearch(id)}
                  radiusLabel={radiusLabel(radius)}
                  onCycleRadius={cycleRadius}
                  shopLoading={shopLoading}
                  emptyShops={!shopSel && !shopLoading && shops.length === 0}
                  shopSel={shopSel}
                  walkRoute={walkRoute}
                  walkBusy={walkBusy}
                  navBusy={navBusy}
                  onClearShop={() => { setShopSel(null); setWalkRoute(null); }}
                  onNavigate={(shop) => void onNavigateToShop(shop)}
                />
              ) : (
                <Text style={[styles.hint, {color: theme.muted}]}>{t.shop.noVehicle}</Text>
              )
            ) : null}
            {section === "records" ? (
              <RecordsSection
                t={t}
                theme={theme}
                tickets={feed}
                loading={loading}
                busy={recBusy}
                selectedId={selectedId}
                ratings={ticketRatings}
                onPick={(id) => onPickTicket(id)}
                onConfirmCancel={(id) => void onCancel(id)}
                onRate={(ticket) => onRate(ticket)}
                onAccept={(ticket) => void onAcceptTicket(ticket)}
                onDecline={(ticket, reason, note) => void onDeclineTicket(ticket, reason, note)}
                onSaveWork={(ticket, patch) => void onSaveWork(ticket, patch)}
                onLoadRatings={(ticket) => void onLoadRatings(ticket)}
                onReply={(ratingId, text) => void onReplyRating(ratingId, text)}
                onRateRider={(ticket) => onRateRider(ticket)}
              />
            ) : null}
            {provider && section === "request" ? (
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
      </View>
      {showShops && shopSheet ? (
        <ShopDetailSheet
          t={t}
          shop={shopSheet}
          distanceLabel={shopDistanceLabel(shopSheet)}
          walkLabel={shopMinutesLabel(shopSheet)}
          openLabel={openBadge(shopSheet).label}
          openColor={openBadge(shopSheet).color}
          closesLabel={closesLabel(shopSheet)}
          closedWarn={shopSheet.openNow === false}
          classChips={classChips(shopSheet)}
          walkBusy={walkBusy}
          navBusy={navBusy}
          imHereBusy={imHereBusy}
          onReport={() => {
            setReportReason("FAKE_BUSINESS");
            setReportNote("");
            setReportError(null);
            setReportFor({id: shopSheet.id, name: shopSheet.name});
            setShopSheet(null);
          }}
          onWalkHere={() => void onWalkPreview(shopSheet)}
          onRouteFromHere={() => void onNavigateToShop(shopSheet)}
          onImHere={() => void onImHere(shopSheet)}
          onClose={() => setShopSheet(null)}
        />
      ) : null}
      {ratingFor ? (
        <RatingSheet
          t={t}
          ticket={ratingFor}
          initialScore={ratedScores[ratingFor.id] ?? null}
          busy={ratingBusy}
          onSubmit={(score) => void onSubmitRating(score)}
          onClose={() => { setRatingFor(null); setRatingRider(false); }}
        />
      ) : null}
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
              <Text style={{color: reportReason === reason ? "#fff" : theme.text}}>{{FAKE_BUSINESS: t.report.reasonFakeBusiness, WRONG_LOCATION: t.report.reasonWrongLocation, UNSAFE: t.report.reasonUnsafe, HARASSMENT: t.report.reasonHarassment, SPAM: t.report.reasonSpam, INFO_INACCURATE: t.report.reasonInfoInaccurate, OTHER: t.report.reasonOther}[reason]}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.report.notePlaceholder} placeholderTextColor={theme.muted} value={reportNote} onChangeText={setReportNote} maxLength={280} />
      </Overlay>
      {error ? (
        <Snack message={error} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : (
        <Snack message={notice} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setNotice(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  topContainer: {position: "absolute", left: 12, right: 12},
  card: {width: "100%", borderWidth: 1, borderRadius: 16, padding: 12, maxHeight: 420, overflow: "hidden"},
  cardScroll: {gap: 8, paddingBottom: 4},
  section: {fontSize: 16, fontWeight: "700", marginTop: 8},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  disabled: {opacity: 0.6},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6},
  actionRow: {flexDirection: "row", gap: 8},
  activeCard: {borderWidth: 2},
  cardTitle: {fontWeight: "700"},
  coords: {fontSize: 12},
  hint: {fontSize: 12},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  selectedWrap: {position: "absolute", left: 12, right: 12, zIndex: 10, elevation: 5},
  selectedCard: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
  selectedRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
});
