import {useCallback, useEffect, useState} from "react";
import {ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View, useColorScheme} from "react-native";
import * as Location from "expo-location";
import {cancelTicket, createTicket, myTickets, type DispatchTicket, type TicketType} from "../api/dispatch";
import {toMessage} from "../api/client";
import type {Place} from "../components/place-search/PlaceSearch.types";
import {PlaceSearchField, usePlaceSearch} from "../components/place-search";
import {useAuth} from "../context/AuthContext";
import {useProfile} from "../context/ProfileContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
export default function AssistScreen() {
  const {t, lang} = useStrings();
  const {token} = useAuth();
  const {activeVehicle} = useProfile();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const destSearch = usePlaceSearch({token: token ?? undefined, lang});
  const [ticketType, setTicketType] = useState<TicketType>("SOS");
  const [note, setNote] = useState("");
  const [dest, setDest] = useState<Place | null>(null);
  const [tickets, setTickets] = useState<DispatchTicket[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reload = useCallback(async () => { if (!token) return; try { setTickets(await myTickets(token)); } catch (err) { setError(toMessage(err)); } }, [token]);
  useEffect(() => { void reload(); }, [reload]);
  async function currentPoint() { const {status} = await Location.requestForegroundPermissionsAsync(); if (status !== "granted") throw new Error("Location denied"); const pos = await Location.getCurrentPositionAsync({}); return {lat: pos.coords.latitude, lng: pos.coords.longitude}; }
  async function onRequest() {
    if (!token) return;
    if (ticketType === "TOW" && !dest) { setError(t.assist.towNeedsDest); return; }
    setBusy(true); setError(null); setNotice(null);
    try { const at = await currentPoint(); await createTicket({ticketType, lat: at.lat, lng: at.lng, note: note.trim() || undefined, destinationPoint: ticketType === "TOW" && dest ? {lat: dest.lat, lng: dest.lng, label: dest.label} : undefined, vehicleType: activeVehicle?.type, vehicleWidth: activeVehicle?.baseWidth}, token); setNotice(t.assist.requested); setNote(""); await reload(); } catch (err) { setError(toMessage(err)); } finally { setBusy(false); }
  }
  async function onCancel(id: string) { if (!token) return; try { await cancelTicket(id, token); setNotice(t.assist.cancelled); await reload(); } catch (err) { setError(toMessage(err)); } }
  return (
    <ScreenContainer>
      <FlatList contentContainerStyle={[styles.container, {backgroundColor: theme.background}]} data={tickets} keyExtractor={(item) => item.id} ListHeaderComponent={
        <View style={styles.form}>
          <Text style={[styles.title, {color: theme.text}]}>{t.assist.title}</Text>
          <View style={styles.row}>{(["SOS", "TOW"] as TicketType[]).map((kind) => (<Pressable key={kind} style={[styles.chip, {borderColor: theme.primary}, ticketType === kind && {backgroundColor: theme.primary}]} onPress={() => setTicketType(kind)}><Text style={{color: ticketType === kind ? "#fff" : theme.text}}>{kind === "SOS" ? t.assist.sos : t.assist.tow}</Text></Pressable>))}</View>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={t.assist.note} placeholderTextColor={theme.muted} value={note} onChangeText={setNote} />
          {ticketType === "TOW" ? <PlaceSearchField search={destSearch} placeholder={t.common.searchPlaceholder} noResultsText={t.common.noResults} onSelect={setDest} /> : null}
          {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
          {notice ? <Text style={[styles.notice, {color: theme.success}]}>{notice}</Text> : null}
          <Pressable style={[styles.primary, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onRequest()}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.assist.request}</Text>}</Pressable>
          <Text style={[styles.section, {color: theme.text}]}>{t.assist.myTickets}</Text>
        </View>
      } renderItem={({item}) => (
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}><Text style={[styles.cardTitle, {color: theme.text}]}>{item.ticketType} · {item.status}</Text>{typeof item.note === "string" && item.note ? <Text style={{color: theme.text}}>{item.note}</Text> : null}{item.status === "1" || item.status === "2" ? <Pressable style={[styles.chip, {borderColor: theme.primary}]} onPress={() => void onCancel(item.id)}><Text style={{color: theme.primary}}>{t.assist.cancel}</Text></Pressable> : null}</View>
      )} ListEmptyComponent={<Text style={[styles.hint, {color: theme.muted}]}>{t.assist.empty}</Text>} />
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
  error: {fontSize: 13},
  notice: {fontSize: 13},
  primary: {borderRadius: 8, padding: 12, alignItems: "center"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8, gap: 4},
  cardTitle: {fontWeight: "700"},
  hint: {fontSize: 12},
});
