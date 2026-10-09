import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import type {SavedPlace} from "../../api/places";
import Overlay from "../overlay/Overlay";
import StatusRow from "../ui/StatusRow";

type Props = {
  t: Strings;
  places: SavedPlace[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
};

export default function SavedPlacesSheet({t, places, loading, busy, error, onAdd, onDelete, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <Overlay
      visible
      variant="sheet"
      title={t.route.savedPlaces}
      closeLabel={t.common.cancel}
      onClose={onClose}
    >
      <View style={styles.body}>
        {error ? <Text style={[styles.error, {color: theme.danger}]}>{error}</Text> : null}
        {loading && places.length === 0 ? (
          <StatusRow theme={theme} text={t.common.loading} />
        ) : (
          places.map((place) => (
            <View key={place.id} style={[styles.row, {borderColor: theme.border}]}>
              <MaterialIcons name="bookmark" size={18} color={theme.primary} />
              <Text style={[styles.label, {color: theme.text}]} numberOfLines={1}>{place.label}</Text>
              <Pressable onPress={() => onDelete(place.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.delete}>
                <MaterialIcons name="delete-outline" size={20} color={theme.danger} />
              </Pressable>
            </View>
          ))
        )}
        <Pressable style={[styles.addBtn, {backgroundColor: theme.primary}]} onPress={onAdd} accessibilityRole="button" accessibilityLabel={t.common.add}>
          <Text style={styles.addText}>{t.common.add}</Text>
        </Pressable>
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  error: {fontSize: 13},
  row: {flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  label: {flex: 1, fontWeight: "700"},
  addBtn: {borderRadius: 8, padding: 10, alignItems: "center"},
  addText: {color: "#fff", fontWeight: "700"},
});
