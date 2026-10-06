import {StyleSheet, View} from "react-native";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {Provider} from "../../api/providers";

export function servesBike(shop: Pick<Provider, "vehicleClasses">): boolean {
  const classes = Array.isArray(shop.vehicleClasses) ? shop.vehicleClasses : [];
  return classes.length !== 1 || classes[0] !== "CAR";
}

export function servesCar(shop: Pick<Provider, "vehicleClasses">): boolean {
  const classes = Array.isArray(shop.vehicleClasses) ? shop.vehicleClasses : [];
  return classes.length !== 1 || classes[0] !== "SOLO_BIKE";
}

export function classIconLabel(shop: Pick<Provider, "vehicleClasses">, t: Strings): string {
  if (servesBike(shop) && servesCar(shop)) return t.shop.bothClasses;
  if (servesCar(shop)) return t.shop.vehicleCar;
  return t.shop.vehicleBike;
}

export default function ShopClassIcons({theme, shop, label, size}: {theme: AppTheme; shop: Pick<Provider, "vehicleClasses">; label: string; size?: number}) {
  const glyph = size ?? 18;
  return (
    <View style={styles.row} accessibilityRole="text" accessibilityLabel={label}>
      {servesBike(shop) ? <MaterialCommunityIcons name="motorbike" size={glyph} color={theme.primary} /> : null}
      {servesCar(shop) ? <MaterialCommunityIcons name="car" size={glyph} color={theme.primary} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: "row", alignItems: "center", gap: 4},
});
