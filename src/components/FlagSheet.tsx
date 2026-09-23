import {useState} from "react";
import {Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {MaterialIcons} from "@expo/vector-icons";
import type {FlagType} from "../api/flags";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";

export type FlagReport = {type: FlagType; radiusMeters: number; note?: string};
type Props = {t: Strings; lat: number; lng: number; busy: boolean; centered?: boolean; onClose: () => void; onSubmit: (report: FlagReport) => void};

const TYPES: {id: FlagType; icon: "flood" | "car-crash" | "warning"}[] = [
  {id: "FLOOD", icon: "flood"},
  {id: "ACCIDENT", icon: "car-crash"},
  {id: "OBSTRUCTION", icon: "warning"},
];

export default function FlagSheet({t, lat, lng, busy, centered, onClose, onSubmit}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const [type, setType] = useState<FlagType>("FLOOD");
  const [radiusText, setRadiusText] = useState("50");
  const [note, setNote] = useState("");
  const submit = (): void => {
    const parsed = parseInt(radiusText.replace(/[^0-9]/g, ""), 10);
    const radiusMeters = Number.isFinite(parsed) ? Math.min(1000, Math.max(50, parsed)) : 50;
    onSubmit({type, radiusMeters, note: note.trim() || undefined});
  };
  return (
    <View style={[centered ? styles.card : styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <View style={styles.headRow}>
        <Text style={[styles.title, {color: theme.text}]}>{t.flag.reportTitle}</Text>
        <Pressable style={[styles.closeBtn, {backgroundColor: theme.danger}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={18} color="#fff" />
        </Pressable>
      </View>
      <Text style={[styles.coords, {color: theme.muted}]}>{lat.toFixed(5)}, {lng.toFixed(5)}</Text>
      <Text style={[styles.label, {color: theme.text}]}>{t.flag.type}</Text>
      <View style={styles.typeRow}>
        {TYPES.map((o) => (
          <Pressable
            key={o.id}
            style={[styles.typeBtn, {borderColor: type === o.id ? theme.primary : theme.border, backgroundColor: type === o.id ? `${theme.primary}22` : "transparent"}]}
            onPress={() => setType(o.id)}
          >
            <MaterialIcons name={o.icon} size={20} color={type === o.id ? theme.primary : theme.muted} />
            <Text style={[styles.typeText, {color: type === o.id ? theme.primary : theme.text}]} numberOfLines={1}>
              {o.id === "FLOOD" ? t.flag.flood : o.id === "ACCIDENT" ? t.flag.accident : t.flag.obstruction}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.noteCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.flag.note}</Text>
          <TextInput
            style={[styles.input, {borderColor: theme.border, color: theme.text}]}
            value={note}
            onChangeText={setNote}
            maxLength={280}
          />
        </View>
        <View style={styles.radiusCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.flag.radius} (m)</Text>
          <TextInput
            style={[styles.input, styles.radiusInput, {borderColor: theme.border, color: theme.text}]}
            value={radiusText}
            onChangeText={setRadiusText}
            keyboardType="numeric"
            maxLength={4}
          />
        </View>
      </View>
      <Pressable
        style={[styles.submit, {backgroundColor: theme.primary}, busy && styles.disabled]}
        disabled={busy}
        onPress={submit}
      >
        <Text style={styles.submitText}>{t.flag.submit}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 12, gap: 8, maxHeight: "85%"},
  card: {borderWidth: 1, borderRadius: 16, padding: 16, gap: 10, width: "100%"},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 16, fontWeight: "700"},
  closeBtn: {width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center"},
  coords: {fontSize: 13},
  label: {fontSize: 13, fontWeight: "700"},
  typeRow: {flexDirection: "row", gap: 8},
  typeBtn: {flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4, minWidth: 0},
  typeText: {fontSize: 12, fontWeight: "600", flexShrink: 1},
  fieldRow: {flexDirection: "row", gap: 8, alignItems: "flex-start"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  noteCol: {flex: 1, gap: 8},
  radiusCol: {width: 92, gap: 8},
  radiusInput: {textAlign: "center"},
  submit: {borderRadius: 8, padding: 12, alignItems: "center"},
  submitText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
