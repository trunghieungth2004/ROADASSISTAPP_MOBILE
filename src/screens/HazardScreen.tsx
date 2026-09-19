import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View, useColorScheme} from "react-native";
import {Camera, MapView, PointAnnotation} from "@maplibre/maplibre-react-native";
import {myFlags, submitFlag, unflag, type Flag, type FlagType} from "../api/flags";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {usePlaceSearch} from "../components/place-search";
import {maptilerStyleUrl} from "../map/style";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
const TYPES: FlagType[] = ["FLOOD", "OBSTRUCTION", "ACCIDENT"];
export default function HazardScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const search = usePlaceSearch({token: token ?? undefined, lang});
  const [point, setPoint] = useState<{lat: number; lng: number} | null>(null);
  const [pointLabel, setPointLabel] = useState("");
  const [flagType, setFlagType] = useState<FlagType>("FLOOD");
  const [note, setNote] = useState("");
  const [radius, setRadius] = useState("200");
  const [mine, setMine] = useState<Flag[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reloadMine = useCallback(async () => { if (!token) return; try { setMine(await myFlags(token)); } catch (err) { setError(toMessage(err)); } }, [token]);
  useEffect(() => { void reloadMine(); }, [reloadMine]);
  async function onMapPress(e: unknown) {
    const feature = e as {geometry?: {coordinates?: [number, number]}};
    const coords = feature.geometry?.coordinates;
    if (!coords || coords.length < 2) return;
    const lng = coords[0];
    const lat = coords[1];
    setPoint({lat, lng});
    setPointLabel(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    setPointLabel(await search.resolvePoint(lat, lng));
  }
  async function onSubmit() {
    if (!token || !point) return;
    setBusy(true); setError(null); setNotice(null);
    try { await submitFlag({type: flagType, lat: point.lat, lng: point.lng, note: note.trim() || undefined, radiusMeters: radius.trim() === "" ? undefined : Number(radius)}, token); setNotice(t.hazards.reported); setNote(""); setPoint(null); setPointLabel(""); await reloadMine(); } catch (err) { setError(toMessage(err)); } finally { setBusy(false); }
  }
  async function onUnflag(id: string) { if (!token) return; try { await unflag(id, token); await reloadMine(); } catch (err) { setError(toMessage(err)); } }
  return (
    <ScreenContainer>
      <FlatList contentContainerStyle={[styles.container, {backgroundColor: theme.background}]} data={mine} keyExtractor={(f) => f.id} ListHeaderComponent={
        <View style={styles.form}>
          <Text style={[styles.title, {color: theme.text}]}>{t.hazards.title}</Text>
          <View style={styles.row}>{TYPES.map((type) => (<Pressable key={type} style={[styles.chip, {borderColor: theme.primary}, flagType === type && {backgroundColor: theme.primary}]} onPress={() => setFlagType(type)}><Text style={{color: flagType === type ? "#fff" : theme.text}}>{type}</Text></Pressable>))}</View>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.hazards.note} placeholderTextColor={theme.muted} value={note} onChangeText={setNote} />
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.hazards.radius} placeholderTextColor={theme.muted} value={radius} onChangeText={setRadius} keyboardType="numeric" />
          <Text style={[styles.hint, {color: theme.muted}]}>{t.hazards.pickHint}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={pointLabel} editable={false} placeholder={t.hazards.pickHint} placeholderTextColor={theme.muted} />
          <View style={styles.map}>
            <MapView style={styles.mapInner} mapStyle={maptilerStyleUrl} logoEnabled={false} attributionEnabled={false} onPress={(e: unknown) => void onMapPress(e)}>
              <Camera centerCoordinate={[106.6602, 10.7626]} zoomLevel={13} />
              {point ? <PointAnnotation id="hazardPoint" coordinate={[point.lng, point.lat]}><View style={styles.marker} /></PointAnnotation> : null}
            </MapView>
          </View>
          {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
          {notice ? <Text style={[styles.notice, {color: theme.success}]}>{notice}</Text> : null}
          <Pressable style={[styles.primary, {backgroundColor: theme.primary}, (busy || !point) && styles.disabled]} disabled={busy || !point} onPress={() => void onSubmit()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.hazards.submit}</Text>}</Pressable>
          <Text style={[styles.section, {color: theme.text}]}>{t.hazards.myReports}</Text>
        </View>
      } renderItem={({item: f}) => (
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}><Text style={[styles.cardTitle, {color: theme.text}]}>{f.type} · {f.voteCount ?? 0} · {f.status}</Text>{f.note ? <Text style={{color: theme.text}}>{f.note}</Text> : null}<Text style={[styles.coords, {color: theme.muted}]}>{f.lat.toFixed(5)}, {f.lng.toFixed(5)}</Text><Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => void onUnflag(f.id)}><Text style={{color: theme.primary}}>{t.hazards.unflag}</Text></Pressable></View>
      )} ListEmptyComponent={<Text style={[styles.hint, {color: theme.muted}]}>{t.hazards.empty}</Text>} />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: {padding: 16, gap: 8},
  form: {gap: 8, marginBottom: 12},
  title: {fontSize: 20, fontWeight: "700"},
  section: {fontSize: 16, fontWeight: "700", marginTop: 8},
  row: {flexDirection: "row", gap: 8},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  hint: {fontSize: 12},
  map: {height: 220, borderRadius: 16, overflow: "hidden"},
  mapInner: {flex: 1},
  marker: {width: 16, height: 16, borderRadius: 8, backgroundColor: "#dc2626", borderWidth: 2, borderColor: "#fff"},
  error: {fontSize: 13},
  notice: {fontSize: 13},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8, gap: 4},
  cardTitle: {fontWeight: "700"},
  coords: {fontSize: 12},
});
