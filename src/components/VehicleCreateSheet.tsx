import {useState} from "react";
import {ActivityIndicator, Keyboard, Platform, Pressable, StyleSheet, View, KeyboardAvoidingView} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "./AppText";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import {addRideConfig, createProfile, VEHICLE_DEFAULT_WIDTH, type VehicleType} from "../api/vehicles";
import {toMessage} from "../api/client";
import type {AppTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {vehicleIcon} from "../screens/route/routeGeo";
import {vehicleTypeName} from "./vehicleMeta";

const TYPES: VehicleType[] = ["SCOOTER", "CUB", "MANUAL", "CAR", "VAN", "TRUCK"];

type Props = {
  t: Strings;
  theme: AppTheme;
  token: string | null;
  onClose: () => void;
  onCreated: () => void;
};

export default function VehicleCreateSheet({t, theme, token, onClose, onCreated}: Props) {
  const [type, setType] = useState<VehicleType>("SCOOTER");
  const [width, setWidth] = useState("0.7");
  const [height, setHeight] = useState("1.1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  function onTypeChange(next: VehicleType): void {
    setType(next);
    setWidth(String(VEHICLE_DEFAULT_WIDTH[next] ?? 0.7));
    setHeight(next === "CAR" ? "1.5" : "1.1");
  }
  async function onSave(): Promise<void> {
    if (!token || busy) return;
    Keyboard.dismiss();
    setBusy(true);
    setError(null);
    try {
      const created = await createProfile({type, baseWidth: Number(width), baseHeight: Number(height)}, token);
      await addRideConfig({profileId: created.id, configType: "SOLO"}, token);
      onCreated();
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <Text style={[styles.title, {color: theme.text}]}>{t.vehicle.create}</Text>
        <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.type}</Text>
        <View style={styles.typeRow}>
          {TYPES.map((vt) => {
            const active = type === vt;
            return (
              <Pressable key={vt} style={[styles.typeBtn, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} onPress={() => onTypeChange(vt)} accessibilityRole="button">
                <MaterialCommunityIcons name={vehicleIcon(vt)} size={20} color={active ? theme.primary : theme.muted} />
                <Text style={[styles.typeText, {color: active ? theme.primary : theme.text}]} numberOfLines={1}>
                  {vehicleTypeName(vt, t)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.fieldRow}>
          <View style={styles.halfCol}>
            <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.widthMeters}</Text>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={width} onChangeText={setWidth} keyboardType="numeric" />
          </View>
          <View style={styles.halfCol}>
            <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.height}</Text>
            <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={height} onChangeText={setHeight} keyboardType="numeric" />
          </View>
        </View>
        {error ? <Text style={{color: theme.danger}}>{error}</Text> : null}
        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, busy && styles.disabled]} disabled={busy} onPress={() => void onSave()} accessibilityRole="button" accessibilityLabel={t.common.save}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.common.save}</Text>}
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
  typeRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  typeBtn: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, minWidth: "30%", flexGrow: 1},
  typeText: {fontSize: 12, fontWeight: "600", flexShrink: 1},
  fieldRow: {flexDirection: "row", gap: 8},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  input: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
  actionRow: {flexDirection: "row", gap: 8},
  actionBtn: {flex: 1, borderRadius: 8, padding: 10, alignItems: "center"},
  outline: {borderWidth: 1, backgroundColor: "transparent"},
  actionText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
});
