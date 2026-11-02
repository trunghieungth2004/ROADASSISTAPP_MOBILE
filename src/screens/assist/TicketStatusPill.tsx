import {StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import {onColor, type AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {statusPillColor, ticketStatusLabel} from "./ticketLabels";

type Props = {
  t: Strings;
  theme: AppTheme;
  status: string;
};

export default function TicketStatusPill({t, theme, status}: Props) {
  const color = statusPillColor(status, theme);
  return (
    <View style={[styles.pill, {backgroundColor: color}]}>
      <Text style={[styles.text, {color: onColor(color)}]} numberOfLines={1}>
        {ticketStatusLabel(status, t)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10, maxWidth: 150},
  text: {fontSize: 11, fontWeight: "700"},
});
