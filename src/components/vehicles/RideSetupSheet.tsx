import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text, AppTextInput as TextInput} from "../ui/AppText";
import type {ConfigType} from "../../api/vehicles";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";

export const RIDE_CONFIG_CHOICES: ConfigType[] = ["SOLO", "PASSENGER", "CARGO"];

type Props = {
  t: Strings;
  theme: AppTheme;
  config: ConfigType;
  estWidth: string;
  estHeight: string;
  error: string | null;
  onConfigChange: (next: ConfigType) => void;
  onEstWidthChange: (next: string) => void;
  onEstHeightChange: (next: string) => void;
};

export default function RideSetupSheet({t, theme, config, estWidth, estHeight, error, onConfigChange, onEstWidthChange, onEstHeightChange}: Props) {
  return (
    <View style={styles.body}>
      <View style={styles.typeRow}>
        {RIDE_CONFIG_CHOICES.map((c) => {
          const active = config === c;
          return (
            <Pressable key={c} style={[styles.typeBtn, {borderColor: active ? theme.primary : theme.border, backgroundColor: active ? `${theme.primary}22` : "transparent"}]} onPress={() => onConfigChange(c)} accessibilityRole="button">
              <Text style={[styles.typeText, {color: active ? theme.primary : theme.text}]}>{t.vehicle.configs[c]}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.fieldRow}>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.estWidth}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={estWidth} onChangeText={onEstWidthChange} keyboardType="numeric" />
        </View>
        <View style={styles.halfCol}>
          <Text style={[styles.label, {color: theme.text}]}>{t.vehicle.estHeight}</Text>
          <TextInput style={[styles.input, {borderColor: theme.border, color: theme.text}]} value={estHeight} onChangeText={onEstHeightChange} keyboardType="numeric" />
        </View>
      </View>
      {error ? <Text style={{color: theme.danger}}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  label: {fontSize: 13, fontWeight: "700"},
  typeRow: {flexDirection: "row", gap: 8},
  typeBtn: {flex: 1, alignItems: "center", borderWidth: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 4},
  typeText: {fontSize: 13, fontWeight: "600"},
  fieldRow: {flexDirection: "row", gap: 8},
  halfCol: {flex: 1, minWidth: 0, gap: 8},
  input: {borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 14},
});
