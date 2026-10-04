import {ActivityIndicator, View, Pressable, StyleSheet, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {darkTheme, lightTheme} from "../../theme";
import type {Place} from "./PlaceSearch.types";
import type {PlaceSearch} from "./usePlaceSearch";
type Props = {search: PlaceSearch; placeholder: string; noResultsText: string; onSelect: (place: Place) => void; groupLabels?: {saved: string; directory: string; map: string}};
export default function PlaceSearchField({search, placeholder, noResultsText, onSelect, groupLabels = {saved: "Saved", directory: "Directory", map: "Map"}}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const grouped: {header: string | null; item: Place}[] = [];
  let last: string | null = null;
  for (const p of search.options) {
    const header = p.source === "saved" ? groupLabels.saved : p.source === "directory" ? groupLabels.directory : groupLabels.map;
    grouped.push({header: header === last ? null : header, item: p});
    last = header;
  }
  return (
    <View>
      <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} placeholder={placeholder} value={search.input} onChangeText={search.handleInput} />
      {search.searching ? <ActivityIndicator /> : null}
      {!search.searching && search.input.trim().length >= 3 && search.options.length === 0 ? <Text style={[styles.hint, {color: theme.muted}]}>{noResultsText}</Text> : null}
      <View>
        {grouped.map((row) => (
          <View key={`${row.item.source}:${row.item.label}:${row.item.lat},${row.item.lng}`}>
            {row.header ? <Text style={[styles.header, {color: theme.muted}]}>{row.header}</Text> : null}
            <Pressable style={[styles.row, {borderBottomColor: theme.divider}]} onPress={() => { search.select(row.item); onSelect(row.item); }}>
              <Text style={{color: theme.text}}>{row.item.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  hint: {marginTop: 4},
  header: {fontSize: 12, fontWeight: "700", marginTop: 8},
  row: {paddingVertical: 10, borderBottomWidth: 1},
});
