import {useEffect, useRef, useState} from "react";
import {ActivityIndicator, BackHandler, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View, useColorScheme} from "react-native";
import {useNavigation} from "@react-navigation/native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {Camera, Images, LineLayer, MapView, ShapeSource, SymbolLayer, type CameraRef} from "@maplibre/maplibre-react-native";
import {findRoute, getSavedRoute, saveRoute, isHazardZone, isWidthBlock, type RouteOption} from "../api/routes";
import {formatPoint, reverseLabel} from "../api/places";
import {toMessage} from "../api/client";
import type {Place} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {maptilerStyleUrl} from "../map/style";
import {darkTheme, lightTheme} from "../theme";
import PlaceSearchScreen from "./PlaceSearchScreen";
import NavigationScreen from "./NavigationScreen";
import SavedRoutesSheet from "../components/SavedRoutesSheet";
import Snack from "../components/Snack";
type Point = {lat: number; lng: number};
type Stop = {label: string; lat: number; lng: number};
type DragTarget = "origin" | "destination" | "handle";
type CamState = {center: [number, number]; zoom: number; ne: [number, number]; sw: [number, number]; w: number; h: number} | null;
const HCMC_CENTER: [number, number] = [106.6602, 10.7626];
const MAX_STOPS = 10;
const ARM_RADIUS = 48;
const PILL_LIFT_PX = 34;
const fmtDist = (n: number) => n.toFixed(n < 10 ? 1 : 0);
function vehicleIcon(type?: string): "motorbike" | "car" | "van-utility" | "truck" {
  if (type === "CAR") return "car";
  if (type === "VAN") return "van-utility";
  if (type === "TRUCK") return "truck";
  return "motorbike";
}
function boundsOf(coords: [number, number][]): {ne: [number, number]; sw: [number, number]} | null {
  if (coords.length === 0) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return {ne: [maxLng, maxLat], sw: [minLng, minLat]};
}
function midOf(coords: [number, number][]): [number, number] | null {
  if (coords.length === 0) return null;
  return coords[Math.floor(coords.length / 2)] ?? null;
}
function pillPointAbove(mid: [number, number], zoom: number, liftPx: number): [number, number] {
  const mpp = (156543.03392 * Math.cos((mid[1] * Math.PI) / 180)) / Math.pow(2, zoom);
  return [mid[0], mid[1] + (liftPx * mpp) / 111320];
}
function pointFeature(lng: number, lat: number) {
  return {type: "Feature" as const, geometry: {type: "Point" as const, coordinates: [lng, lat] as [number, number]}, properties: {}};
}
export default function RouteScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const navigation = useNavigation();
  const {vehicles, activeVehicle, activateVehicle} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const cameraRef = useRef<CameraRef | null>(null);
  const seqRef = useRef(0);
  const shouldFitRef = useRef(false);
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
  const [searchingFor, setSearchingFor] = useState<"origin" | "destination" | "stop" | null>(null);
  const [starting, setStarting] = useState(false);
  const [navInitial, setNavInitial] = useState<{route: RouteOption; dest: Point; stops: Stop[]} | null>(null);
  const [pickingFor, setPickingFor] = useState<"origin" | "destination" | "stop" | null>(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const [mapZoom, setMapZoom] = useState(13);
  const camRef = useRef<CamState>(null);
  const liveRef = useRef({origin: null as Point | null, dest: null as Point | null, stops: [] as Stop[], routes: [] as RouteOption[], selectedIndex: 0, busy: false});
  const result = routes[selectedIndex] ?? null;
  const selectedMid = result ? midOf(result.geometry.coordinates) : null;
  const hazardZones = (result?.hazards ?? []).filter(isHazardZone);
  const widthBlocks = (result?.warnings ?? []).filter(isWidthBlock);
  const canClear = !!origin || !!dest || stops.length > 0 || routes.length > 0;
  const pillBgActive = scheme === "dark" ? "pill-active-dark" : "pill-active-light";
  const pillOrder = routes.map((_, i) => i).filter((i) => i !== selectedIndex);
  if (routes[selectedIndex]) pillOrder.push(selectedIndex);
  liveRef.current = {origin, dest, stops, routes, selectedIndex, busy};
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: {display: searchingFor ? "none" : "flex"},
      headerShown: !searchingFor,
    });
    return () => {
      navigation.setOptions({tabBarStyle: {display: "flex"}, headerShown: true});
    };
  }, [navigation, searchingFor]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (savedOpen) {
        setSavedOpen(false);
        return true;
      }
      if (searchingFor) {
        setSearchingFor(null);
        return true;
      }
      if (pickingFor) {
        setPickingFor(null);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [savedOpen, searchingFor, pickingFor]);
  useEffect(() => {
    if (!shouldFitRef.current || routes.length === 0) return;
    shouldFitRef.current = false;
    const sel = routes[selectedIndex] ?? routes[0];
    if (!sel) return;
    const b = boundsOf(sel.geometry.coordinates);
    if (b) cameraRef.current?.fitBounds(b.ne, b.sw, [80, 60, 340, 60], 800);
  });
  async function requestRoute(o: Point | null, d: Point | null, s: Stop[], width?: number, vehicleType?: string) {
    if (!token || !o || !d) return;
    const id = (seqRef.current += 1);
    setBusy(true);
    setError(null);
    try {
      const res = await findRoute({originLat: o.lat, originLng: o.lng, destLat: d.lat, destLng: d.lng, stops: s.map((stop) => ({lat: stop.lat, lng: stop.lng})), width: width ?? activeVehicle?.baseWidth, vehicleType: vehicleType ?? activeVehicle?.type}, token);
      if (seqRef.current !== id) return;
      setRoutes(res.routes ?? []);
      setSelectedIndex(0);
    } catch (err) {
      if (seqRef.current === id) setError(toMessage(err));
    } finally {
      if (seqRef.current === id) setBusy(false);
    }
  }
  async function onFind() {
    shouldFitRef.current = true;
    await requestRoute(origin, dest, stops);
  }
  async function onStart() {
    if (!token || !dest || starting) return;
    setStarting(true);
    setError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location denied");
      const fix = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
      const live = {lat: fix.coords.latitude, lng: fix.coords.longitude};
      const res = await findRoute(
        {originLat: live.lat, originLng: live.lng, destLat: dest.lat, destLng: dest.lng, stops: stops.map((s) => ({lat: s.lat, lng: s.lng})), width: activeVehicle?.baseWidth, vehicleType: activeVehicle?.type},
        token,
      );
      const first = res.routes?.[0];
      if (!first) throw new Error(t.route.noResults);
      setRoutes(res.routes ?? []);
      setSelectedIndex(0);
      setNavInitial({route: first, dest, stops});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setStarting(false);
    }
  }
  function onPickPlace(place: Place, field: "origin" | "destination" | "stop" | null = searchingFor) {
    if (field === "origin") {
      const next = {lat: place.lat, lng: place.lng};
      setOrigin(next);
      setOriginText(place.label);
      if (routes.length > 0 && dest) {
        shouldFitRef.current = true;
        void requestRoute(next, dest, stops);
      }
    } else if (field === "destination") {
      const next = {lat: place.lat, lng: place.lng};
      setDest(next);
      setDestText(place.label);
      if (routes.length > 0 && origin) {
        shouldFitRef.current = true;
        void requestRoute(origin, next, stops);
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
      cameraRef.current?.setCamera({centerCoordinate: [place.lng, place.lat], zoomLevel: 15, animationDuration: 500});
    }
    setSearchingFor(null);
  }
  function onRegionChange(e: unknown) {
    const f = e as {geometry?: {coordinates?: [number, number]}; properties?: {zoomLevel?: number; visibleBounds?: [[number, number], [number, number]]}};
    const c = f.geometry?.coordinates;
    const b = f.properties?.visibleBounds;
    if (!c || !b || !b[0] || !b[1]) return;
    const prev = camRef.current;
    camRef.current = {center: [c[0], c[1]], zoom: f.properties?.zoomLevel ?? 13, ne: [b[0][0], b[0][1]], sw: [b[1][0], b[1][1]], w: prev?.w ?? 0, h: prev?.h ?? 0};
  }
  function onRegionDid(e: unknown) {
    onRegionChange(e);
    const z = camRef.current?.zoom;
    if (z != null) setMapZoom((prev) => (prev === z ? prev : z));
  }
  function project(lng: number, lat: number): {x: number; y: number} | null {
    const cam = camRef.current;
    if (!cam || cam.w <= 0) return null;
    const spanLng = cam.ne[0] - cam.sw[0];
    const spanLat = cam.ne[1] - cam.sw[1];
    if (spanLng <= 0 || spanLat <= 0) return null;
    return {x: ((lng - cam.sw[0]) / spanLng) * cam.w, y: ((cam.ne[1] - lat) / spanLat) * cam.h};
  }
  function markersScreen(): {t: DragTarget; at: Point; lift: number}[] {
    const live = liveRef.current;
    const out: {t: DragTarget; at: Point; lift: number}[] = [];
    if (live.origin) out.push({t: "origin", at: live.origin, lift: 0});
    if (live.dest) out.push({t: "destination", at: live.dest, lift: 0});
    const sel = live.routes[live.selectedIndex] ?? null;
    const mid = sel ? midOf(sel.geometry.coordinates) : null;
    if (mid) out.push({t: "handle", at: {lat: mid[1], lng: mid[0]}, lift: 0});
    return out;
  }
  function nearestMarker(lng: number, lat: number, radius: number): DragTarget | null {
    const p = project(lng, lat);
    if (!p) return null;
    let best: DragTarget | null = null;
    let bestDist = radius;
    for (const m of markersScreen()) {
      const mp = project(m.at.lng, m.at.lat);
      if (!mp) continue;
      const d = Math.hypot(mp.x - p.x, mp.y + m.lift - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = m.t;
      }
    }
    return best;
  }
  async function onPickMapPoint(lat: number, lng: number) {
    const field = pickingFor;
    if (!field || pickBusy || busy) return;
    if (field === "stop" && stops.length >= MAX_STOPS) {
      setPickingFor(null);
      return;
    }
    setPickBusy(true);
    try {
      const label = await reverseLabel(lat, lng, lang);
      onPickPlace({label, lat, lng, source: "map"}, field);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setPickBusy(false);
      setPickingFor(null);
    }
  }
  function onMapPress(e: unknown) {
    if (busy || dragging) return;
    const coords = (e as {geometry?: {coordinates?: [number, number]}}).geometry?.coordinates;
    if (!coords) return;
    if (pickingFor) {
      void onPickMapPoint(coords[1], coords[0]);
      return;
    }
    const hit = nearestMarker(coords[0], coords[1], ARM_RADIUS);
    if (hit) setDragging(hit);
  }
  const grantRef = useRef<{target: DragTarget; base: Point} | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  dragTargetRef.current = dragging;
  const dragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      const live = liveRef.current;
      const target = dragTargetRef.current;
      if (!target) return false;
      const m = markersScreen().find((k) => k.t === target);
      const base = target === "origin" ? live.origin : target === "destination" ? live.dest : m?.at ?? null;
      if (!m || !base) {
        setDragging(null);
        return false;
      }
      const mp = project(base.lng, base.lat);
      if (!mp) return false;
      const nx = (evt.nativeEvent as {locationX?: number}).locationX ?? 0;
      const ny = (evt.nativeEvent as {locationY?: number}).locationY ?? 0;
      if (Math.hypot(mp.x - nx, mp.y + m.lift - ny) > ARM_RADIUS * 1.5) {
        setDragging(null);
        return false;
      }
      grantRef.current = {target, base: {...base}};
      return true;
    },
    onPanResponderMove: (_, gs) => {
      const g = grantRef.current;
      const cam = camRef.current;
      if (!g || !cam) return;
      const dLng = (gs.dx / cam.w) * (cam.ne[0] - cam.sw[0]);
      const dLat = (-gs.dy / cam.h) * (cam.ne[1] - cam.sw[1]);
      const next = {lat: g.base.lat + dLat, lng: g.base.lng + dLng};
      if (g.target === "origin") {
        setOrigin(next);
        setOriginText(formatPoint(next.lat, next.lng));
      } else if (g.target === "destination") {
        setDest(next);
        setDestText(formatPoint(next.lat, next.lng));
      } else {
        setDragPos(next);
      }
    },
    onPanResponderRelease: (_, gs) => {
      const g = grantRef.current;
      const cam = camRef.current;
      grantRef.current = null;
      setDragging(null);
      setDragPos(null);
      if (!g || !cam) return;
      if (Math.hypot(gs.dx, gs.dy) < 8) return;
      const dLng = (gs.dx / cam.w) * (cam.ne[0] - cam.sw[0]);
      const dLat = (-gs.dy / cam.h) * (cam.ne[1] - cam.sw[1]);
      const next = {lat: g.base.lat + dLat, lng: g.base.lng + dLng};
      const live = liveRef.current;
      if (live.busy) return;
      if (g.target === "origin") {
        setOrigin(next);
        setOriginText(formatPoint(next.lat, next.lng));
        if (live.routes.length > 0 && live.dest) void requestRoute(next, live.dest, live.stops);
      } else if (g.target === "destination") {
        setDest(next);
        setDestText(formatPoint(next.lat, next.lng));
        if (live.routes.length > 0 && live.origin) void requestRoute(live.origin, next, live.stops);
      } else if (live.origin && live.dest && live.stops.length < MAX_STOPS) {
        const updated = [...live.stops, {label: formatPoint(next.lat, next.lng), lat: next.lat, lng: next.lng}];
        setStops(updated);
        void requestRoute(live.origin, live.dest, updated);
      }
    },
    onPanResponderTerminate: () => {
      grantRef.current = null;
      setDragging(null);
      setDragPos(null);
    },
  })).current;
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
      shouldFitRef.current = true;
      void requestRoute(dest, o, reversed);
    }
  }
  function onClear() {
    setOrigin(null);
    setDest(null);
    setOriginText("");
    setDestText("");
    setStops([]);
    setRoutes([]);
    setSelectedIndex(0);
    setError(null);
  }
  async function onVehiclePress(id: string) {
    setVehicleOpen(false);
    try {
      await activateVehicle(id);
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
    setSaveBusy(true);
    setError(null);
    try {
      await saveRoute({name: saveName.trim() || undefined, originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng, stops: stops.map((stop) => ({lat: stop.lat, lng: stop.lng})), width: activeVehicle?.baseWidth, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds, source: result.source, geometry: result.geometry}, token);
      setSaveOpen(false);
      setSaveName("");
      setSnack(t.route.savedMsg);
    } catch (err) {
      setSaveOpen(false);
      setSnack(toMessage(err));
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
      shouldFitRef.current = true;
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
      const prev = camRef.current;
      camRef.current = {...(prev ?? {center: HCMC_CENTER, zoom: 13, ne: [0, 0] as [number, number], sw: [0, 0] as [number, number]}), w: width, h: height};
    }}>
      <MapView style={StyleSheet.absoluteFill} mapStyle={maptilerStyleUrl} logoEnabled={false} attributionEnabled={false} onPress={(e: unknown) => onMapPress(e)} onRegionIsChanging={(e: unknown) => onRegionChange(e)} onRegionDidChange={(e: unknown) => onRegionDid(e)} scrollEnabled={!dragging} zoomEnabled={!dragging}>
        <Camera ref={cameraRef} centerCoordinate={HCMC_CENTER} zoomLevel={13} />
        <Images images={{
          "a-dot": require("../../assets/map/a-dot.png"),
          "b-dot": require("../../assets/map/b-dot.png"),
          "stop-dot": require("../../assets/map/stop-dot.png"),
          "pill-active-light": require("../../assets/map/pill-active-light.png"),
          "pill-active-dark": require("../../assets/map/pill-active-dark.png"),
          "pill-idle": require("../../assets/map/pill-idle.png"),
          "handle2-dot": require("../../assets/map/handle2-dot.png"),
        }} />
        <ShapeSource id="z-anchor" shape={{type: "FeatureCollection" as const, features: []}}><LineLayer id="z-anchor-line" style={{lineColor: "#000000", lineWidth: 1, lineOpacity: 0}} /></ShapeSource>
        {routes.map((r, i) => i === selectedIndex ? null : (
          <ShapeSource key={`route-${i}`} id={`route-${i}`} shape={{type: "Feature", geometry: r.geometry, properties: {}}}><LineLayer id={`routeLine-${i}`} belowLayerID="z-anchor-line" style={{lineColor: "#94a3b8", lineWidth: 3, lineOpacity: 0.6, lineCap: "round", lineJoin: "round"}} /></ShapeSource>
        ))}
        {result ? <ShapeSource id="route" shape={{type: "Feature", geometry: result.geometry, properties: {}}}><LineLayer id="routeLine" belowLayerID="z-anchor-line" style={{lineColor: theme.primary, lineWidth: 4, lineOpacity: 0.8, lineCap: "round", lineJoin: "round"}} /></ShapeSource> : null}
        {origin ? <ShapeSource id="marker-a" shape={pointFeature(origin.lng, origin.lat)}><SymbolLayer id="marker-a-icon" style={{iconImage: "a-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} /></ShapeSource> : null}
        {dest ? <ShapeSource id="marker-b" shape={pointFeature(dest.lng, dest.lat)}><SymbolLayer id="marker-b-icon" style={{iconImage: "b-dot", iconSize: 0.33, iconAllowOverlap: true, iconIgnorePlacement: true}} /></ShapeSource> : null}
        {stops.map((s, i) => (
          <ShapeSource key={`stop-${s.lat},${s.lng},${i}`} id={`stop-${s.lat},${s.lng},${i}`} shape={pointFeature(s.lng, s.lat)}>
            <SymbolLayer id={`stop-icon-${s.lat},${s.lng},${i}`} style={{iconImage: "stop-dot", iconSize: 0.3, iconAllowOverlap: true, iconIgnorePlacement: true}} />
            <SymbolLayer id={`stop-label-${s.lat},${s.lng},${i}`} style={{textField: String(i + 1), textSize: 12, textColor: "#ffffff", textAnchor: "center", textAllowOverlap: true, textIgnorePlacement: true}} />
          </ShapeSource>
        ))}
        {pillOrder.map((i) => {
          const r = routes[i];
          if (!r) return null;
          const mid = midOf(r.geometry.coordinates);
          if (!mid) return null;
          const active = i === selectedIndex;
          const label = `${fmtDist(r.distanceMeters / 1000)} ${t.route.km} · ${fmtDist(r.durationSeconds / 60)} ${t.route.min}`;
          const bg = active ? pillBgActive : "pill-idle";
          const sid = `pill-${i}`;
          const pp = pillPointAbove(mid, mapZoom, PILL_LIFT_PX);
          return (
            <ShapeSource key={sid} id={sid} shape={pointFeature(pp[0], pp[1])} onPress={active ? undefined : () => setSelectedIndex(i)}>
              <SymbolLayer id={sid} style={{iconImage: bg, iconSize: 1, iconAnchor: "center", iconTextFit: "both", iconTextFitPadding: [9, 18, 9, 18], textField: label, textSize: 15, textColor: "#ffffff", textAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true, textAllowOverlap: true, textIgnorePlacement: true}} />
            </ShapeSource>
          );
        })}
        {result && (dragPos ?? selectedMid) ? (
          <ShapeSource id="reshape-handle" shape={pointFeature((dragPos ? dragPos.lng : selectedMid![0]), (dragPos ? dragPos.lat : selectedMid![1]))}>
            <SymbolLayer id="reshape-handle-icon" style={{iconImage: "handle2-dot", iconSize: 0.33, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}} />
          </ShapeSource>
        ) : null}
      </MapView>
      {routes.length > 1 ? (
        <View style={styles.topBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topBarContent}>
            {routes.map((r, i) => (
              <Pressable key={i} style={[styles.pill, {backgroundColor: i === selectedIndex ? theme.primary : theme.paper, borderColor: theme.border}]} onPress={() => setSelectedIndex(i)}>
                <Text style={{color: i === selectedIndex ? "#fff" : theme.text, fontWeight: "700"}}>{i + 1} · {(r.distanceMeters / 1000).toFixed(1)} {t.route.km} · {Math.round(r.durationSeconds / 60)} {t.route.min}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
      {dragging ? <View style={StyleSheet.absoluteFill} {...dragPan.panHandlers} /> : null}
      {dragging ? (
        <View style={styles.dragHint} pointerEvents="none">
          <Text style={styles.dragHintText}>{t.route.dragHint}</Text>
        </View>
      ) : null}
      {pickingFor ? (
        <Pressable style={[styles.pickChipTop, {backgroundColor: theme.paper, borderColor: theme.primary, top: routes.length > 1 ? 64 : 12}]} onPress={() => setPickingFor(null)}>
          {pickBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <Text style={{color: theme.primary, fontWeight: "700"}}>{t.route.pickOnMap} · {pickingFor === "origin" ? "A" : pickingFor === "destination" ? "B" : "+"}</Text>}
        </Pressable>
      ) : null}
      {!pickingFor ? (
      <View style={styles.bottomContainer}>
        <Pressable style={[styles.savedFab, {backgroundColor: theme.paper, borderColor: theme.border}, !token && styles.disabled]} disabled={!token || busy} onPress={() => setSavedOpen(true)} accessibilityRole="button" accessibilityLabel={t.saved.title}>
          <MaterialIcons name="bookmark-border" size={22} color={token ? theme.primary : theme.muted} />
        </Pressable>
        {canClear ? (
          <Pressable style={[styles.clearFab, {backgroundColor: theme.danger}]} onPress={onClear} accessibilityRole="button" accessibilityLabel={t.route.clear}>
            <MaterialIcons name="close" size={20} color="#fff" />
          </Pressable>
        ) : null}
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.row}>
            <View style={styles.fieldCol}>
              <Text style={[styles.fieldLabel, {color: theme.text}]} numberOfLines={1}>A · {t.route.origin}</Text>
              <Pressable style={[styles.input, styles.selectBtn, {borderColor: theme.border}]} onPress={() => { setPickingFor(null); setSearchingFor("origin"); }}><Text style={{color: originText ? theme.text : theme.muted}} numberOfLines={1}>{originText || t.route.selectOrigin}</Text></Pressable>
            </View>
            <Pressable style={[styles.swapBtn, {borderColor: theme.border}]} onPress={onSwap}>
              <Text style={{color: theme.primary}}>⇄</Text>
            </Pressable>
            <View style={styles.fieldCol}>
              <Text style={[styles.fieldLabel, {color: theme.text}]} numberOfLines={1}>B · {t.route.destination}</Text>
              <Pressable style={[styles.input, styles.selectBtn, {borderColor: theme.border}]} onPress={() => { setPickingFor(null); setSearchingFor("destination"); }}><Text style={{color: destText ? theme.text : theme.muted}} numberOfLines={1}>{destText || t.route.selectDestination}</Text></Pressable>
            </View>
          </View>
          {stops.length > 0 ? (
            <View style={styles.stopRow}>
              {stops.map((s, i) => (
                <Pressable key={`${s.lat},${s.lng},${i}`} style={[styles.chip, {borderColor: theme.primary}]} onPress={() => onDeleteStop(i)}><Text style={{color: theme.primary}}>{i + 1} · ×</Text></Pressable>
              ))}
            </View>
          ) : null}
          {stops.length < MAX_STOPS ? (
            <Pressable style={[styles.addStopBtn, {borderColor: theme.primary}]} onPress={() => { setPickingFor(null); setSearchingFor("stop"); }}>
              <MaterialIcons name="add" size={18} color={theme.primary} />
              <Text style={{color: theme.primary, fontWeight: "600"}}>{t.route.addStop}</Text>
            </Pressable>
          ) : null}
          <Pressable style={[styles.input, styles.selectBtn, {borderColor: theme.border}]} onPress={() => setVehicleOpen(true)}>
            <View style={styles.vehicleBtnRow}>
              <MaterialCommunityIcons name={vehicleIcon(activeVehicle?.type)} size={20} color={theme.primary} />
              <Text style={[styles.vehicleBtnText, {color: activeVehicle ? theme.text : theme.muted}]} numberOfLines={1}>{activeVehicle ? `${t.vehicle.types[activeVehicle.type as keyof typeof t.vehicle.types] ?? activeVehicle.type} · ${activeVehicle.baseWidth}m` : t.route.selectVehicle}</Text>
              <MaterialIcons name="expand-more" size={20} color={theme.muted} />
            </View>
          </Pressable>
          {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
          {result ? (
            <View style={styles.actionRow}>
              <Pressable style={[styles.primary, {backgroundColor: theme.primary}, (busy || starting) && styles.disabled]} disabled={busy || starting} onPress={() => void onStart()}>{starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.nav.start}</Text>}</Pressable>
              <Pressable style={[styles.primary, styles.saveBtn, {borderColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onSave()}><Text style={[styles.primaryText, {color: theme.primary}]}>{t.route.saveRoute}</Text></Pressable>
            </View>
          ) : origin && dest && activeVehicle ? (
            <Pressable style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onFind()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.route.find}</Text>}</Pressable>
          ) : null}
          {hazardZones.length > 0 || widthBlocks.length > 0 ? (
            <View style={[styles.resultCard, {borderColor: theme.border}]}>
              {hazardZones.length > 0 ? (
                <View style={styles.warnBox}>
                  <Text style={[styles.warnTitle, {color: theme.danger}]}>{t.route.suggestedTitle}</Text>
                  {hazardZones.map((h) => (
                    <Text key={h.flagId} style={{color: theme.text}}>{h.type ?? "?"} ({h.radiusMeters}m{h.note ? ` · ${h.note}` : ""})</Text>
                  ))}
                </View>
              ) : null}
              {widthBlocks.length > 0 ? (
                <View style={styles.warnBox}>
                  <Text style={[styles.warnTitle, {color: theme.danger}]}>{t.route.widthBlocked}</Text>
                  {widthBlocks.map((w) => (
                    <Text key={w.segmentId} style={{color: theme.text}}>{w.segmentId} ({w.baseWidth}m)</Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={[styles.attribution, {color: theme.muted}]}>{t.route.geoAttribution}</Text>
        </View>
      </View>
      ) : null}
      <Modal visible={vehicleOpen} transparent animationType="fade" onRequestClose={() => setVehicleOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {backgroundColor: theme.paper}]}>
            {vehicles.length === 0 ? <Text style={{color: theme.muted}}>{t.route.vehicleCta}</Text> : vehicles.map((v) => (
              <Pressable key={v.id} style={styles.vehicleRow} onPress={() => void onVehiclePress(v.id)}>
                <MaterialCommunityIcons name={vehicleIcon(v.type)} size={20} color={theme.primary} />
                <Text style={[styles.vehicleRowText, {color: theme.text}]}>{t.vehicle.types[v.type as keyof typeof t.vehicle.types] ?? v.type} · {v.baseWidth}m</Text>
                {activeVehicle?.id === v.id ? <MaterialIcons name="check" size={20} color={theme.primary} /> : null}
              </Pressable>
            ))}
            <Pressable style={[styles.chip, styles.modalClose, {borderColor: theme.border}]} onPress={() => setVehicleOpen(false)}><Text style={{color: theme.text}}>{t.common.close}</Text></Pressable>
          </View>
        </View>
      </Modal>
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
                setSearchingFor(null);
                setPickingFor(f);
              }}
              onClose={() => setSearchingFor(null)}
            />
        </View>
      ) : null}
      {savedOpen ? (
        <View style={styles.savedRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSavedOpen(false)} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={styles.sheetWrap}>
            <SavedRoutesSheet t={t} token={token} onOpen={(id) => void onOpenSaved(id)} onClose={() => setSavedOpen(false)} />
          </View>
        </View>
      ) : null}
      <Modal visible={saveOpen} transparent animationType="fade" onRequestClose={() => setSaveOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, {backgroundColor: theme.paper}]}>
            <Text style={[styles.modalTitle, {color: theme.text}]}>{t.route.saveRoute}</Text>
            <TextInput style={[styles.modalInput, {borderColor: theme.border, color: theme.text}]} value={saveName} onChangeText={setSaveName} maxLength={120} autoFocus placeholder={t.route.routeName} placeholderTextColor={theme.muted} />
            <View style={styles.modalActions}>
              <Pressable style={[styles.chip, {borderColor: theme.border}]} onPress={() => setSaveOpen(false)}>
                <Text style={{color: theme.text}}>{t.common.close}</Text>
              </Pressable>
              <Pressable style={[styles.chip, {backgroundColor: theme.primary, borderColor: theme.primary}, saveBusy && styles.disabled]} disabled={saveBusy} onPress={() => void onSaveRoute()}>
                {saveBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{color: "#fff", fontWeight: "700"}}>{t.common.save}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <Snack message={snack} onHide={() => setSnack(null)} />
      <Modal visible={navInitial !== null} animationType="slide" onRequestClose={() => setNavInitial(null)}>
        {navInitial && token ? (
          <NavigationScreen
            t={t}
            lang={lang}
            token={token}
            initialRoute={navInitial.route}
            dest={navInitial.dest}
            stops={navInitial.stops.map((s) => ({lat: s.lat, lng: s.lng}))}
            width={activeVehicle?.baseWidth}
            vehicleType={activeVehicle?.type}
            onExit={() => setNavInitial(null)}
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
  sheetWrap: {width: "100%"},
  pickChipTop: {position: "absolute", left: 12, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, zIndex: 10, elevation: 4},
  topBar: {position: "absolute", top: 12, left: 0, right: 0, alignItems: "center"},
  topBarContent: {paddingHorizontal: 12, gap: 8},
  pill: {borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14},
  dragHint: {position: "absolute", top: 64, left: 0, right: 0, alignItems: "center"},
  dragHintText: {backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", fontSize: 12, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, overflow: "hidden"},
  bottomContainer: {position: "absolute", left: 12, right: 12, bottom: 12, gap: 8},
  savedFab: {alignSelf: "flex-start", width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  card: {width: "100%", borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden"},
  clearFab: {alignSelf: "flex-end", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  row: {flexDirection: "row", gap: 8, alignItems: "center"},
  fieldCol: {flex: 1, gap: 8, minWidth: 0},
  fieldLabel: {fontSize: 12, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  selectBtn: {justifyContent: "center", minHeight: 42},
  swapBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  stopRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  addStopBtn: {flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  vehicleBtnRow: {flexDirection: "row", alignItems: "center", gap: 8},
  vehicleBtnText: {flex: 1, fontSize: 14},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  actionRow: {flexDirection: "row", gap: 8},
  primary: {flex: 1, borderRadius: 8, padding: 12, alignItems: "center"},
  saveBtn: {borderWidth: 1, backgroundColor: "transparent"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  error: {fontSize: 13},
  resultCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, borderStyle: "dashed"},
  warnBox: {gap: 2},
  warnTitle: {fontSize: 13, fontWeight: "700"},
  attribution: {fontSize: 10, textAlign: "right"},
  modalOverlay: {flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24},
  modalCard: {borderRadius: 16, padding: 16, gap: 12},
  modalTitle: {fontSize: 16, fontWeight: "700"},
  modalInput: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  modalActions: {flexDirection: "row", justifyContent: "flex-end", gap: 8},
  vehicleRow: {flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 8},
  vehicleRowText: {flex: 1, fontSize: 15},
  modalClose: {alignItems: "center", marginTop: 8},
});
