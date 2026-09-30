import {useEffect, useRef, useState} from "react";
import {ActivityIndicator, BackHandler, Keyboard, Modal, Platform, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {useNavigation} from "@react-navigation/native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {type CameraRef} from "@maplibre/maplibre-react-native";
import {findRoute, getSavedRoute, saveRoute, isFlagWarning, isHazardZone, isWidthBlock, type RouteOption} from "../api/routes";
import {windowAround} from "../services/navigation";
import {ensurePushConfigured, subscribeHazardPush, type HazardPushData} from "../services/push";
import {formatPoint, reverseLabel} from "../api/places";
import {toMessage} from "../api/client";
import type {Place} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import PlaceSearchScreen from "./PlaceSearchScreen";
import NavigationScreen from "./NavigationScreen";
import SavedRoutesSheet from "../components/SavedRoutesSheet";
import Snack from "../components/Snack";
import FlagSheet, {type FlagReport} from "../components/FlagSheet";
import FlagDetailSheet from "../components/FlagDetailSheet";
import {confirmFlag, denyFlag, submitFlag, unflag, type Flag} from "../api/flags";
import {markDenied, markVoted} from "../storage/votedFlags";
import {HCMC_CENTER, MAX_STOPS, type Point, type SearchField, type Stop} from "./route/types";
import {boundsOf, midOf} from "./route/routeGeo";
import {useRouteDrag} from "./route/useRouteDrag";
import {createTaskEpoch, type TaskEpoch} from "./route/taskEpoch";
import {shouldRetryCenter} from "./route/cameraIntent";
import RouteMapView from "./route/RouteMapView";
import RouteCard from "./route/RouteCard";
import VehiclePickerSheet from "../components/VehiclePickerSheet";
import {Fab, FabColumn} from "../components/Fab";
import {snackAbove} from "../components/snackOffset";

export default function RouteScreen() {
  const {t, lang} = useStrings();
  const {token, uid} = useAuth();
  const navigation = useNavigation();
  const {vehicles, activeVehicle, activateVehicle} = useProfile();
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
  const [saveName, setSaveName] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [searchingFor, setSearchingFor] = useState<SearchField | null>(null);
  const [starting, setStarting] = useState(false);
  const [navInitial, setNavInitial] = useState<{route: RouteOption; dest: Point; stops: Stop[]; seed: {lat: number; lng: number}} | null>(null);
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
  const snackBottom = searchingFor || flagMode || pickingFor ? insets.bottom + 24 : snackAbove(12, cardH);
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
  useEffect(() => {
    const key = origin && dest ? `${origin.lat},${origin.lng}|${dest.lat},${dest.lng}|${stops.length}` : "";
    if (!origin || !dest || routes.length > 0 || busy || starting || searchingFor || pickingFor || !token) return;
    if (autoFindRef.current === key && (autoFailAtRef.current === 0 || Date.now() - autoFailAtRef.current < 30000)) return;
    const timer = setTimeout(() => {
      autoFindRef.current = key;
      autoFailAtRef.current = 0;
      void requestRoute(origin, dest, stops, undefined, undefined, true).then((r) => {
        if (!r) autoFailAtRef.current = Date.now();
      });
    }, 600);
    return () => clearTimeout(timer);
  });
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
      const after = next[0] ? JSON.stringify(next[0].geometry.coordinates) : before;
      setSnack(after !== before ? t.flag.rerouted : t.route.hazardUpdated);
    } catch {
      return;
    }
  }
  function onNavExit() {
    setNavInitial(null);
    if (!centeredRef.current) void centerOnLocal();
  }
  async function onStart() {
    if (!token || !dest || starting) return;
    setStarting(true);
    setError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location denied");
      if (Platform.OS === "android") {
        const bg = await Location.requestBackgroundPermissionsAsync().catch(() => null);
        if (bg && bg.status !== "granted") setSnack(t.more.bgTrackingOff);
      }
      const live = await freshFix();
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
      setNavInitial({route: first, dest, stops, seed: live});
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
  const LOCATION_TIMEOUT_MS = 8000;
  const CENTER_RETRIES = 3;
  const CENTER_RETRY_MS = 4000;
  async function freshFix(): Promise<{lat: number; lng: number}> {
    const raced = await Promise.race([
      Location.getCurrentPositionAsync({accuracy: Location.Accuracy.BestForNavigation}),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), LOCATION_TIMEOUT_MS)),
    ]);
    if (raced) return {lat: raced.coords.latitude, lng: raced.coords.longitude};
    const last = await Location.getLastKnownPositionAsync({maxAge: 60000, requiredAccuracy: 100});
    if (last) return {lat: last.coords.latitude, lng: last.coords.longitude};
    throw new Error("Location unavailable");
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
  async function centerOnLocal(): Promise<void> {
    for (let attempt = 0; shouldRetryCenter(centeredRef.current, attempt, CENTER_RETRIES); attempt++) {
      if (attempt > 0) await new Promise<void>((resolve) => setTimeout(resolve, CENTER_RETRY_MS));
      try {
        const {status} = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        if (!pendingCenterRef.current) {
          try {
            const last = await Location.getLastKnownPositionAsync({maxAge: 60000, requiredAccuracy: 100});
            if (last) pendingCenterRef.current = {lat: last.coords.latitude, lng: last.coords.longitude};
          } catch {}
          if (!pendingCenterRef.current) {
            const live = await freshFix();
            pendingCenterRef.current = {lat: live.lat, lng: live.lng};
          }
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
    ensurePushConfigured();
    return subscribeHazardPush((data: HazardPushData) => {
      setFlagsKey((k) => k + 1);
      if (data.removed) {
        setSelectedFlag((cur) => (cur?.id === data.flagId ? null : cur));
        setSnack(t.flag.clearedMsg);
      }
      void quietRef.current();
    }, "route");
  }, []);
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: {display: searchingFor ? "none" : "flex"},
      headerShown: false,
    });
    return () => {
      navigation.setOptions({tabBarStyle: {display: "flex"}, headerShown: true});
    };
  }, [navigation, searchingFor]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (selectedFlag) {
        setSelectedFlag(null);
        return true;
      }
      if (flagPoint) {
        cancelFlagReport();
        return true;
      }
      if (savedOpen) {
        Keyboard.dismiss();
        setSavedOpen(false);
        return true;
      }
      if (searchingFor) {
        setSearchingFor(null);
        return true;
      }
      if (pickingFor) {
        cancelPick();
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [savedOpen, searchingFor, pickingFor, selectedFlag, flagPoint]);
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
      const next = await freshFix();
      setGpsPos(next);
      void cameraRef.current?.setStop({center: [next.lng, next.lat], duration: 500});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setGpsBusy(false);
    }
  }
  function onClear() {    setOrigin(null);
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
  async function onSave() {
    if (!token || !origin || !dest || !result) return;
    setSaveName("");
    setSaveOpen(true);
  }
  async function onSaveRoute() {
    if (!token || !origin || !dest || !result) return;
    Keyboard.dismiss();
    setSaveBusy(true);
    setError(null);
    try {
      await saveRoute({name: saveName.trim() || undefined, originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng, stops: stops.map((stop) => ({lat: stop.lat, lng: stop.lng})), width: activeVehicle?.baseWidth, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds, source: result.source, geometry: result.geometry}, token);
      setSaveOpen(false);
      setSaveName("");
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
        lang={lang}
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
          <Fab theme={theme} variant="danger" size={36} label={t.common.close} onPress={toggleFlagMode} style={{position: "absolute", top: insets.top + 12, left: 12, zIndex: 10, elevation: 4}}>
            <MaterialIcons name="close" size={20} color="#fff" />
          </Fab>
        ) : (
          <Fab theme={theme} label={t.route.flagMode} onPress={toggleFlagMode} style={{position: "absolute", top: insets.top + 12, left: 12, zIndex: 10, elevation: 4}}>
            <MaterialIcons name="add-alert" size={22} color={theme.primary} />
          </Fab>
        )
      ) : null}
      {!pickingFor && !flagMode && !selectedFlag ? (
      <>
      <FabColumn bottom={cardH + 92}>
        {canClear ? (
          <Fab theme={theme} variant="danger" size={36} label={t.route.clear} onPress={onClear}>
            <MaterialIcons name="close" size={20} color="#fff" />
          </Fab>
        ) : null}
        {result && flagWarnings.length > 0 ? (
          <Fab theme={theme} variant={hazardFocusIdx >= 0 ? "primary" : "paper"} label={t.nav.hazardFocus} onPress={cycleHazard}>
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
          <Fab theme={theme} label={t.common.currentLocation} disabled={gpsBusy} onPress={() => void onLocate()}>
            {gpsBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={22} color={theme.primary} />}
          </Fab>
        </View>
        <View onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
        <RouteCard
          t={t}
          theme={theme}
          originText={originText}
          destText={destText}
          stops={stops}
          result={result}
          origin={origin}
          dest={dest}
          activeVehicle={activeVehicle}
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
        <View style={styles.sheetRoot} pointerEvents="box-none">
          <View style={styles.sheetWrap}>
            <VehiclePickerSheet t={t} theme={theme} token={token} activeId={activeVehicle?.id ?? null} onPick={(id) => void onVehiclePress(id)} onClose={() => setVehicleOpen(false)} />
          </View>
        </View>
      ) : null}
      {searchingFor ? (
        <View style={styles.fullScreen}>
          <PlaceSearchScreen
              t={t}
              token={token ?? undefined}
              lang={lang}
              title={searchingFor === "origin" ? t.route.origin : searchingFor === "destination" ? t.route.destination : t.route.stop}
              placeholder={searchingFor === "origin" ? t.route.searchOrigin : searchingFor === "destination" ? t.route.searchDestination : t.route.searchStop}
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
        </View>
      ) : null}
      {savedOpen ? (
        <View style={styles.centerRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { Keyboard.dismiss(); setSavedOpen(false); }} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={styles.centerWrap}>
            <SavedRoutesSheet t={t} token={token} onOpen={(id) => void onOpenSaved(id)} onClose={() => setSavedOpen(false)} />
          </View>
        </View>
      ) : null}
      <Modal visible={saveOpen} transparent animationType="fade" onRequestClose={() => { Keyboard.dismiss(); setSaveOpen(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {backgroundColor: theme.paper}]}>
            <Text style={[styles.modalTitle, {color: theme.text}]}>{t.route.saveRoute}</Text>
            <TextInput style={[styles.modalInput, {borderColor: theme.border, color: theme.text}]} value={saveName} onChangeText={setSaveName} maxLength={120} autoFocus placeholder={t.route.routeName} placeholderTextColor={theme.muted} />
            <View style={styles.modalActions}>
              <Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => { Keyboard.dismiss(); setSaveOpen(false); }}>
                <Text style={{color: theme.text}}>{t.common.close}</Text>
              </Pressable>
              <Pressable style={[styles.chip, {backgroundColor: theme.primary, borderColor: theme.primary}, saveBusy && styles.disabled]} disabled={saveBusy} onPress={() => void onSaveRoute()}>
                {saveBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color: "#fff", fontWeight: "700"}}>{t.common.save}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {error ? (
        <Snack message={error} severity="error" sticky bottom={snackBottom} dangerColor={theme.danger} onHide={() => setError(null)} />
      ) : snack ? (
        <Snack message={snack} severity="confirm" bottom={snackBottom} accentColor={theme.primary} onHide={() => setSnack(null)} />
      ) : (
        <Snack
          message={
            drag.dragging
              ? t.route.dragHint
              : pickingFor
                ? t.route.pickOnMap
                : flagMode && !flagPoint
                  ? t.route.flagHint
                  : null
          }
          sticky
          bottom={snackBottom}
          onHide={() => {}}
        />
      )}
      {flagPoint ? (
        <View style={styles.centerRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={cancelFlagReport} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={styles.centerWrap}>
            <FlagSheet t={t} lat={flagPoint.lat} lng={flagPoint.lng} busy={flagBusy} centered onClose={cancelFlagReport} onSubmit={(r) => void onSubmitFlag(r)} />
          </View>
        </View>
      ) : null}
      {selectedFlag ? (
        <View style={styles.centerRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSelectedFlag(null)} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={styles.centerWrap}>
            <FlagDetailSheet
              t={t}
              flag={selectedFlag}
              isOwn={uid != null && selectedFlag.reporterId === uid}
              busy={flagBusy}
              voted={votedIds.has(selectedFlag.id)}
              denied={deniedIds.has(selectedFlag.id)}
              onClose={() => setSelectedFlag(null)}
              onConfirm={(id) => void onConfirmFlag(id)}
              onDeny={(id) => void onDenyFlag(id)}
              onRemove={(id) => void onRemoveFlag(id)}
            />
          </View>
        </View>
      ) : null}
      <Modal visible={navInitial !== null} animationType="slide" onRequestClose={onNavExit}>
        {navInitial && token ? (
          <NavigationScreen
            t={t}
            lang={lang}
            token={token}
            initialRoute={navInitial.route}
            dest={navInitial.dest}
            seed={navInitial.seed}
            stops={navInitial.stops.map((s) => ({lat: s.lat, lng: s.lng}))}
            width={activeVehicle?.baseWidth}
            vehicleType={activeVehicle?.type}
            onExit={onNavExit}
          />
        ) : null}
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1},
  fullScreen: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20, elevation: 6},
  savedRoot: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)"},
  centerRoot: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.6)"},
  centerWrap: {width: "100%", paddingHorizontal: 24},
  sheetWrap: {width: "100%"},
  sheetRoot: {position: "absolute", left: 12, right: 12, bottom: 12},
  bottomContainer: {position: "absolute", left: 12, right: 12, bottom: 12, gap: 8},
  fabRow: {flexDirection: "row", alignItems: "center", gap: 8},
  fabSpacer: {flex: 1},
  hazardNumber: {fontSize: 20, fontWeight: "700", textAlign: "center"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  disabled: {opacity: 0.6},
  modalOverlay: {flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24},
  modalCard: {borderRadius: 16, padding: 16, gap: 12},
  modalTitle: {fontSize: 16, fontWeight: "700"},
  modalInput: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  modalActions: {flexDirection: "row", justifyContent: "flex-end", gap: 8},
});
