import {useEffect, useRef, useState} from "react";
import {ActivityIndicator, BackHandler, Keyboard, Modal, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {useNavigation} from "@react-navigation/native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import * as Location from "expo-location";
import {type CameraRef} from "@maplibre/maplibre-react-native";
import {findRoute, getSavedRoute, saveRoute, isHazardZone, isWidthBlock, type RouteOption} from "../api/routes";
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
import {HCMC_CENTER, MAX_STOPS, type Point, type SearchField, type Stop} from "./route/types";
import {boundsOf, midOf, vehicleIcon} from "./route/routeGeo";
import {useRouteDrag} from "./route/useRouteDrag";
import RouteMapView from "./route/RouteMapView";
import RouteCard from "./route/RouteCard";

export default function RouteScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const navigation = useNavigation();
  const {vehicles, activeVehicle, activateVehicle} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const cameraRef = useRef<CameraRef | null>(null);
  const seqRef = useRef(0);
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
  const [navInitial, setNavInitial] = useState<{route: RouteOption; dest: Point; stops: Stop[]} | null>(null);
  const [pickingFor, setPickingFor] = useState<SearchField | null>(null);
  const [pickBusy, setPickBusy] = useState(false);
  const [gpsPos, setGpsPos] = useState<Point | null>(null);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const result = routes[selectedIndex] ?? null;
  const selectedMid = result ? midOf(result.geometry.coordinates) : null;
  const hazardZones = (result?.hazards ?? []).filter(isHazardZone);
  const widthBlocks = (result?.warnings ?? []).filter(isWidthBlock);
  const canClear = !!origin || !!dest || stops.length > 0 || routes.length > 0;
  const pillBgActive = scheme === "dark" ? "pill-active-dark" : "pill-active-light";
  function fitRouteGeometry(coords: [number, number][]) {
    const b = boundsOf(coords);
    if (b) cameraRef.current?.fitBounds(b.ne, b.sw, [80, 60, 340, 60], 0);
  }
  async function requestRoute(o: Point | null, d: Point | null, s: Stop[], width?: number, vehicleType?: string, fit?: boolean) {
    if (!token || !o || !d) return;
    const id = (seqRef.current += 1);
    setBusy(true);
    setError(null);
    try {
      const res = await findRoute({originLat: o.lat, originLng: o.lng, destLat: d.lat, destLng: d.lng, stops: s.map((stop) => ({lat: stop.lat, lng: stop.lng})), width: width ?? activeVehicle?.baseWidth, vehicleType: vehicleType ?? activeVehicle?.type}, token);
      if (seqRef.current !== id) return;
      const next = res.routes ?? [];
      setRoutes(next);
      setSelectedIndex(0);
      if (fit && next[0]) fitRouteGeometry(next[0].geometry.coordinates);
    } catch (err) {
      if (seqRef.current === id) setError(toMessage(err));
    } finally {
      if (seqRef.current === id) setBusy(false);
    }
  }
  async function onFind() {
    await requestRoute(origin, dest, stops, undefined, undefined, true);
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
      cameraRef.current?.setCamera({centerCoordinate: [place.lng, place.lat], zoomLevel: 15, animationDuration: 500});
    }
    setSearchingFor(null);
  }
  async function onPickMapPoint(lat: number, lng: number) {
    const field = pickingFor;
    if (!field || pickBusy || busy) return;
    Keyboard.dismiss();
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
  const drag = useRouteDrag({
    origin,
    dest,
    stops,
    routes,
    selectedIndex,
    busy,
    pickingFor,
    requestRoute,
    setOrigin,
    setOriginText,
    setDest,
    setDestText,
    setStops,
    onPickMapPoint,
  });
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
      const fix = await Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced});
      const next = {lat: fix.coords.latitude, lng: fix.coords.longitude};
      setGpsPos(next);
      cameraRef.current?.setCamera({centerCoordinate: [next.lng, next.lat], animationDuration: 500});
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
        dragPos={drag.dragPos}
        selectedMid={selectedMid}
        mapZoom={drag.mapZoom}
        pillBgActive={pillBgActive}
        dragging={drag.dragging}
        dragPan={drag.dragPan}
        pickingFor={pickingFor}
        pickBusy={pickBusy}
        onMapPress={drag.onMapPress}
        onRegionChange={drag.onRegionChange}
        onRegionDid={drag.onRegionDid}
        onSelectIndex={onSelectRoute}
        onCancelPick={() => setPickingFor(null)}
      />
      {!pickingFor ? (
      <View style={styles.bottomContainer}>
        <View style={styles.fabRow}>
          <Pressable style={[styles.savedFab, {backgroundColor: theme.paper, borderColor: theme.border}, !token && styles.disabled]} disabled={!token || busy} onPress={() => setSavedOpen(true)} accessibilityRole="button" accessibilityLabel={t.saved.title}>
            <MaterialIcons name="bookmark-border" size={22} color={token ? theme.primary : theme.muted} />
          </Pressable>
          <View style={styles.fabSpacer} />
          <Pressable style={[styles.gpsFab, {backgroundColor: theme.paper, borderColor: theme.border}, gpsBusy && styles.disabled]} disabled={gpsBusy} onPress={() => void onLocate()} accessibilityRole="button" accessibilityLabel={t.common.currentLocation}>
            {gpsBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={22} color={theme.primary} />}
          </Pressable>
          {canClear ? (
            <Pressable style={[styles.clearFab, {backgroundColor: theme.danger}]} onPress={onClear} accessibilityRole="button" accessibilityLabel={t.route.clear}>
              <MaterialIcons name="close" size={20} color="#fff" />
            </Pressable>
          ) : null}
        </View>
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
          error={error}
          hazardZones={hazardZones}
          widthBlocks={widthBlocks}
          onOpenSearch={(f) => { setPickingFor(null); setSearchingFor(f); }}
          onSwap={onSwap}
          onDeleteStop={onDeleteStop}
          onOpenVehicle={() => setVehicleOpen(true)}
          onFind={() => void onFind()}
          onStart={() => void onStart()}
          onSave={() => void onSave()}
        />
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
                Keyboard.dismiss();
                setSearchingFor(null);
                setPickingFor(f);
              }}
              onClose={() => { Keyboard.dismiss(); setSearchingFor(null); }}
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
  bottomContainer: {position: "absolute", left: 12, right: 12, bottom: 12, gap: 8},
  fabRow: {flexDirection: "row", alignItems: "center", gap: 8},
  fabSpacer: {flex: 1},
  savedFab: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  gpsFab: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  clearFab: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  disabled: {opacity: 0.6},
  modalOverlay: {flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", padding: 24},
  modalCard: {borderRadius: 16, padding: 16, gap: 12},
  modalTitle: {fontSize: 16, fontWeight: "700"},
  modalInput: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  modalActions: {flexDirection: "row", justifyContent: "flex-end", gap: 8},
  vehicleRow: {flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 8},
  vehicleRowText: {flex: 1, fontSize: 15},
  modalClose: {alignItems: "center", marginTop: 8},
});
