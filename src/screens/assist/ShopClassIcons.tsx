import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {Provider} from "../../api/providers";
import {VehicleClassIcons} from "../../components/vehicles/VehicleIcons";

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
  const classes = Array.isArray(shop.vehicleClasses) ? shop.vehicleClasses : [];
  return <VehicleClassIcons classes={classes} size={size ?? 18} color={theme.primary} label={label} />;
}
