import {View, StyleSheet} from "react-native";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import {vehicleIcon} from "../../screens/route/routeGeo";

export function VehicleGlyph({
  type,
  size = 20,
  color,
}: {
  type?: string | null;
  size?: number;
  color: string;
}) {
  return <MaterialCommunityIcons name={vehicleIcon(type ?? undefined)} size={size} color={color} />;
}

export function VehicleClassGlyph({
  vehicleClass,
  size = 20,
  color,
}: {
  vehicleClass: string;
  size?: number;
  color: string;
}) {
  return (
    <MaterialCommunityIcons
      name={vehicleClass === "CAR" ? "car" : "motorbike"}
      size={size}
      color={color}
    />
  );
}

export function VehicleClassIcons({
  classes,
  size = 16,
  color,
  label,
}: {
  classes: string[];
  size?: number;
  color: string;
  label: string;
}) {
  const bike = classes.length === 0 || classes.some((value) => value !== "CAR");
  const car = classes.length === 0 || classes.some((value) => value === "CAR");
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={label}>
      {bike ? <MaterialCommunityIcons name="motorbike" size={size} color={color} /> : null}
      {car ? <MaterialCommunityIcons name="car" size={size} color={color} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: "row", alignItems: "center", gap: 4},
});
