import {useCallback, useEffect, useState} from "react";
import {FlatList, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {myFlags, unflag, type Flag} from "../api/flags";
import {toMessage} from "../api/client";
import {useAuth} from "../context/AuthContext";
import {useStrings} from "../context/LanguageContext";
import {darkTheme, lightTheme} from "../theme";
import ScreenContainer from "../components/ScreenContainer";
export default function HazardScreen() {
  const {t} = useStrings();
  const {token} = useAuth();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [mine, setMine] = useState<Flag[]>([]);
  const [error, setError] = useState<string | null>(null);
  const reloadMine = useCallback(async () => { if (!token) return; try { setMine(await myFlags(token)); } catch (err) { setError(toMessage(err)); } }, [token]);
  useEffect(() => { void reloadMine(); }, [reloadMine]);
  async function onUnflag(id: string) { if (!token) return; try { await unflag(id, token); await reloadMine(); } catch (err) { setError(toMessage(err)); } }
  return (
    <ScreenContainer>
      <FlatList contentContainerStyle={[styles.container, {backgroundColor: theme.background}]} data={mine} keyExtractor={(f) => f.id} ListHeaderComponent={
        <View style={styles.form}>
          <Text style={[styles.title, {color: theme.text}]}>{t.hazards.myReports}</Text>
          {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
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
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  hint: {fontSize: 12},
  error: {fontSize: 13},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 8, gap: 4},
  cardTitle: {fontWeight: "700"},
  coords: {fontSize: 12},
});
