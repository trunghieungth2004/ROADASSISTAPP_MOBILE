import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import type {VehicleType} from "../../api/vehicles";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {vehicleIcon} from "../../screens/route/routeGeo";
import {vehicleTypeName} from "./vehicleMeta";

export const VEHICLE_TYPE_CHOICES: VehicleType[] = ["SCOOTER", "CUB", "MANUAL", "CAR", "VAN", "TRUCK"];

type Props = {
  t: Strings;
  theme: AppTheme;
  type: VehicleType;
  width: string;
  height: string;
  error: string | null;
  onTypeChange: (next: VehicleType) => void;
  onWidthChange: (next: string) => void;
  onHeightChange: (next: string) => void;
};

export default function VehicleCreateSheet({t, theme, type, width, height, error, onTypeChange, onWidthChange, onHeightChange}: Props) {
  return (
    <View style={styles.body}>
      <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.type}</Text>
      <View style={styles.typeRow}>
        {VEHICLE_TYPE_CHOICES.map((vt) => {
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
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={width} onChangeText={onWidthChange} keyboardType="numeric" />
        </View>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.height}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={height} onChangeText={onHeightChange} keyboardType="numeric" />
        </View>
      </View>
      {error ? <Text style={{color: theme.danger}}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "700"},
  typeRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  typeBtn: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 10, minWidth: "30%", flexGrow: 1},
  typeText: {fontSize: 12, fontWeight: "600", flexShrink: 1},
  fieldRow: {flexDirection: "row", gap: 8},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  input: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
});
