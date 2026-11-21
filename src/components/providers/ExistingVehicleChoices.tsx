import {Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import {matchingVehicles, plateKey, type ExistingVehicleChoice} from "./existingVehicles";
import {VehicleGlyph} from "../vehicles/VehicleIcons";

type Props = {
  t: Strings;
  theme: AppTheme;
  choices: ExistingVehicleChoice[];
  currentPlate: string;
  onPick: (choice: ExistingVehicleChoice) => void;
};

function kindLabel(choice: ExistingVehicleChoice, t: Strings): string {
  if (choice.kind === "TOW") return t.provider.kindTow;
  if (choice.kind === "MOBILE_SHOP") return t.provider.kindMobileShop;
  return t.vehicle.myVehicle;
}

function statusLabel(choice: ExistingVehicleChoice, t: Strings): string | null {
  if (choice.status === "DENIED") return t.provider.denied;
  if (choice.status === "PENDING") return t.provider.pending;
  if (choice.status === "ACTIVE") return t.provider.active;
  return null;
}

export default function ExistingVehicleChoices({t, theme, choices, currentPlate, onPick}: Props) {
  const rows = matchingVehicles(choices, currentPlate);
  if (rows.length === 0) return null;
  const key = plateKey(currentPlate);
  return (
    <View style={styles.block}>
      <Text style={[styles.label, {color: theme.text}]}>{t.provider.useExistingVehicle}</Text>
      {rows.map((choice) => {
        const match = key !== "" && plateKey(choice.plate) === key;
        const status = statusLabel(choice, t);
        const meta = [
          kindLabel(choice, t),
          choice.vehicleType === "CAR" ? t.vehicle.types.CAR : t.vehicle.types.BIKE,
          status,
          choice.vehicleWidth !== null ? `${choice.vehicleWidth} m` : null,
        ].filter((value): value is string => typeof value === "string" && value !== "").join(" · ");
        return (
          <Pressable
            key={`${choice.kind}-${plateKey(choice.plate)}`}
            style={[styles.row, {borderColor: match ? theme.primary : theme.border, backgroundColor: match ? `${theme.primary}12` : theme.paper}]}
            onPress={() => onPick(choice)}
            accessibilityRole="button"
            accessibilityLabel={`${t.provider.useExistingVehicle} ${choice.plate}`}
          >
            <VehicleGlyph type={choice.vehicleType} size={20} color={theme.primary} />
            <View style={styles.body}>
              <Text style={[styles.plate, {color: theme.text}]} numberOfLines={1}>{choice.plate}</Text>
              <Text style={[styles.meta, {color: theme.muted}]} numberOfLines={1}>
                {choice.label !== null ? `${choice.label} · ${meta}` : meta}
              </Text>
              {match ? (
                <View style={styles.matchRow}>
                  <MaterialIcons name="check-circle" size={13} color={theme.primary} />
                  <Text style={[styles.match, {color: theme.primary}]}>{t.provider.matchesPlate}</Text>
                </View>
              ) : null}
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {gap: 6, paddingTop: 2},
  label: {fontSize: 13, fontWeight: "700"},
  row: {borderWidth: 1, borderRadius: 12, padding: 10, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52},
  body: {flex: 1, minWidth: 0, gap: 2},
  plate: {fontSize: 14, fontWeight: "800"},
  meta: {fontSize: 11, lineHeight: 15},
  matchRow: {flexDirection: "row", alignItems: "center", gap: 3},
  match: {fontSize: 10, fontWeight: "700"},
});
