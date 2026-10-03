import {useState} from "react";
import {Image, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {FlagType} from "../api/flags";
import {formatPoint} from "../api/places";
import {darkTheme, lightTheme} from "../theme";
import {hazardKind} from "./hazardStyle";
import type {Strings} from "../i18n/en";

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
  FLOOD: require("../../assets/map/pin-flood-1.png"),
  ACCIDENT: require("../../assets/map/pin-accident-1.png"),
  OBSTRUCTION: require("../../assets/map/pin-obstruction-1.png"),
};

export default function FlagSheet({t, lat, lng, draft}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  return (
    <View style={styles.body}>
      <View style={styles.locRow}>
        <Image source={PREVIEW[draft.type]} style={styles.preview} />
        <Text style={[styles.coords, {color: theme.muted}]}>{formatPoint(lat, lng)}</Text>
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.flag.type}</Text>
      <View style={styles.typeRow}>
        {TYPES.map((o) => {
          const kind = hazardKind(o.id);
          const active = draft.type === o.id;
          return (
            <Pressable
              key={o.id}
              style={[styles.typeBtn, {borderColor: active ? kind.color : theme.border, backgroundColor: active ? `${kind.color}22` : "transparent"}]}
              onPress={() => draft.setType(o.id)}
            >
              <MaterialIcons name={o.icon} size={20} color={active ? kind.color : theme.muted} />
              <Text style={[styles.typeText, {color: active ? kind.color : theme.text}]} numberOfLines={1}>
                {o.id === "FLOOD" ? t.flag.flood : o.id === "ACCIDENT" ? t.flag.accident : t.flag.obstruction}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.flag.note}</Text>
          <TextInput
            style={[styles.input, {borderColor: theme.border, color: theme.text}]}
            value={draft.note}
            onChangeText={draft.setNote}
            maxLength={280}
          />
        </View>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.flag.radius} (m)</Text>
          <View style={styles.radiusRow}>
            {RADII.map((r) => (
              <Pressable
                key={r}
                style={[styles.radiusChip, {borderColor: draft.radiusMeters === r ? theme.primary : theme.border, backgroundColor: draft.radiusMeters === r ? `${theme.primary}22` : "transparent"}]}
                onPress={() => draft.setRadiusMeters(r)}
              >
                <Text style={[styles.radiusText, {color: draft.radiusMeters === r ? theme.primary : theme.text}]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>
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
  typeRow: {flexDirection: "row", gap: 8},
  typeBtn: {flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 4, minWidth: 0},
  typeText: {fontSize: 12, fontWeight: "600", flexShrink: 1},
  fieldRow: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  input: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  radiusRow: {flexDirection: "row", gap: 4},
  radiusChip: {borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 2, flex: 1, minWidth: 0, alignItems: "center"},
  radiusText: {fontSize: 11, fontWeight: "700"},
});
