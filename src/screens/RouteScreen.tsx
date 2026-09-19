import {useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useColorScheme} from "react-native";
import MapView, {Marker, Polyline} from "react-native-maps";
import * as Location from "expo-location";
import {findRoute, saveRoute, type RouteOption} from "../api/routes";
import {toMessage} from "../api/client";
import type {Place} from "../components/place-search/PlaceSearch.types";
import {PlaceSearchField, usePlaceSearch} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
type Point = {lat: number; lng: number};
const HCMC = {latitude: 10.7626, longitude: 106.6602, latitudeDelta: 0.05, longitudeDelta: 0.05};
export default function RouteScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {activeVehicle} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const originSearch = usePlaceSearch({token: token ?? undefined, lang});
  const destSearch = usePlaceSearch({token: token ?? undefined, lang});
  const [origin, setOrigin] = useState<Point | null>(null);
  const [dest, setDest] = useState<Point | null>(null);
  const [pickMode, setPickMode] = useState<"origin" | "dest" | null>(null);
  const [result, setResult] = useState<RouteOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  function pick(search: "origin" | "dest", place: Place) {
    const next = {lat: place.lat, lng: place.lng};
    if (search === "origin") setOrigin(next); else setDest(next);
  }
  async function onMapPress(lat: number, lng: number) {
    if (!pickMode) return;
    const search = pickMode === "origin" ? originSearch : destSearch;
    const label = await search.resolvePoint(lat, lng);
    search.pin(label);
    const next = {lat, lng};
    if (pickMode === "origin") setOrigin(next); else setDest(next);
    setPickMode(null);
  }
  async function useMyLocation() {
    const {status} = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    const pos = await Location.getCurrentPositionAsync({});
    const next = {lat: pos.coords.latitude, lng: pos.coords.longitude};
    setOrigin(next);
    const label = await originSearch.resolvePoint(next.lat, next.lng);
    originSearch.pin(label);
  }
  async function onFind() {
    if (!token || !origin || !dest) return;
    setBusy(true); setError(null); setNotice(null);
    try { const res = await findRoute({originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng, width: activeVehicle?.baseWidth, vehicleType: activeVehicle?.type}, token); setResult(res.routes[0] ?? null); } catch (err) { setError(toMessage(err)); } finally { setBusy(false); }
  }
  async function onSave() {
    if (!token || !origin || !dest || !result) return;
    setError(null);
    try { await saveRoute({originLat: origin.lat, originLng: origin.lng, destLat: dest.lat, destLng: dest.lng, width: activeVehicle?.baseWidth, distanceMeters: result.distanceMeters, durationSeconds: result.durationSeconds, source: result.source, geometry: result.geometry}, token); setNotice(t.route.savedMsg); } catch (err) { setError(toMessage(err)); }
  }
  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={[styles.container, {backgroundColor: theme.background}]}>
        <Text style={[styles.label, {color: theme.text}]}>{t.route.origin}</Text>
        <PlaceSearchField search={originSearch} placeholder={t.common.searchPlaceholder} noResultsText={t.common.noResults} onSelect={(p) => pick("origin", p)} />
        <View style={styles.row}>
          <Pressable style={[styles.chip, {borderColor: theme.primary}, pickMode === "origin" && {backgroundColor: theme.primary}]} onPress={() => setPickMode(pickMode === "origin" ? null : "origin")}><Text style={{color: pickMode === "origin" ? "#fff" : theme.primary}}>{t.common.useMapPoint}</Text></Pressable>
          <Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => void useMyLocation()}><Text style={{color: theme.primary}}>{t.common.currentLocation}</Text></Pressable>
          <Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => { setOrigin(dest); setDest(origin); originSearch.pin(dest ? `${dest.lat}, ${dest.lng}` : ""); destSearch.pin(origin ? `${origin.lat}, ${origin.lng}` : ""); }}><Text style={{color: theme.primary}}>{t.route.swap}</Text></Pressable>
        </View>
        <Text style={[styles.label, {color: theme.text}]}>{t.route.dest}</Text>
        <PlaceSearchField search={destSearch} placeholder={t.common.searchPlaceholder} noResultsText={t.common.noResults} onSelect={(p) => pick("dest", p)} />
        <Pressable style={[styles.chip, {borderColor: theme.primary}, pickMode === "dest" && {backgroundColor: theme.primary}]} onPress={() => setPickMode(pickMode === "dest" ? null : "dest")}><Text style={{color: pickMode === "dest" ? "#fff" : theme.primary}}>{t.common.useMapPoint}</Text></Pressable>
        <MapView style={styles.map} initialRegion={HCMC} onPress={(e) => void onMapPress(e.nativeEvent.coordinate.latitude, e.nativeEvent.coordinate.longitude)}>
          {origin ? <Marker coordinate={{latitude: origin.lat, longitude: origin.lng}} title={t.route.origin} /> : null}
          {dest ? <Marker coordinate={{latitude: dest.lat, longitude: dest.lng}} title={t.route.dest} pinColor="blue" /> : null}
          {result ? <Polyline coordinates={result.geometry.coordinates.map(([lng, lat]) => ({latitude: lat, longitude: lng}))} strokeColor={theme.primary} strokeWidth={4} /> : null}
        </MapView>
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        {notice ? <Text style={[styles.notice, {color: theme.success}]}>{notice}</Text> : null}
        <Pressable style={[styles.primary, {backgroundColor: theme.primary}, (busy || !origin || !dest) && styles.disabled]} disabled={busy || !origin || !dest} onPress={() => void onFind()}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.route.find}</Text>}
        </Pressable>
        {result ? <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}><Text style={{color: theme.text}}>{t.route.distance}: {(result.distanceMeters / 1000).toFixed(1)} km</Text><Text style={{color: theme.text}}>{t.route.duration}: {Math.round(result.durationSeconds / 60)} min ({result.source})</Text><Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => void onSave()}><Text style={{color: theme.primary}}>{t.route.saveRoute}</Text></Pressable></View> : null}
      </ScrollView>
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: {padding: 16, gap: 8},
  label: {fontWeight: "700", marginTop: 4},
  row: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  map: {height: 260, borderRadius: 16},
  error: {fontSize: 13},
  notice: {fontSize: 13},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
});
