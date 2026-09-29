import {useState} from "react";
import {ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, View, KeyboardAvoidingView} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {addRideConfig, type ConfigType} from "../api/vehicles";
import {toMessage} from "../api/client";
import type {AppTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {vehicleTypeName} from "./vehicleMeta";

const CONFIGS: ConfigType[] = ["SOLO", "PASSENGER", "CARGO"];

type Props = {
  t: Strings;
  theme: AppTheme;
  token: string | null;
  profileId: string;
  profileType: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function RideSetupSheet({t, theme, token, profileId, profileType, onClose, onSaved}: Props) {
  const [config, setConfig] = useState<ConfigType>("SOLO");
  const [estWidth, setEstWidth] = useState("");
  const [estHeight, setEstHeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function onSave(): Promise<void> {
    if (!token || busy) return;
    const width = estWidth.trim() === "" ? undefined : Number(estWidth);
    const height = estHeight.trim() === "" ? undefined : Number(estHeight);
    if ((width !== undefined && (!Number.isFinite(width) || width <= 0)) || (height !== undefined && (!Number.isFinite(height) || height <= 0))) {
      setError(t.vehicle.invalidDims);
      return;
    }
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      await addRideConfig({profileId, configType: config, estWidth: width, estHeight: height}, token);
      onSaved();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <Text style={[styles.title, {color: theme.text}]}>
          {t.vehicle.rideSetup} · {vehicleTypeName(profileType, t)}
        </Text>
        <View style={styles.typeRow}>
          {CONFIGS.map((c) => {
            const active = config === c;
            return (
              <Pressable key={c} style={[styles.typeBtn, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} onPress={() => setConfig(c)} accessibilityRole="button">
                <Text style={[styles.typeText, {color: active ? theme.primary : theme.text}]}>{t.vehicle.configs[c]}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.halfCol}>
            <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.estWidth}</Text>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={estWidth} onChangeText={setEstWidth} keyboardType="numeric" />
          </View>
          <View style={styles.halfCol}>
            <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.estHeight}</Text>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={estHeight} onChangeText={setEstHeight} keyboardType="numeric" />
          </View>
        </View>
        {error ? <Text style={{color: theme.danger}}>{error}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onSave()} accessibilityRole="button" accessibilityLabel={t.vehicle.apply}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.vehicle.apply}</Text>}
          </Pressable>
          <Pressable style={[styles.actionBtn, styles.outline, {borderColor: theme.border}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
            <Text style={[styles.actionText, {color: theme.text}]}>{t.common.close}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  sheet: {borderRadius: 20, borderWidth: 1, padding: 12, gap: 8, maxHeight: "85%", overflow: "hidden", width: "100%"},
  title: {fontSize: 16, fontWeight: "700"},
  label: {fontSize: 13, fontWeight: "700"},
  typeRow: {flexDirection: "row", gap: 8},
  typeBtn: {flex: 1, alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4},
  typeText: {fontSize: 13, fontWeight: "600"},
  fieldRow: {flexDirection: "row", gap: 8},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  input: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  outline: {borderWidth: 1, backgroundColor: "transparent"},
  actionText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
