import {useState} from "react";
import {Image, Keyboard, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {FlagType} from "../api/flags";
import {darkTheme, lightTheme} from "../theme";
import {hazardKind} from "./hazardStyle";
import type {Strings} from "../i18n/en";

export type FlagReport = {type: FlagType; radiusMeters: number; note?: string};
type Props = {t: Strings; lat: number; lng: number; busy: boolean; centered?: boolean; onClose: () => void; onSubmit: (report: FlagReport) => void};

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

export default function FlagSheet({t, lat, lng, busy, centered, onClose, onSubmit}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [type, setType] = useState<FlagType>("FLOOD");
  const [radiusMeters, setRadiusMeters] = useState(50);
  const [note, setNote] = useState("");
  const submit = (): void => {
    Keyboard.dismiss();
    onSubmit({type, radiusMeters, note: note.trim() || undefined});
  };
  const close = (): void => {
    Keyboard.dismiss();
    onClose();
  };
  void lat;
  void lng;
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
    <View style={styles.body}>
      <View style={styles.headRow}>
        <Image source={PREVIEW[type]} style={styles.preview} />
        <Text style={[styles.title, {color: theme.text}]}>{t.flag.reportTitle}</Text>
      </View>
      <View style={styles.headRow}>
        <Text style={[styles.title, {color: theme.text}]}>{t.flag.reportTitle}</Text>
      </View>
      <Text style={[styles.label, {color: theme.text}]}>{t.flag.type}</Text>
      <View style={styles.typeRow}>
        {TYPES.map((o) => {
          const kind = hazardKind(o.id);
          const active = type === o.id;
          return (
            <Pressable
              key={o.id}
              style={[styles.typeBtn, {borderColor: active ? kind.color : theme.border, backgroundColor: active ? `${kind.color}22` : "transparent"}]}
              onPress={() => setType(o.id)}
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
            value={note}
            onChangeText={setNote}
            maxLength={280}
          />
        </View>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.flag.radius} (m)</Text>
          <View style={styles.radiusRow}>
            {RADII.map((r) => (
              <Pressable
                key={r}
                style={[styles.radiusChip, {borderColor: radiusMeters === r ? theme.primary : theme.border, backgroundColor: radiusMeters === r ? `${theme.primary}22` : "transparent"}]}
                onPress={() => setRadiusMeters(r)}
              >
                <Text style={[styles.radiusText, {color: radiusMeters === r ? theme.primary : theme.text}]}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <View style={styles.actionRow}>
        <Pressable
          style={[styles.submit, styles.actionFlex, {backgroundColor: theme.primary}, busy && styles.disabled]}
          disabled={busy}
          onPress={submit}
        >
          <Text style={styles.submitText}>{t.flag.submit}</Text>
        </Pressable>
        <Pressable
          style={[styles.submit, styles.actionFlex, styles.cancelBtn, {borderColor: theme.border, backgroundColor: theme.paper}, busy && styles.disabled]}
          disabled={busy}
          onPress={close}
        >
          <Text style={[styles.submitText, {color: theme.text}]}>{t.common.close}</Text>
        </Pressable>
      </View>
    </View>
    </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  sheet: {borderRadius: 20, borderWidth: 1, padding: 12, gap: 8, maxHeight: "85%"},
  card: {borderWidth: 1, borderRadius: 16, padding: 12, gap: 8, width: "100%"},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  preview: {width: 40, height: 40},
  title: {flex: 1, fontSize: 16, fontWeight: "700"},
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
  actionRow: {flexDirection: "row", gap: 8},
  actionFlex: {flex: 1},
  cancelBtn: {borderWidth: 1, backgroundColor: "transparent"},
  submit: {borderRadius: 8, padding: 10, alignItems: "center"},
  submitText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
