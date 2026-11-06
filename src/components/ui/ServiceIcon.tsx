import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";

export type ServiceKind = "TOW" | "REPAIR" | "SOS";

type Props = {
  service: ServiceKind;
  size?: number;
  color: string;
};

export default function ServiceIcon({service, size = 18, color}: Props) {
  if (service === "TOW") {
    return <MaterialCommunityIcons name="tow-truck" size={size} color={color} />;
  }
  if (service === "REPAIR") {
    return <MaterialIcons name="storefront" size={size} color={color} />;
  }
  return <MaterialIcons name="build" size={size} color={color} />;
}
