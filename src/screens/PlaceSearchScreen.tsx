import {useState, type ComponentProps} from "react";
import {ActivityIndicator, FlatList, Keyboard, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import * as Location from "expo-location";
import {usePlaceSearch, type Place, type PlaceSearch, type ShopFetcher} from "../components/place-search";
import SavedPlacesSheet from "../components/place-search/SavedPlacesSheet";
import MapPickOverlay from "../components/map/MapPickOverlay";
import Overlay from "../components/overlay/Overlay";
import type {PlaceSource} from "../components/place-search/PlaceSearch.types";
import {listSavedPlaces, removeSavedPlace, savePlace, type SavedPlace} from "../api/places";
import {getFix} from "../services/geo";
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
  if (item.source === "shop") return "storefront";
  if (item.category && item.category in CATEGORY_ICONS) return CATEGORY_ICONS[item.category];
  return "place";
}
type Props = {t: Strings; token?: string; lang: string; title: string; placeholder: string; onPick: (place: Place) => void; onPickOnMap?: () => void; onBrowseNearby?: () => void; onClose: () => void; search?: PlaceSearch; shops?: ShopFetcher; sources?: PlaceSource[]; mapFilter?: (place: Place) => boolean; query?: string; onQuery?: (q: string) => void; disabledIds?: Set<string>; disabledNote?: string};
export default function PlaceSearchScreen({t, token, lang, title, placeholder, onPick, onPickOnMap, onBrowseNearby, onClose, search: provided, shops, sources, mapFilter, query, onQuery, disabledIds, disabledNote}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const internal = usePlaceSearch({token, lang, shops, sources, mapFilter, query, onQuery});
  const search = provided ?? internal;
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedBusy, setSavedBusy] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [pickingSaved, setPickingSaved] = useState(false);
  const [draftPoint, setDraftPoint] = useState<{lat: number; lng: number} | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const grouped: {header: string | null; item: Place}[] = [];
  let last: string | null = null;
  for (const p of search.options) {
    const header = p.source === "saved" ? t.route.savedPlaces : p.source === "directory" ? t.route.directory : p.source === "shop" ? t.shop.sectionRegistered : t.route.mapResults;
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
      const {lat, lng} = await getFix({maxAgeMs: 30000, requiredAccuracyMeters: 200, timeoutMs: 4000, staleFallback: false});
      const label = await search.resolvePoint(lat, lng);
      onPick({label, lat, lng, source: "map"});
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLocating(false);
    }
  }
  async function loadSavedPlaces(): Promise<void> {
    if (!token) {
      setSavedPlaces([]);
      return;
    }
    setSavedLoading(true);
    try {
      setSavedPlaces(await listSavedPlaces(token));
    } catch (err) {
      setSavedError(toMessage(err));
    } finally {
      setSavedLoading(false);
    }
  }
  function openSavedManager(): void {
    setSavedError(null);
    setSavedOpen(true);
    void loadSavedPlaces();
  }
  async function onSaveDraftPlace(): Promise<void> {
    if (!token || !draftPoint || savedBusy) return;
    const label = draftLabel.trim();
    if (!label) return;
    setSavedBusy(true);
    try {
      await savePlace({label, lat: draftPoint.lat, lng: draftPoint.lng}, token);
      setDraftPoint(null);
      setDraftLabel("");
      await loadSavedPlaces();
      search.refreshSaved();
    } catch (err) {
      setSavedError(toMessage(err));
    } finally {
      setSavedBusy(false);
    }
  }
  async function onDeleteSavedPlace(id: string): Promise<void> {
    if (!token || savedBusy) return;
    setSavedBusy(true);
    try {
      await removeSavedPlace(id, token);
      await loadSavedPlaces();
      search.refreshSaved();
    } catch (err) {
      setSavedError(toMessage(err));
    } finally {
      setSavedBusy(false);
    }
  }
  return (
    <View style={[styles.screen, {backgroundColor: theme.background, paddingTop: insets.top + 12}]}>
      <View style={styles.searchRow}>
        <Pressable style={[styles.closeBtn, {backgroundColor: theme.danger}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}><MaterialIcons name="close" size={20} color="#fff" /></Pressable>
        <View style={styles.searchCol}>
          <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={placeholder} placeholderTextColor={theme.muted} value={search.input} onChangeText={search.handleInput} accessibilityLabel={placeholder} autoFocus />
        </View>
        {token ? (
          <Pressable style={[styles.savedBtn, {borderColor: theme.border}]} onPress={openSavedManager} accessibilityRole="button" accessibilityLabel={t.route.savedPlaces}>
            <MaterialIcons name="bookmark" size={20} color={theme.primary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
      <View style={styles.actionBtns}>
        <Pressable style={[styles.actionBtn, {borderColor: theme.border}]} onPress={() => void onUseLocation()} disabled={locating}>
          {locating ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="my-location" size={20} color={theme.primary} />}
          <Text style={[styles.actionBtnText, {color: theme.text}]} numberOfLines={1}>{t.common.currentLocation}</Text>
        </Pressable>
        {onPickOnMap ? (
        <Pressable style={[styles.actionBtn, {borderColor: theme.border}]} onPress={onPickOnMap}>
          <MaterialIcons name="pin-drop" size={20} color={theme.primary} />
          <Text style={[styles.actionBtnText, {color: theme.text}]} numberOfLines={1}>{t.route.pickOnMap}</Text>
        </Pressable>
        ) : null}
        {onBrowseNearby ? (
        <Pressable style={[styles.actionBtn, {borderColor: theme.border}]} onPress={onBrowseNearby}>
          <MaterialIcons name="directions-walk" size={20} color={theme.primary} />
          <Text style={[styles.actionBtnText, {color: theme.text}]} numberOfLines={1}>{t.shop.nearbyShops}</Text>
        </Pressable>
        ) : null}
      </View>
      {search.searching ? <Text style={[styles.hint, {color: theme.muted}]}>{t.route.searching}</Text> : null}
      {!search.searching && search.input.trim().length >= 3 && search.options.length === 0 ? <Text style={[styles.hint, {color: theme.muted}]}>{t.route.noResults}</Text> : null}
      <FlatList style={styles.results} data={grouped} keyExtractor={(row) => `${row.item.source}:${row.item.label}:${row.item.lat},${row.item.lng}`} keyboardShouldPersistTaps="handled" renderItem={({item: row}) => {
        const disabled = row.item.id !== undefined && (disabledIds?.has(row.item.id) ?? false);
        return (
        <View>
          {row.header ? <Text style={[styles.header, {color: theme.muted}]}>{row.header}</Text> : null}
          <Pressable style={[styles.row, disabled && styles.disabledRow]} disabled={disabled} onPress={() => { search.select(row.item); onPick(row.item); }} accessibilityRole="button" accessibilityState={{disabled}} accessibilityLabel={row.item.label}>
            <MaterialIcons name={resultIcon(row.item)} size={20} color={disabled ? theme.muted : theme.primary} />
            <View style={styles.rowCol}>
              <Text style={[styles.rowText, {color: disabled ? theme.muted : theme.text}]}>{row.item.label}</Text>
              {disabled && disabledNote ? <Text style={[styles.rowNote, {color: theme.muted}]}>{disabledNote}</Text> : null}
            </View>
          </Pressable>
        </View>
        );
      }} />
      {savedOpen ? (
        <SavedPlacesSheet
          t={t}
          places={savedPlaces}
          loading={savedLoading}
          busy={savedBusy}
          error={savedError}
          onAdd={() => { setSavedError(null); setPickingSaved(true); }}
          onDelete={(id) => void onDeleteSavedPlace(id)}
          onClose={() => { Keyboard.dismiss(); setSavedOpen(false); }}
        />
      ) : null}
      {pickingSaved ? (
        <Overlay visible variant="fullScreen" closeLabel={t.common.cancel} onClose={() => setPickingSaved(false)}>
          <MapPickOverlay
            t={t}
            lang={lang}
            title={t.route.savePlace}
            initial={null}
            onPick={(lat, lng, label) => {
              setDraftPoint({lat, lng});
              setDraftLabel(label);
              setPickingSaved(false);
              void onSaveDraftPlace();
            }}
            onClose={() => setPickingSaved(false)}
          />
        </Overlay>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  screen: {flex: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 8},
  searchRow: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  savedBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center"},
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
  rowCol: {flex: 1, minWidth: 0, gap: 2},
  rowNote: {fontSize: 12},
  disabledRow: {opacity: 0.5},
});
