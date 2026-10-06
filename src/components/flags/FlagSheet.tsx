import {useState} from "react";
import {Image, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {FlagType} from "../../api/flags";
import {formatPoint} from "../../api/places";
import {darkTheme, lightTheme} from "../../theme";
import {hazardKind} from "./hazardStyle";
import type {Strings} from "../../i18n/en";

export type FlagReport = {type: FlagType; radiusMeters: number; note?: string};

export type FlagDraftState = {
  type: FlagType;
  radiusMeters: number;
  note: string;
  setType: (next: FlagType) => void;
  setRadiusMeters: (next: number) => void;
  setNote: (next: string) => void;
  build: () => FlagReport;
};

export function useFlagDraft(): FlagDraftState {
  const [type, setType] = useState<FlagType>("FLOOD");
  const [radiusMeters, setRadiusMeters] = useState(50);
  const [note, setNote] = useState("");
  return {
    type,
    radiusMeters,
    note,
    setType,
    setRadiusMeters,
    setNote,
    build: () => ({type, radiusMeters, note: note.trim() || undefined}),
  };
}

type Props = {t: Strings; lat: number; lng: number; draft: FlagDraftState};

const TYPES: {id: FlagType; icon: "flood" | "car-crash" | "construction"}[] = [
  {id: "FLOOD", icon: "flood"},
  {id: "ACCIDENT", icon: "car-crash"},
  {id: "OBSTRUCTION", icon: "construction"},
];

const RADII = [25, 50, 100, 200, 250];

const PREVIEW: Record<FlagType, number> = {
  FLOOD: require("../../../assets/map/hazards/pin-flood-1.png"),
  ACCIDENT: require("../../../assets/map/hazards/pin-accident-1.png"),
  OBSTRUCTION: require("../../../assets/map/hazards/pin-obstruction-1.png"),
};

export default function FlagSheet({t, lat, lng, draft}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [typeOpen, setTypeOpen] = useState(false);
  const current = TYPES.find((o) => o.id === draft.type) ?? TYPES[0];
  const currentKind = hazardKind(current.id);
  return (
    <View style={styles.body}>
      <View style={styles.locRow}>
        <Image source={PREVIEW[draft.type]} style={styles.preview} />
        <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(lat, lng)}</Text>
      </View>
      <View style={styles.topRow}>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.flag.type}</Text>
          <Pressable
            style={[styles.dropHeader, {borderColor: theme.border}]}
            onPress={() => setTypeOpen((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{expanded: typeOpen}}
            accessibilityLabel={t.flag.type}
          >
            <MaterialIcons name={current.icon} size={18} color={currentKind.color} />
            <Text style={[styles.typeText, {color: theme.text}]} numberOfLines={1}>
              {current.id === "FLOOD" ? t.flag.flood : current.id === "ACCIDENT" ? t.flag.accident : t.flag.obstruction}
            </Text>
            <MaterialIcons name={typeOpen ? "expand-less" : "expand-more"} size={20} color={theme.muted} />
          </Pressable>
          {typeOpen ? (
            <View style={styles.dropList}>
              {TYPES.map((o) => {
                const kind = hazardKind(o.id);
                const active = draft.type === o.id;
                return (
                  <Pressable
                    key={o.id}
                    style={[styles.typeBtn, {borderColor: active ? kind.color : theme.border, backgroundColor: active ? `${kind.color}22` : "transparent"}]}
                    onPress={() => { draft.setType(o.id); setTypeOpen(false); }}
                    accessibilityRole="button"
                    accessibilityState={{checked: active}}
                  >
                    <MaterialIcons name={o.icon} size={18} color={active ? kind.color : theme.muted} />
                    <Text style={[styles.typeText, {color: active ? kind.color : theme.text}]} numberOfLines={1}>
                      {o.id === "FLOOD" ? t.flag.flood : o.id === "ACCIDENT" ? t.flag.accident : t.flag.obstruction}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.flag.note}</Text>
          <TextInput
            style={[styles.noteInput, {borderColor: theme.border, color: theme.text}]}
            value={draft.note}
            onChangeText={draft.setNote}
            maxLength={280}
            multiline
          />
        </View>
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.flag.radius} (m)</Text>
      <View style={styles.radiusRow}>
        {RADII.map((r) => (
          <Pressable
            key={r}
            style={[styles.radiusChip, {borderColor: draft.radiusMeters === r ? theme.primary : theme.border, backgroundColor: draft.radiusMeters === r ? `${theme.primary}22` : "transparent"}]}
            onPress={() => draft.setRadiusMeters(r)}
            accessibilityRole="button"
            accessibilityState={{checked: draft.radiusMeters === r}}
          >
            <Text style={[styles.radiusText, {color: draft.radiusMeters === r ? theme.primary : theme.text}]}>{r}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  locRow: {flexDirection: "row", alignItems: "center", gap: 8},
  coords: {fontSize: 12, flex: 1},
  preview: {width: 40, height: 40},
  label: {fontSize: 13, fontWeight: "700"},
  topRow: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  dropHeader: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 8, minHeight: 48},
  dropList: {gap: 6},
  typeCol: {gap: 6},
  typeBtn: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 8, minHeight: 44},
  typeText: {fontSize: 12, fontWeight: "600", flexShrink: 1},
  noteInput: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14, minHeight: 148, textAlignVertical: "top"},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  radiusRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  radiusChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 12, paddingHorizontal: 8, flexGrow: 1, flexBasis: "30%", minHeight: 48, alignItems: "center", justifyContent: "center"},
  radiusText: {fontSize: 13, fontWeight: "700"},
});
