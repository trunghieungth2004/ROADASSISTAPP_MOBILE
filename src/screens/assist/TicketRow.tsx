import {Pressable, StyleSheet, View} from "react-native";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {FeedTicket} from "../../api/dispatch";
import {timeAgoLabel} from "../hazards/hazardFilter";
import {statusPillColor, ticketStatusLabel, ticketTitle, ticketTypeLabel} from "./ticketLabels";
import {roleIconName, type BusinessKind} from "./recordFilter";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticket: FeedTicket;
  kind: BusinessKind | null;
  onPress: () => void;
  subtitle?: string | null;
  showParty?: boolean;
};

function partyName(ticket: FeedTicket, t: Strings): string {
  if (typeof ticket.otherParty === "object" && ticket.otherParty !== null && typeof ticket.otherParty.name === "string") {
    return ticket.otherParty.name;
  }
  return t.assist.unassigned;
}

export default function TicketRow({t, theme, ticket, kind, onPress, subtitle = null, showParty = true}: Props) {
  const inbound = ticket.direction === "in";
  const ago = typeof ticket.createdAt === "string" ? timeAgoLabel(ticket.createdAt, Date.now(), t.hazards) : null;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={ticketTitle(ticket, t)}>
      <View style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
        <View style={styles.titleRow}>
          {(() => {
            const icon = roleIconName(kind);
            return icon.set === "community" ? (
              <MaterialCommunityIcons name={icon.name as never} size={16} color={theme.muted} />
            ) : (
              <MaterialIcons name={icon.name as never} size={16} color={theme.muted} />
            );
          })()}
          <MaterialIcons name={inbound ? "arrow-downward" : "arrow-upward"} size={16} color={inbound ? theme.primary : theme.muted} />
          <Text style={[styles.cardTitle, {color: theme.text}]}>{ticketTypeLabel(ticket.ticketType, t)}</Text>
          <View style={[styles.pill, {backgroundColor: statusPillColor(ticket.status, theme)}]}>
            <Text style={styles.pillText}>{ticketStatusLabel(ticket.status, t)}</Text>
          </View>
        </View>
        <View style={styles.subRow}>
          {showParty ? <Text style={[styles.coords, {color: theme.muted}]} numberOfLines={1}>{partyName(ticket, t)}</Text> : null}
          {subtitle !== null ? <Text style={[styles.coords, {color: theme.muted}]}>{subtitle}</Text> : ago !== null ? <Text style={[styles.coords, {color: theme.muted}]}>{ago}</Text> : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 4},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 6},
  cardTitle: {fontWeight: "700", flex: 1},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  pillText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  subRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  coords: {fontSize: 12},
});