import {MaterialCommunityIcons} from "@expo/vector-icons";

const ICONS = {
  FLAT_TIRE: "tire",
  FLUID_LEAK: "oil",
  CHAIN_SLACK: "link-variant",
  SPARK_CAP: "flash",
  ELECTRICAL: "lightning-bolt",
  ENGINE: "engine",
  BRAKES: "car-brake-alert",
  OTHER: "dots-horizontal",
} as const;

export default function ServiceCategoryIcon({
  category,
  size = 20,
  color,
}: {
  category: string;
  size?: number;
  color: string;
}) {
  const icon = ICONS[category as keyof typeof ICONS] ?? ICONS.OTHER;
  return <MaterialCommunityIcons name={icon} size={size} color={color} />;
}
