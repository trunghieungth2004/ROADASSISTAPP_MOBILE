import {StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import {onColor, type AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {statusPillColor, ticketStatusLabel} from "./ticketLabels";

type Props = {
  t: Strings;
  theme: AppTheme;
  status: string;
};

const STATUS_ICONS = {
  "1": "hourglass-empty",
  "2": "navigation",
  "3": "place",
  "4": "check-circle",
  "5": "cancel",
  "6": "build",
  "7": "task-alt",
  "8": "block",
  "9": "request-quote",
  "10": "storefront",
  "11": "request-quote",
  "12": "report-problem",
  "13": "price-change",
  "14": "check-circle-outline",
  "15": "report-problem",
} as const;

export default function TicketStatusPill({t, theme, status}: Props) {
  const color = statusPillColor(status, theme);
  const icon = STATUS_ICONS[status as keyof typeof STATUS_ICONS] ?? "info-outline";
  return (
    <View style={[styles.pill, {backgroundColor: color}]}>
      <MaterialIcons name={icon} size={12} color={onColor(color)} />
      <Text style={[styles.text, {color: onColor(color)}]} numberOfLines={1}>
        {ticketStatusLabel(status, t)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, maxWidth: 150, flexDirection: "row", alignItems: "center", gap: 4},
  text: {fontSize: 11, fontWeight: "700"},
});
