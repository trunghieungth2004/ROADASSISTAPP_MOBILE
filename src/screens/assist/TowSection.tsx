import {Pressable, StyleSheet, View} from "react-native";
import {MaterialCommunityIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {DispatchTicket} from "../../api/dispatch";
import {formatPoint} from "../../api/places";
import StatusRow from "../../components/ui/StatusRow";
import {statusPillColor, ticketStatusLabel, ticketTitle} from "./ticketLabels";

function towDistance(item: DispatchTicket, t: Strings): string {
  if (typeof item.distance !== "number" || !Number.isFinite(item.distance) || item.distance < 0) {
    return formatPoint(item.lat, item.lng);
  }
  const meters = Math.round(item.distance);
  if (meters < 1000) return t.shop.radiusM.replace("{n}", String(meters));
  return t.shop.radiusKm.replace("{n}", (meters / 1000).toFixed(1));
}

type Props = {
  t: Strings;
  theme: AppTheme;
  tickets: DispatchTicket[];
  loading: boolean;
  onOpen: (id: string) => void;
};

export default function TowSection({t, theme, tickets, loading, onOpen}: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={[styles.section, {color: theme.text}]}>{t.assist.nearby}</Text>
      {loading && tickets.length === 0 ? (
        <StatusRow theme={theme} text={t.common.loading} />
      ) : tickets.length === 0 ? (
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.noNearby}</Text>
      ) : (
        tickets.map((item) => (
          <Pressable key={item.id} style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={() => onOpen(item.id)} accessibilityRole="button" accessibilityLabel={ticketTitle(item, t)}>
            <View style={styles.headRow}>
              <MaterialCommunityIcons name="tow-truck" size={20} color={theme.primary} />
              <Text style={[styles.cardTitle, {color: theme.text}]}>{ticketTitle(item, t)}</Text>
              <View style={[styles.pill, {backgroundColor: statusPillColor(item.status, theme)}]}>
                <Text style={styles.pillText}>{ticketStatusLabel(item.status, t)}</Text>
              </View>
            </View>
            {typeof item.note === "string" && item.note ? <Text style={{color: theme.text}}>{item.note}</Text> : null}
            <Text style={[styles.coords, {color: theme.muted}]}>{towDistance(item, t)}</Text>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  section: {fontSize: 15, fontWeight: "700"},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  cardTitle: {fontWeight: "700", flex: 1},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  coords: {fontSize: 12},
  hint: {fontSize: 12},
});
