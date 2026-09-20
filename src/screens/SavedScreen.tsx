import {useCallback, useEffect, useState} from "react";
import {FlatList, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {deleteSavedRoute, listSavedRoutes, type SavedRouteSummary} from "../api/routes";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
export default function SavedScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [routes, setRoutes] = useState<SavedRouteSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => { if (!token) return; try { setRoutes(await listSavedRoutes(token)); } catch (err) { setError(toMessage(err)); } }, [token]);
  useEffect(() => { void load(); }, [load]);
  async function onDelete(id: string) { if (!token) return; try { await deleteSavedRoute(id, token); await load(); } catch (err) { setError(toMessage(err)); } }
  return (
    <ScreenContainer>
      <FlatList contentContainerStyle={[styles.container, {backgroundColor: theme.background}]} data={routes} keyExtractor={(r) => r.id} ListHeaderComponent={<View style={styles.header}><Text style={[styles.title, {color: theme.text}]}>{t.tabs.home ?? "Saved"}</Text>{error ? <Text style={{color: theme.danger}}>{error}</Text> : null}</View>} renderItem={({item: r}) => (
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}><Text style={[styles.name, {color: theme.text}]}>{r.name ?? `${r.originLat.toFixed(3)},${r.originLng.toFixed(3)} → ${r.destLat.toFixed(3)},${r.destLng.toFixed(3)}`}</Text><Text style={{color: theme.muted}}>{r.distanceMeters ? `${(r.distanceMeters / 1000).toFixed(1)} km` : ""}</Text><Pressable style={[styles.chip, {borderColor: theme.danger}]} onPress={() => void onDelete(r.id)}><Text style={{color: theme.danger}}>{t.common.close}</Text></Pressable></View>
      )} ListEmptyComponent={<Text style={{color: theme.muted, textAlign: "center", marginTop: 24}}>{t.common.loading}</Text>} />
    </ScreenContainer>
  );
}
const styles = StyleSheet.create({
  container: {padding: 16, gap: 8},
  header: {gap: 8, marginBottom: 8},
  title: {fontSize: 20, fontWeight: "700"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 6},
  name: {fontWeight: "700"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, alignSelf: "flex-start"},
});
