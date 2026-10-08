import {useEffect, useRef, useState} from "react";
import {ActivityIndicator, AppState, BackHandler, Keyboard, Platform, StyleSheet, View, useColorScheme} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useNavigation, useIsFocused} from "@react-navigation/native";
import {AppText as Text} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {type CameraRef} from "@maplibre/maplibre-react-native";
import {findRoute, getSavedRoute, saveRoute, isFlagWarning, isHazardZone, isWidthBlock, type RouteOption} from "../api/routes";
import {windowAround} from "../services/navigation";
import {drainHazardLaunch, ensurePushConfigured, subscribeHazardPush, type HazardPushData} from "../services/push";
import {formatPoint, reverseLabel} from "../api/places";
import {getFix} from "../services/geo";
import {toMessage} from "../api/client";
import type {Place} from "../components/place-search";
import {fetchShopPlaces} from "../components/place-search/shopMerge";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import PlaceSearchScreen from "./PlaceSearchScreen";
import Overlay from "../components/overlay/Overlay";
import FlagReportDialog from "../components/flags/FlagReportDialog";
import SaveRouteDialog from "../components/routes/SaveRouteDialog";
import {useNavSession} from "../context/NavSessionContext";
import SavedRoutesSheet from "../components/routes/SavedRoutesSheet";
import Snack from "../components/ui/Snack";
import {flagOverlayActions} from "./hazards/flagActions";
import type {FlagReport} from "../components/flags/FlagSheet";
import FlagDetailSheet from "../components/flags/FlagDetailSheet";
import {confirmFlag, denyFlag, submitFlag, unflag, type Flag} from "../api/flags";
import {flagTypeLabel} from "../i18n/labels";
import {hazardKind} from "../components/flags/hazardStyle";
import {flagStatusColor, flagStatusLabel} from "../components/flags/flagStatus";
import {markDenied, markVoted} from "../storage/votedFlags";
import {HCMC_CENTER, MAX_STOPS, type Point, type SearchField, type Stop} from "./route/types";
import {boundsOf, midOf} from "./route/routeGeo";
import {useRouteDrag} from "./route/useRouteDrag";
import {createTaskEpoch, type TaskEpoch} from "./route/taskEpoch";
import {shouldRetryCenter} from "./route/cameraIntent";
import RouteMapView from "./route/RouteMapView";
import RouteCard from "./route/RouteCard";
import VehiclePickerSheet from "../components/vehicles/VehiclePickerSheet";
import {Fab, FabColumn} from "../components/ui/Fab";
import {FAB_SIZE, rightColumnBottom} from "./route/fabLayout";
import {snackBottom} from "../components/ui/snackOffset";
import {ROUTE_RETOUCH_MS, isRouteStale, pausedSnackKey, touchCapReached} from "./route/routeFresh";

export default function RouteScreen() {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const navigation = useNavigation();
  const {vehicles, activeVehicle, activateVehicle, hasVehicle} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef | null>(null);
  const seqRef = useRef(0);
  const centeredRef = useRef(false);
  const pendingCenterRef = useRef<{lat: number; lng: number} | null>(null);
  const [origin, setOrigin] = useState<Point | null>(null);
  const [dest, setDest] = useState<Point | null>(null);
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [stops, setStops] = useState<Stop[]>([]);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [searchingFor, setSearchingFor] = useState<SearchField | null>(null);
  const [starting, setStarting] = useState(false);
  const {start: startNavSession} = useNavSession();
  const [pickingFor, setPickingFor] = useState<SearchField | null>(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [pickEpoch] = useState<TaskEpoch>(createTaskEpoch);
  const pickAbortRef = useRef<AbortController | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [flagPoint, setFlagPoint] = useState<Point | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [flagBusy, setFlagBusy] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [deniedIds, setDeniedIds] = useState<Set<string>>(new Set());
  const [flagsKey, setFlagsKey] = useState(0);
  const [gpsPos, setGpsPos] = useState<Point | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const result = routes[selectedIndex] ?? null;
  const selectedMid = result ? midOf(result.geometry.coordinates) : null;
  const hazardZones = (result?.hazards ?? []).filter(isHazardZone);
  const widthBlocks = (result?.warnings ?? []).filter(isWidthBlock);
  const flagWarnings = (result?.warnings ?? []).filter(isFlagWarning);
  const [hazardFocusIdx, setHazardFocusIdx] = useState(-1);
  const [hazardHighlight, setHazardHighlight] = useState<[number, number][] | null>(null);
  const [cardH, setCardH] = useState(0);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [checking, setChecking] = useState(false);
  const [dismissedPausedKey, setDismissedPausedKey] = useState<number | null>(null);
  const pausedKey = (() => {
    const key = pausedSnackKey(checkedAt, result !== null);
    if (key === null) return null;
    if (!isRouteStale(checkedAt, nowMs)) return null;
    if (key === dismissedPausedKey) return null;
    return key;
  })();
  function onRefreshAlertsQuiet(): void {
    if (checking) return;
    setChecking(true);
    void quietRef.current().finally(() => setChecking(false));
  }
  const [appActive, setAppActive] = useState(true);
  const [retouchStart, setRetouchStart] = useState<number | null>(null);
  const HAZARD_HIGHLIGHT_HALF = 80;
  const canClear = !!origin || !!dest || stops.length > 0 || routes.length > 0;
  function fitRouteGeometry(coords: [number, number][]) {
    const b = boundsOf(coords);
    if (b) cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800});
  }
  async function requestRoute(o: Point | null, d: Point | null, s: Stop[], width?: number, vehicleType?: string, fit?: boolean): Promise<RouteOption[] | null> {
    if (!token || !o || !d) return null;
    const id = (seqRef.current += 1);
    setBusy(true);
    setError(null);
    try {
      const res = await findRoute({originLat: o.lat, originLng: o.lng, destLat: d.lat, destLng: d.lng, stops: s.map((stop) => ({lat: stop.lat, lng: stop.lng})), width: width ?? activeVehicle?.baseWidth, vehicleType: vehicleType ?? activeVehicle?.type}, token);
      if (seqRef.current !== id) return null;
      const next = res.routes ?? [];
      setRoutes(next);
      setSelectedIndex(0);
      setHazardFocusIdx(-1);
      setHazardHighlight(null);
      setCheckedAt(Date.now());
      setRetouchStart(Date.now());
      if (fit && next[0]) fitRouteGeometry(next[0].geometry.coordinates);
      return next;
    } catch (err) {
      if (seqRef.current === id) setError(toMessage(err));
      return null;
    } finally {
      if (seqRef.current === id) setBusy(false);
    }
  }
  const autoFindRef = useRef("");
  const autoFailAtRef = useRef(0);
  const routeTabFocused = useIsFocused();
  const requestRef = useRef(requestRoute);
  requestRef.current = requestRoute;
  useEffect(() => {
    const key = origin && dest ? `${origin.lat},${origin.lng}|${dest.lat},${dest.lng}|${stops.length}` : "";
    if (!routeTabFocused || !origin || !dest || routes.length > 0 || busy || starting || searchingFor || pickingFor || !token) return;
    if (autoFindRef.current === key && (autoFailAtRef.current === 0 || Date.now() - autoFailAtRef.current < 30000)) return;
    const o = origin;
    const d = dest;
    const s = stops;
    const timer = setTimeout(() => {
      autoFindRef.current = key;
      autoFailAtRef.current = 0;
      void requestRef.current(o, d, s, undefined, undefined, true).then((r) => {
        if (!r) autoFailAtRef.current = Date.now();
      });
    }, 600);
    return () => clearTimeout(timer);
  }, [origin, dest, stops, routes.length, busy, starting, searchingFor, pickingFor, token, routeTabFocused]);
  async function refreshRoutesQuiet(): Promise<void> {
    if (!token || !origin || !dest || routes.length === 0) return;
    const id = (seqRef.current += 1);
    const before = JSON.stringify((routes[selectedIndex] ?? routes[0]).geometry.coordinates);
    try {
      const res = await findRoute({originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng, stops: stops.map((s) => ({lat: s.lat, lng: s.lng})), width: activeVehicle?.baseWidth, vehicleType: activeVehicle?.type}, token);
      if (seqRef.current !== id) return;
      const next = res.routes ?? [];
      setRoutes(next);
      setSelectedIndex(0);
      setHazardFocusIdx(-1);
      setHazardHighlight(null);
      setCheckedAt(Date.now());
      const after = next[0] ? JSON.stringify(next[0].geometry.coordinates) : before;
      setSnack(after !== before ? t.flag.rerouted : t.route.hazardUpdated);
    } catch {
      return;
    }
  }
  async function onStart() {
    if (!token || !dest || starting) return;
    setStarting(true);
    setError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location denied");
      const live = await getFix({maxAgeMs: 60000, timeoutMs: 5000});
      const res = await findRoute(
        {originLat: live.lat, originLng: live.lng, destLat: dest.lat, destLng: dest.lng, stops: stops.map((s) => ({lat: s.lat, lng: s.lng})), width: activeVehicle?.baseWidth, vehicleType: activeVehicle?.type},
        token,
      );
      const first = res.routes?.[0];
      if (!first) throw new Error(t.route.noResults);
      setRoutes(res.routes ?? []);
      setSelectedIndex(0);
      setHazardFocusIdx(-1);
      setHazardHighlight(null);
      startNavSession({route: first, dest, stops: stops.map((s) => ({lat: s.lat, lng: s.lng})), seed: live, ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}), ...(activeVehicle?.type ? {vehicleType: activeVehicle.type} : {})});
      navigation.navigate("Navigation" as never);
      if (Platform.OS === "android") {
        void Location.getBackgroundPermissionsAsync()
          .then((bg) => {
            if (bg.status === "granted") return;
            return Location.requestBackgroundPermissionsAsync().then((next) => {
              if (next.status !== "granted") setSnack(t.more.bgTrackingOff);
            });
          })
          .catch(() => undefined);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setStarting(false);
    }
  }
  function onPickPlace(place: Place, field: SearchField | null = searchingFor) {
    Keyboard.dismiss();
    if (field === "origin") {
      const next = {lat: place.lat, lng: place.lng};
      setOrigin(next);
      setOriginText(place.label);
      if (routes.length > 0 && dest) {
        void requestRoute(next, dest, stops, undefined, undefined, true);
      }
    } else if (field === "destination") {
      const next = {lat: place.lat, lng: place.lng};
      setDest(next);
      setDestText(place.label);
      if (routes.length > 0 && origin) {
        void requestRoute(origin, next, stops, undefined, undefined, true);
      }
    } else if (field === "stop") {
      if (stops.length >= MAX_STOPS) {
        setSearchingFor(null);
        return;
      }
      const next = [...stops, {label: place.label, lat: place.lat, lng: place.lng}];
      setStops(next);
      if (routes.length > 0 && origin && dest) void requestRoute(origin, dest, next);
    }
    if (routes.length === 0) {
      void cameraRef.current?.setStop({center: [place.lng, place.lat], zoom: 15, duration: 500});
    }
    setSearchingFor(null);
  }
  function cancelPick(): void {
    pickEpoch.invalidate();
    pickAbortRef.current?.abort();
    pickAbortRef.current = null;
    setPickBusy(false);
    setPickingFor(null);
  }
  async function onPickMapPoint(lat: number, lng: number) {
    const field = pickingFor;
    if (!field || busy || pickAbortRef.current) return;
    Keyboard.dismiss();
    if (field === "stop" && stops.length >= MAX_STOPS) {
      setPickingFor(null);
      return;
    }
    const ctrl = new AbortController();
    pickAbortRef.current = ctrl;
    const id = pickEpoch.claim();
    setPickBusy(true);
    try {
      const label = await reverseLabel(lat, lng, lang, ctrl.signal);
      if (!pickEpoch.current(id)) return;
      onPickPlace({label, lat, lng, source: "map"}, field);
    } catch (err) {
      if (!pickEpoch.current(id)) return;
      setError(toMessage(err));
    } finally {
      if (pickAbortRef.current === ctrl) pickAbortRef.current = null;
      if (pickEpoch.current(id)) {
        setPickBusy(false);
        setPickingFor(null);
      }
    }
  }
  async function onFlagMapPoint(lat: number, lng: number) {
    setFlagPoint({lat, lng});
  }
  const drag = useRouteDrag({
    origin,
    dest,
    stops,
    routes,
    selectedIndex,
    busy,
    pickingFor,
    flagMode,
    requestRoute,
    setOrigin,
    setOriginText,
    setDest,
    setDestText,
    setStops,
    onPickMapPoint,
    onFlagMapPoint,
  });
  const CENTER_RETRIES = 3;
  const CENTER_RETRY_MS = 4000;
  function applyCenter(): boolean {
    const pending = pendingCenterRef.current;
    const cam = cameraRef.current;
    if (!pending || !cam) return false;
    pendingCenterRef.current = null;
    centeredRef.current = true;
    void cam.setStop({center: [pending.lng, pending.lat], zoom: 15, duration: 800});
    return true;
  }
  async function centerOnLocal(): Promise<void> {
    for (let attempt = 0; shouldRetryCenter(centeredRef.current, attempt, CENTER_RETRIES); attempt++) {
      if (attempt > 0) await new Promise<void>((resolve) => setTimeout(resolve, CENTER_RETRY_MS));
      try {
        const {status} = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        if (!pendingCenterRef.current) {
          try {
            pendingCenterRef.current = await getFix();
          } catch {}
        }
        if (applyCenter()) return;
      } catch {}
    }
    if (!centeredRef.current && !pendingCenterRef.current) setError(t.route.locationUnavailable);
  }
  useEffect(() => {
    if (centeredRef.current) return;
    void centerOnLocal();
  }, []);
  const quietRef = useRef(refreshRoutesQuiet);
  quietRef.current = refreshRoutesQuiet;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      setAppActive(state === "active");
    });
    return () => sub.remove();
  }, []);
  useEffect(() => {
    if (!routeTabFocused || !result) return;
    const clock = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(clock);
  }, [routeTabFocused, result !== null]);
  useEffect(() => {
    if (!routeTabFocused || !appActive || !result || busy || starting || searchingFor || pickingFor || !token) return;
    const timer = setInterval(() => {
      if (checking || touchCapReached(retouchStart, Date.now())) return;
      setChecking(true);
      void quietRef.current().finally(() => setChecking(false));
    }, ROUTE_RETOUCH_MS);
    return () => clearInterval(timer);
  }, [routeTabFocused, appActive, result !== null, busy, starting, searchingFor, pickingFor, token, checking, retouchStart]);
  useEffect(() => {
    ensurePushConfigured();
    const onHazard = (data: HazardPushData): void => {
      setFlagsKey((k) => k + 1);
      if (data.removed) {
        setSelectedFlag((cur) => (cur?.id === data.flagId ? null : cur));
        setSnack(t.flag.clearedMsg);
      }
      void quietRef.current();
    };
    void drainHazardLaunch().then((drained) => {
      if (drained) onHazard(drained);
    });
    return subscribeHazardPush(onHazard, "route");
  }, []);
  useEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
    return () => {
      navigation.setOptions({headerShown: true});
    };
  }, [navigation]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (pickingFor) {
        cancelPick();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [pickingFor]);
  function toggleFlagMode() {
    setFlagMode((v) => !v);
    cancelPick();
  }
  function cancelFlagReport() {
    setFlagPoint(null);
    setFlagMode(false);
    cancelPick();
  }
  async function onSubmitFlag(report: FlagReport) {
    if (!token || !flagPoint) return;
    setFlagBusy(true);
    try {
      await submitFlag({type: report.type, lat: flagPoint.lat, lng: flagPoint.lng, radiusMeters: report.radiusMeters, note: report.note}, token);
      setFlagPoint(null);
      setFlagMode(false);
      setFlagsKey((k) => k + 1);
      setSnack(t.flag.reported);
      void refreshRoutesQuiet();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  async function onConfirmFlag(flagId: string) {
    if (!token) return;
    setFlagBusy(true);
    setSnack(t.flag.checkingRoute);
    try {
      const res = await confirmFlag(flagId, token);
      void markVoted(flagId);
      setVotedIds((prev) => new Set(prev).add(flagId));
      setSelectedFlag(null);
      setFlagsKey((k) => k + 1);
      if (routes.length > 0 && origin && dest) {
        const before = result ? JSON.stringify(result.geometry.coordinates) : "";
        const next = await requestRoute(origin, dest, stops);
        const after = next?.[0] ? JSON.stringify(next[0].geometry.coordinates) : "";
        setSnack(after !== "" && after !== before ? t.flag.rerouted : res.alreadyVoted ? t.flag.alreadyVoted : t.flag.confirmedMsg);
      } else {
        setSnack(res.alreadyVoted ? t.flag.alreadyVoted : t.flag.confirmedMsg);
      }
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  async function onDenyFlag(flagId: string) {
    if (!token) return;
    setFlagBusy(true);
    try {
      const res = await denyFlag(flagId, token);
      void markDenied(flagId);
      setDeniedIds((prev) => new Set(prev).add(flagId));
      setSelectedFlag(null);
      setFlagsKey((k) => k + 1);
      setSnack(res.alreadyVoted ? t.flag.alreadyDenied : t.flag.deniedMsg);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  async function onRemoveFlag(flagId: string) {
    if (!token) return;
    if (selectedFlag?.id === flagId && selectedFlag.status === "3") {
      setError(t.flag.lockedRemoveDenied);
      return;
    }
    setFlagBusy(true);
    try {
      await unflag(flagId, token);
      setSelectedFlag(null);
      setFlagsKey((k) => k + 1);
      setSnack(t.flag.removedMsg);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setFlagBusy(false);
    }
  }
  function onDeleteStop(index: number) {
    const next = stops.filter((_, i) => i !== index);
    setStops(next);
    if (routes.length > 0 && origin && dest) void requestRoute(origin, dest, next);
  }
  function onSwap() {
    const o = origin;
    const ot = originText;
    setOrigin(dest);
    setDest(o);
    setOriginText(destText);
    setDestText(ot);
    const reversed = [...stops].reverse();
    setStops(reversed);
    if (routes.length > 0 && dest && o) {
      void requestRoute(dest, o, reversed, undefined, undefined, true);
    }
  }
  function onSelectRoute(i: number) {
    setSelectedIndex(i);
    setHazardFocusIdx(-1);
    setHazardHighlight(null);
    const r = routes[i];
    if (r) fitRouteGeometry(r.geometry.coordinates);
  }
  async function onLocate() {
    if (gpsBusy) return;
    setGpsBusy(true);
    setError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location denied");
      const next = await getFix({timeoutMs: 5000});
      setGpsPos(next);
      void cameraRef.current?.setStop({center: [next.lng, next.lat], duration: 500});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setGpsBusy(false);
    }
  }
  function onClear(): void {
    setCheckedAt(null);
    setRetouchStart(null);
    setOrigin(null);
    setDest(null);
    setOriginText("");
    setDestText("");
    setStops([]);
    setRoutes([]);
    setSelectedIndex(0);
    setHazardFocusIdx(-1);
    setHazardHighlight(null);
    setError(null);
  }
  function cycleHazard(): void {
    const res = routes[selectedIndex] ?? null;
    const list = (res?.warnings ?? []).filter(isFlagWarning);
    if (!res || list.length === 0) return;
    const next = hazardFocusIdx + 1;
    if (next >= list.length) {
      setHazardFocusIdx(-1);
      setHazardHighlight(null);
      fitRouteGeometry(res.geometry.coordinates);
      return;
    }
    const h = list[next];
    setHazardFocusIdx(next);
    setHazardHighlight(windowAround(res.geometry.coordinates, h.distanceMeters, HAZARD_HIGHLIGHT_HALF));
    const zoom = drag.camRef.current?.zoom ?? 13;
    void cameraRef.current?.setStop({center: [h.lng, h.lat], zoom: Math.max(zoom, 16), duration: 500});
  }
  async function onVehiclePress(id: string) {
    setVehicleOpen(false);
    try {
      await activateVehicle(id);
      setSnack(t.vehicle.activeSaved);
      const next = vehicles.find((v) => v.id === id) ?? null;
      if (routes.length > 0 && origin && dest && next) await requestRoute(origin, dest, stops, next.baseWidth, next.type);
    } catch (err) {
      setError(toMessage(err));
    }
  }
  function onSave(): void {
    if (!token || !origin || !dest || !result) return;
    setSaveOpen(true);
  }
  async function onSaveRoute(name: string | undefined) {
    if (!token || !origin || !dest || !result) return;
    Keyboard.dismiss();
    setSaveBusy(true);
    setError(null);
    try {
      await saveRoute({name, originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng, stops: stops.map((stop) => ({lat: stop.lat, lng: stop.lng})), width: activeVehicle?.baseWidth, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds, source: result.source, geometry: result.geometry}, token);
      setSaveOpen(false);
      setSnack(t.route.savedMsg);
    } catch (err) {
      setSaveOpen(false);
      setError(toMessage(err));
    } finally {
      setSaveBusy(false);
    }
  }
  async function onOpenSaved(routeId: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await getSavedRoute(routeId, token);
      const o = {lat: saved.originLat, lng: saved.originLng};
      const d = {lat: saved.destLat, lng: saved.destLng};
      setOrigin(o);
      setDest(d);
      setOriginText(formatPoint(o.lat, o.lng));
      setDestText(formatPoint(d.lat, d.lng));
      setStops((saved.stops ?? []).map((s) => ({label: formatPoint(s.lat, s.lng), lat: s.lat, lng: s.lng})));
      setRoutes([{source: saved.source ?? "saved", geometry: saved.geometry, distanceMeters: saved.distanceMeters ?? 0, durationSeconds: saved.durationSeconds ?? 0}]);
      setSelectedIndex(0);
      setHazardFocusIdx(-1);
      setHazardHighlight(null);
      setCheckedAt(null);
      setRetouchStart(Date.now());
      fitRouteGeometry(saved.geometry.coordinates);
      setSavedOpen(false);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={styles.root} onLayout={(e) => {
      const {width, height} = e.nativeEvent.layout;
      const prev = drag.camRef.current;
      drag.camRef.current = {...(prev ?? {center: HCMC_CENTER, zoom: 13, ne: [0, 0] as [number, number], sw: [0, 0] as [number, number]}), w: width, h: height};
    }}>
      <RouteMapView
        t={t}
        theme={theme}
        cameraRef={cameraRef}
        routes={routes}
        selectedIndex={selectedIndex}
        result={result}
        origin={origin}
        dest={dest}
        stops={stops}
        gps={gpsPos}
        flagPoint={flagPoint}
        dragPos={drag.dragPos}
        selectedMid={selectedMid}
        hazardHighlight={hazardHighlight}
        dragging={drag.dragging}
        dragPan={drag.dragPan}
        pickingFor={pickingFor}
        pickBusy={pickBusy}
        onMapPress={drag.onMapPress}
        onRegionChange={drag.onRegionChange}
        onRegionDid={drag.onRegionDid}
        onSelectIndex={onSelectRoute}
        onCancelPick={cancelPick}
        onMapReady={() => applyCenter()}
        flagCamRef={drag.camRef}
        flagsToken={token}
        flagsKey={flagsKey}
        onPickFlag={setSelectedFlag}
        subscribeRegionDid={drag.subscribeRegionDid}
      />
      {!pickingFor && !flagPoint && !selectedFlag ? (
        flagMode ? (
          <Fab theme={theme} variant="danger" size={FAB_SIZE} label={t.common.close} onPress={toggleFlagMode} style={{position: "absolute", top: insets.top + 12, left: 12, zIndex: 10, elevation: 4}}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </Fab>
        ) : (
          <Fab theme={theme} label={t.route.flagMode} onPress={toggleFlagMode} style={{position: "absolute", top: insets.top + 12, left: 12, zIndex: 10, elevation: 4}}>
            <MaterialIcons name="add-alert" size={22} color={theme.primary} />
          </Fab>
        )
      ) : null}
      {!pickingFor && !flagMode && !selectedFlag ? (
      <>
      <FabColumn bottom={rightColumnBottom(cardH)}>
        {canClear ? (
          <Fab theme={theme} variant="danger" size={FAB_SIZE} label={t.route.clear} onPress={onClear}>
            <MaterialIcons name="close" size={22} color="#fff" />
          </Fab>
        ) : null}
        {result && flagWarnings.length > 0 ? (
          <Fab theme={theme} size={FAB_SIZE} variant={hazardFocusIdx >= 0 ? "primary" : "paper"} label={t.nav.hazardFocus} onPress={cycleHazard}>
            <Text style={[styles.hazardNumber, {color: hazardFocusIdx >= 0 ? "#fff" : theme.primary}]}>{flagWarnings.length}</Text>
          </Fab>
        ) : null}
      </FabColumn>
      <View style={styles.bottomContainer}>
        <View style={styles.fabRow}>
          <Fab theme={theme} label={t.saved.title} disabled={!token || busy} onPress={() => setSavedOpen(true)}>
            <MaterialIcons name="bookmark-border" size={22} color={token ? theme.primary : theme.muted} />
          </Fab>
          <View style={styles.fabSpacer} />
          <Fab theme={theme} size={FAB_SIZE} label={t.common.currentLocation} disabled={gpsBusy} onPress={() => void onLocate()}>
            {gpsBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={22} color={theme.primary} />}
          </Fab>
        </View>
        <View onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
        <RouteCard
          t={t}
          theme={theme}
          lang={lang}
          originText={originText}
          destText={destText}
          stops={stops}
          result={result}
          origin={origin}
          dest={dest}
          activeVehicle={activeVehicle}
          hasVehicles={hasVehicle}
          busy={busy}
          starting={starting}
          hazardZones={hazardZones}
          widthBlocks={widthBlocks}
          onOpenSearch={(f) => { setPickingFor(null); setFlagMode(false); setSearchingFor(f); }}
          onSwap={onSwap}
          onDeleteStop={onDeleteStop}
          onOpenVehicle={() => setVehicleOpen(true)}
          onStart={() => void onStart()}
          onSave={() => void onSave()}
        />
        </View>
      </View>
      </>
      ) : null}
      {vehicleOpen ? (
        <Overlay visible variant="sheet" title={t.vehicle.title} closeLabel={t.common.cancel} onClose={() => setVehicleOpen(false)}>
          <VehiclePickerSheet t={t} theme={theme} token={token} activeId={activeVehicle?.id ?? null} onPick={(id) => void onVehiclePress(id)} onAddVehicle={() => { setVehicleOpen(false); navigation.navigate("Vehicle" as never); }} />
        </Overlay>
      ) : null}
      {searchingFor ? (
        <Overlay visible variant="fullScreen" closeLabel={t.common.cancel} onClose={() => { Keyboard.dismiss(); setSearchingFor(null); }}>
          <PlaceSearchScreen
              t={t}
              token={token ?? undefined}
              lang={lang}
              title={searchingFor === "origin" ? t.route.origin : searchingFor === "destination" ? t.route.destination : t.route.stop}
              placeholder={searchingFor === "origin" ? t.route.searchOrigin : searchingFor === "destination" ? t.route.searchDestination : t.route.searchStop}
              shops={searchingFor === "destination" && token && gpsPos ? async (q) => fetchShopPlaces(q, token, gpsPos) : undefined}
              onPick={onPickPlace}
              onPickOnMap={() => {
                const f = searchingFor;
                Keyboard.dismiss();
                setSearchingFor(null);
                setFlagMode(false);
                setPickingFor(f);
              }}
              onClose={() => { Keyboard.dismiss(); setSearchingFor(null); }}
            />
        </Overlay>
      ) : null}
      {savedOpen ? (
        <Overlay visible variant="dialog" title={t.saved.title} closeLabel={t.common.cancel} onClose={() => { Keyboard.dismiss(); setSavedOpen(false); }}>
          <SavedRoutesSheet t={t} token={token} onOpen={(id) => void onOpenSaved(id)} />
        </Overlay>
      ) : null}
      {saveOpen && result ? (
        <SaveRouteDialog
          t={t}
          theme={theme}
          originText={originText}
          destText={destText}
          distanceM={result.distanceMeters ?? 0}
          durationSec={result.durationSeconds ?? 0}
          busy={saveBusy}
          onClose={() => { Keyboard.dismiss(); setSaveOpen(false); }}
          onSave={(name) => void onSaveRoute(name)}
        />
      ) : null}
      {error ? (
        <Snack message={error} severity="error" sticky bottom={snackBottom(insets.bottom)} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : snack ? (
        <Snack message={snack} severity="confirm" bottom={snackBottom(insets.bottom)} accentColor={theme.primary} onHide={() => setSnack(null)} />
      ) : (
        <Snack
          message={
            drag.dragging
              ? t.route.dragHint
              : pickingFor
                ? t.route.pickOnMap
                : flagMode && !flagPoint
                  ? t.route.flagHint
                  : pausedKey !== null
                    ? t.route.alertsPaused
                    : null
          }
          sticky
          bottom={snackBottom(insets.bottom)}
          action={pausedKey !== null && !drag.dragging && !pickingFor && !(flagMode && !flagPoint) ? {label: t.assist.refresh, onPress: () => void onRefreshAlertsQuiet()} : undefined}
          onHide={() => {
            if (pausedKey !== null) setDismissedPausedKey(pausedKey);
          }}
        />
      )}
      {flagPoint ? (
        <FlagReportDialog t={t} lat={flagPoint.lat} lng={flagPoint.lng} onClose={cancelFlagReport} onSubmit={(r) => void onSubmitFlag(r)} />
      ) : null}
      {selectedFlag ? (
        <Overlay
          visible
          variant="dialog"
          title={flagTypeLabel(selectedFlag.type, t)}
          leading={<MaterialIcons name={hazardKind(selectedFlag.type).icon} size={22} color={hazardKind(selectedFlag.type).color} />}
          right={
            <View style={[styles.statusChip, {backgroundColor: flagStatusColor(selectedFlag.status)}]}>
              <Text style={styles.statusText}>{flagStatusLabel(selectedFlag.status, t)}</Text>
            </View>
          }
          closeLabel={t.common.cancel}
          onClose={() => setSelectedFlag(null)}
          actions={flagOverlayActions(
            selectedFlag.id,
            selectedFlag.status,
            uid != null && selectedFlag.reporterId === uid,
            votedIds.has(selectedFlag.id),
            deniedIds.has(selectedFlag.id),
            flagBusy,
            {confirm: t.flag.confirm, deny: t.flag.deny, remove: t.flag.remove},
            {onConfirm: (id) => void onConfirmFlag(id), onDeny: (id) => void onDenyFlag(id), onRemove: (id) => void onRemoveFlag(id)},
          )}
        >
          <FlagDetailSheet
            t={t}
            flag={selectedFlag}
            isOwn={uid != null && selectedFlag.reporterId === uid}
          />
        </Overlay>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1},
  statusChip: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  bottomContainer: {position: "absolute", left: 12, right: 12, bottom: 12, gap: 8},
  fabRow: {flexDirection: "row", alignItems: "center", gap: 8},
  fabSpacer: {flex: 1},
  hazardNumber: {fontSize: 20, fontWeight: "700", textAlign: "center"},
});
