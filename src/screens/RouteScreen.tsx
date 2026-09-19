import {useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, useColorScheme} from "react-native";
import {Camera, LineLayer, MapView, PointAnnotation, ShapeSource} from "@maplibre/maplibre-react-native";
import {findRoute, saveRoute, type RouteOption} from "../api/routes";
import {reverseLabel} from "../api/places";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {maptilerStyleUrl} from "../map/style";
import {darkTheme, lightTheme} from "../theme";
type Point = {lat: number; lng: number};
const HCMC_CENTER: [number, number] = [106.6602, 10.7626];
export default function RouteScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {activeVehicle} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [origin, setOrigin] = useState<Point | null>(null);
  const [dest, setDest] = useState<Point | null>(null);
  const [originText, setOriginText] = useState("");
  const [destText, setDestText] = useState("");
  const [result, setResult] = useState<RouteOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  async function onMapPress(e: unknown) {
    const feature = e as {geometry?: {coordinates?: [number, number]}};
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return;
    const lng = coords[0];
    const lat = coords[1];
    const label = await reverseLabel(lat, lng, lang);
    if (!origin) { setOrigin({lat, lng}); setOriginText(label); } else if (!dest) { setDest({lat, lng}); setDestText(label); } else { setDest({lat, lng}); setDestText(label); }
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
    <View style={styles.root}>
      <MapView style={StyleSheet.absoluteFill} mapStyle={maptilerStyleUrl} logoEnabled={false} attributionEnabled={false} onPress={(e: unknown) => void onMapPress(e)}>
        <Camera centerCoordinate={HCMC_CENTER} zoomLevel={13} />
        {origin ? <PointAnnotation id="origin" coordinate={[origin.lng, origin.lat]}><View style={[styles.marker, {backgroundColor: theme.primary}]}><Text style={styles.markerText}>A</Text></View></PointAnnotation> : null}
        {dest ? <PointAnnotation id="dest" coordinate={[dest.lng, dest.lat]}><View style={[styles.marker, {backgroundColor: "#dc2626"}]}><Text style={styles.markerText}>B</Text></View></PointAnnotation> : null}
        {result ? <ShapeSource id="route" shape={{type: "Feature", geometry: result.geometry, properties: {}}}><LineLayer id="routeLine" style={{lineColor: theme.primary, lineWidth: 5, lineCap: "round", lineJoin: "round"}} /></ShapeSource> : null}
      </MapView>
      <View style={styles.bottomContainer}>
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.row}>
            <View style={styles.fieldCol}>
              <Text style={[styles.fieldLabel, {color: theme.text}]}>A · {t.route.origin}</Text>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.route.searchOrigin} placeholderTextColor={theme.muted} value={originText} onChangeText={setOriginText} />
              <Text style={[styles.fieldLabel, {color: theme.text}]}>B · {t.route.destination}</Text>
              <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.route.searchDestination} placeholderTextColor={theme.muted} value={destText} onChangeText={setDestText} />
            </View>
            <Pressable style={[styles.swapBtn, {borderColor: theme.border}]} onPress={() => { const o = origin; const ot = originText; setOrigin(dest); setDest(o); setOriginText(destText); setDestText(ot); }}>
              <Text style={{color: theme.primary}}>⇅</Text>
            </Pressable>
          </View>
          {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
          {notice ? <Text style={[styles.notice, {color: theme.success}]}>{notice}</Text> : null}
          {result ? (
            <View style={styles.actionRow}>
              <Pressable style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onFind()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.route.find}</Text>}</Pressable>
              <Pressable style={[styles.outline, {borderColor: theme.border}]} onPress={() => { setOrigin(null); setDest(null); setOriginText(""); setDestText(""); setResult(null); setError(null); setNotice(null); }}><Text style={{color: theme.text}}>{t.route.clear}</Text></Pressable>
            </View>
          ) : origin && dest ? (
            <Pressable style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onFind()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.route.find}</Text>}</Pressable>
          ) : null}
          {result ? <View style={[styles.resultCard, {borderColor: theme.border}]}><Text style={{color: theme.text}}>{t.route.distance}: {(result.distanceMeters / 1000).toFixed(1)} km · {t.route.duration}: {Math.round(result.durationSeconds / 60)} min</Text><Pressable style={[styles.chip, {borderColor: theme.success}]} onPress={() => void onSave()}><Text style={{color: theme.success}}>{t.route.saveRoute}</Text></Pressable><Text style={[styles.attribution, {color: theme.muted}]}>{t.route.geoAttribution}</Text></View> : null}
        </View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  root: {flex: 1},
  bottomContainer: {position: "absolute", left: 12, right: 12, bottom: 12},
  card: {width: "100%", borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden"},
  row: {flexDirection: "row", gap: 8, alignItems: "center"},
  fieldCol: {flex: 1, gap: 8, minWidth: 0},
  fieldLabel: {fontSize: 12, fontWeight: "600"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  swapBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  actionRow: {flexDirection: "row", gap: 8},
  primary: {flex: 1, borderRadius: 8, padding: 12, alignItems: "center"},
  outline: {borderWidth: 1, borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  error: {fontSize: 13},
  notice: {fontSize: 13},
  resultCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, borderStyle: "dashed"},
  attribution: {fontSize: 10, textAlign: "right"},
  marker: {width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff"},
  markerText: {color: "#fff", fontWeight: "700", fontSize: 12},
});
