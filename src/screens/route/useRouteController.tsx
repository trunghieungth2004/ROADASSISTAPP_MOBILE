import {useEffect, useRef, useState} from "react";
import {AppState, Keyboard, Platform} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useNavigation, useIsFocused} from "@react-navigation/native";

import * as Location from "expo-location";
import {type CameraRef} from "@maplibre/maplibre-react-native";
import {safeCameraCall} from "../../components/map/safeCamera";
import {findRoute, getSavedRoute, saveRoute, isFlagWarning, isHazardZone, isWidthBlock, type RouteOption} from "../../api/routes";
import {windowAround} from "../../services/navigation";
import {drainHazardLaunch, ensurePushConfigured, subscribeHazardPush, type HazardPushData} from "../../services/push";
import {uploadFlagPhotos} from "../../services/photos";
import {formatPoint} from "../../api/places";
import {getFix, metersBetween} from "../../services/geo";
import {toMessage} from "../../api/client";
import type {Place} from "../../components/place-search";

import {useAuth} from "../../context/AuthContext";
import {useProfile} from "../../context/ProfileContext";
import {useStrings} from "../../context/LanguageContext";
import {darkTheme, lightTheme} from "../../theme";

import {useNavSession} from "../../context/NavSessionContext";

import type {FlagReport} from "../../components/flags/FlagSheet";

import {bustFlagCaches, confirmFlag, denyFlag, submitFlag, unflag, type Flag} from "../../api/flags";

import {loadDeniedIds, loadVotedIds, markDenied, markVoted} from "../../storage/votedFlags";
import {HCMC_CENTER, MAX_STOPS, type Point, type SearchField, type Stop} from "./types";
import {boundsOf, midOf} from "./routeGeo";
import {useRouteDrag} from "./useRouteDrag";

import {shouldRetryCenter} from "./cameraIntent";

import {ROUTE_RETOUCH_MS, isRouteStale, pausedSnackKey, touchCapReached} from "./routeFresh";

export default function useRouteController() {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const navigation = useNavigation();
  const {vehicles, activeVehicle, activateVehicle, hasVehicle} = useProfile();
  const scheme = useAppMode();
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
  const [mapPickFor, setMapPickFor] = useState<SearchField | null>(null);
  const [flagMode, setFlagMode] = useState(false);
  const [flagPoint, setFlagPoint] = useState<Point | null>(null);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(null);
  const [chatFlag, setChatFlag] = useState<Flag | null>(null);
  const [flagBusy, setFlagBusy] = useState(false);
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [deniedIds, setDeniedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    let alive = true;
    setVotedIds(new Set());
    setDeniedIds(new Set());
    void (async () => {
      try {
        const [v, d] = await Promise.all([loadVotedIds(uid), loadDeniedIds(uid)]);
        if (!alive) return;
        setVotedIds(v);
        setDeniedIds(d);
      } catch {
        return;
      }
    })();
    return () => {
      alive = false;
    };
  }, [uid]);
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
    if (coords.length < 2) return;
    const b = boundsOf(coords);
    if (b) safeCameraCall(() => cameraRef.current?.fitBounds([b.sw[0], b.sw[1], b.ne[0], b.ne[1]], {padding: {top: 80, right: 60, bottom: 340, left: 60}, duration: 800}));
  }
  const SAME_PLACE_METERS = 15;
  async function requestRoute(o: Point | null, d: Point | null, s: Stop[], width?: number, vehicleType?: string, fit?: boolean): Promise<RouteOption[] | null> {
    if (!token || !o || !d) return null;
    if (s.length === 0 && metersBetween(o, d) <= SAME_PLACE_METERS) {
      setError(t.route.samePlace);
      return null;
    }
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
    if (!routeTabFocused || !origin || !dest || routes.length > 0 || busy || starting || searchingFor || mapPickFor || !token) return;
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
  }, [origin, dest, stops, routes.length, busy, starting, searchingFor, mapPickFor, token, routeTabFocused]);
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
      startNavSession({route: first, dest, stops: stops.map((s) => ({lat: s.lat, lng: s.lng})), seed: live, ...(activeVehicle?.id ? {vehicleId: activeVehicle.id} : {}), ...(activeVehicle?.baseWidth !== undefined ? {width: activeVehicle.baseWidth} : {}), ...(activeVehicle?.type ? {vehicleType: activeVehicle.type} : {})});
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
      safeCameraCall(() => cameraRef.current?.setStop({center: [place.lng, place.lat], zoom: 15, duration: 500}));
    }
    setSearchingFor(null);
  }
  function onConfirmMapPick(lat: number, lng: number, label: string): void {
    const field = mapPickFor;
    setMapPickFor(null);
    if (!field) return;
    onPickPlace({label, lat, lng, source: "map"}, field);
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
    flagMode,
    requestRoute,
    setOrigin,
    setOriginText,
    setDest,
    setDestText,
    setStops,
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
    safeCameraCall(() => cam.setStop({center: [pending.lng, pending.lat], zoom: 15, duration: 800}));
    return true;
  }
  async function centerOnLocal(): Promise<void> {
    for (let attempt = 0; shouldRetryCenter(centeredRef.current, attempt, CENTER_RETRIES); attempt++) {
      if (attempt > 0) await new Promise<void>((resolve) => setTimeout(resolve, CENTER_RETRY_MS));
      try {
        const {status} = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") {
          pendingCenterRef.current = {lat: HCMC_CENTER[1] ?? 10.7626, lng: HCMC_CENTER[0] ?? 106.6602};
          applyCenter();
          return;
        }
        if (!pendingCenterRef.current) {
          try {
            pendingCenterRef.current = await getFix();
          } catch {}
        }
        if (applyCenter()) return;
      } catch {}
    }
    if (!centeredRef.current && !pendingCenterRef.current) {
      pendingCenterRef.current = {lat: HCMC_CENTER[1] ?? 10.7626, lng: HCMC_CENTER[0] ?? 106.6602};
      if (!applyCenter()) setError(t.route.locationUnavailable);
    }
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
    if (!routeTabFocused || !appActive || !result || busy || starting || searchingFor || mapPickFor || !token) return;
    const timer = setInterval(() => {
      if (checking || touchCapReached(retouchStart, Date.now())) return;
      setChecking(true);
      void quietRef.current().finally(() => setChecking(false));
    }, ROUTE_RETOUCH_MS);
    return () => clearInterval(timer);
  }, [routeTabFocused, appActive, result !== null, busy, starting, searchingFor, mapPickFor, token, checking, retouchStart]);
  useEffect(() => {
    void ensurePushConfigured();
    const onHazard = (data: HazardPushData): void => {
      if (token) bustFlagCaches(token);
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
  function toggleFlagMode() {
    setFlagMode((v) => !v);
  }
  function cancelFlagReport() {
    setFlagPoint(null);
    setFlagMode(false);
  }
  async function onSubmitFlag(report: FlagReport) {
    if (!token || !flagPoint) return;
    setFlagBusy(true);
    try {
      const photoUrls = report.photoUrls && report.photoUrls.length > 0 && uid ? await uploadFlagPhotos(uid, report.photoUrls) : [];
      await submitFlag({type: report.type, lat: flagPoint.lat, lng: flagPoint.lng, radiusMeters: report.radiusMeters, note: report.note, ttlMinutes: report.ttlMinutes, ...(photoUrls.length > 0 ? {photoUrls} : {})}, token);
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
      void markVoted(uid, flagId);
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
      void markDenied(uid, flagId);
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
      safeCameraCall(() => cameraRef.current?.setStop({center: [next.lng, next.lat], duration: 500}));
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
    safeCameraCall(() => cameraRef.current?.setStop({center: [h.lng, h.lat], zoom: Math.max(zoom, 16), duration: 500}));
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
  return {activeVehicle, applyCenter, busy, cameraRef, canClear, cancelFlagReport, cardH, chatFlag, cycleHazard, deniedIds, dest, destText, drag, error, flagBusy, flagMode, flagPoint, flagWarnings, flagsKey, gpsBusy, gpsPos, hasVehicle, hazardFocusIdx, hazardHighlight, hazardZones, insets, lang, mapPickFor, navigation, onClear, onConfirmFlag, onConfirmMapPick, onDeleteStop, onDenyFlag, onLocate, onOpenSaved, onPickPlace, onRefreshAlertsQuiet, onRemoveFlag, onSave, onSaveRoute, onSelectRoute, onStart, onSubmitFlag, onSwap, onVehiclePress, origin, originText, pausedKey, result, routes, saveBusy, saveOpen, savedOpen, searchingFor, selectedFlag, selectedIndex, selectedMid, setCardH, setChatFlag, setDismissedPausedKey, setError, setFlagMode, setMapPickFor, setSaveOpen, setSavedOpen, setSearchingFor, setSelectedFlag, setSnack, setVehicleOpen, snack, starting, stops, t, theme, toggleFlagMode, token, uid, vehicleOpen, votedIds, widthBlocks};
}
