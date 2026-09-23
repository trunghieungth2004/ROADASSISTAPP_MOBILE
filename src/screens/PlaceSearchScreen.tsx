import {useState, type ComponentProps} from "react";
import {ActivityIndicator, FlatList, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import * as Location from "expo-location";
import {usePlaceSearch, type Place} from "../components/place-search";
import {toMessage} from "../api/client";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";
const CATEGORY_ICONS: Record<string, ComponentProps<typeof MaterialIcons>["name"]> = {
  park: "park",
  landmark: "museum",
  fuel: "local-gas-station",
  repair: "car-repair",
  hospital: "local-hospital",
  school: "school",
  cafe: "local-cafe",
  restaurant: "restaurant",
  market: "store",
  store: "store",
  hotel: "hotel",
  bank: "account-balance",
  pharmacy: "local-pharmacy",
};

function resultIcon(item: Place): ComponentProps<typeof MaterialIcons>["name"] {
  if (item.source === "saved") return "bookmark";
  if (item.category && item.category in CATEGORY_ICONS) return CATEGORY_ICONS[item.category];
  return "place";
}
type Props = {t: Strings; token?: string; lang: string; title: string; placeholder: string; onPick: (place: Place) => void; onPickOnMap: () => void; onClose: () => void};
export default function PlaceSearchScreen({t, token, lang, title, placeholder, onPick, onPickOnMap, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const search = usePlaceSearch({token, lang});
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const grouped: {header: string | null; item: Place}[] = [];
  let last: string | null = null;
  for (const p of search.options) {
    const header = p.source === "saved" ? t.route.savedPlaces : p.source === "directory" ? t.route.directory : t.route.mapResults;
    grouped.push({header: header === last ? null : header, item: p});
    last = header;
  }
  async function onUseLocation() {
    if (locating) return;
    setLocating(true);
    setError(null);
    try {
      const {status} = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location denied");
      const pos = await Location.getCurrentPositionAsync({});
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const label = await search.resolvePoint(lat, lng);
      onPick({label, lat, lng, source: "map"});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLocating(false);
    }
  }
  return (
    <View style={[styles.screen, {backgroundColor: theme.background, paddingTop: insets.top + 12}]}>
      <View style={styles.searchRow}>
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}><MaterialIcons name="close" size={22} color={theme.text} /></Pressable>
        <View style={styles.searchCol}>
          <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={placeholder} placeholderTextColor={theme.muted} value={search.input} onChangeText={search.handleInput} autoFocus />
        </View>
      </View>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      <View style={styles.actionBtns}>
        <Pressable style={[styles.actionBtn, {borderColor: theme.border}]} onPress={() => void onUseLocation()} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={20} color={theme.primary} />}
          <Text style={[styles.actionBtnText, {color: theme.text}]} numberOfLines={1}>{t.common.currentLocation}</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, {borderColor: theme.border}]} onPress={onPickOnMap}>
          <MaterialIcons name="pin-drop" size={20} color={theme.primary} />
          <Text style={[styles.actionBtnText, {color: theme.text}]} numberOfLines={1}>{t.route.pickOnMap}</Text>
        </Pressable>
      </View>
      {search.searching ? <Text style={[styles.hint, {color: theme.muted}]}>{t.route.searching}</Text> : null}
      {!search.searching && search.input.trim().length >= 3 && search.options.length === 0 ? <Text style={[styles.hint, {color: theme.muted}]}>{t.route.noResults}</Text> : null}
      <FlatList style={styles.results} data={grouped} keyExtractor={(row) => `${row.item.source}:${row.item.label}:${row.item.lat},${row.item.lng}`} keyboardShouldPersistTaps="handled" renderItem={({item: row}) => (
        <View>
          {row.header ? <Text style={[styles.header, {color: theme.muted}]}>{row.header}</Text> : null}
          <Pressable style={styles.row} onPress={() => { search.select(row.item); onPick(row.item); }}>
            <MaterialIcons name={resultIcon(row.item)} size={20} color={theme.primary} />
            <Text style={[styles.rowText, {color: theme.text}]}>{row.item.label}</Text>
          </Pressable>
        </View>
      )} />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 8},
  searchRow: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  searchCol: {flex: 1, gap: 8, minWidth: 0},
  title: {fontSize: 16, fontWeight: "700"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  error: {fontSize: 13},
  actionBtns: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 8, minWidth: 0},
  actionBtnText: {fontSize: 13, fontWeight: "600", flexShrink: 1},
  hint: {fontSize: 13},
  results: {flex: 1},
  header: {fontSize: 12, fontWeight: "700", marginTop: 8},
  row: {flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f0f0f0"},
  rowText: {flex: 1, fontSize: 14, minWidth: 0},
});
