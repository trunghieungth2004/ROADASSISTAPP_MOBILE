import {Pressable, StyleSheet, View} from "react-native";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {FeedTicket} from "../../api/dispatch";
import {statusPillColor, ticketStatusLabel, ticketTitle} from "./ticketLabels";
import {delayReasonLabel} from "./delayReasons";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticket: FeedTicket;
  title: string;
  line: string;
  pills?: string[];
  icon: "tow" | "sos" | "pending";
  tone: string;
  iconTone?: string;
  warning?: string | null;
  onPress: () => void;
};

export default function ActiveJobCard({
  t,
  theme,
  ticket,
  title,
  line,
  pills = [],
  icon,
  tone,
  iconTone,
  warning,
  onPress,
}: Props) {
  return (
    <Pressable
      style={[styles.card, {backgroundColor: theme.paper, borderColor: tone}]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={ticketTitle(ticket, t)}
    >
      <View style={styles.head}>
        {icon === "sos" ? (
          <MaterialIcons name="build" size={20} color={iconTone ?? tone} />
        ) : (
          <MaterialCommunityIcons name="tow-truck" size={20} color={iconTone ?? tone} />
        )}
        <Text style={[styles.title, {color: theme.text}]}>{title}</Text>
        <View style={[styles.pill, {backgroundColor: statusPillColor(ticket.status, theme)}]}>
          <Text style={styles.pillText}>{ticketStatusLabel(ticket.status, t, {direction: ticket.direction, ticketType: ticket.ticketType})}</Text>
        </View>
      </View>
      <View style={styles.metaRow}>
        <Text style={[styles.line, {color: theme.muted}]} numberOfLines={1}>{line}</Text>
        {ticket.warrantyOfTicketId ? (
          <View style={[styles.metaPill, {borderColor: theme.primary, backgroundColor: `${theme.primary}1f`}]}>
            <Text style={[styles.metaPillText, {color: theme.primary}]}>{t.provider.warrantyRework}</Text>
          </View>
        ) : null}
        {pills.length > 0 ? (
          <View testID="active-job-pills" style={styles.pills}>
            {pills.map((pill) => (
              <View key={pill} style={[styles.metaPill, {borderColor: theme.border, backgroundColor: theme.background}]}>
                <Text style={[styles.metaPillText, {color: theme.text}]}>{pill}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {warning ? <Text style={[styles.line, {color: "#f59e0b"}]}>{warning}</Text> : null}
      {ticket.hold ? (
        <View style={styles.delayRow}>
          <MaterialIcons name="schedule" size={14} color="#111111" />
          <Text style={styles.delayText} numberOfLines={1}>
            {[
              t.assist.delayActive,
              delayReasonLabel(ticket.hold.reason, t),
              typeof ticket.hold.etaAt === "string" ?
                `${t.assist.holdUntil} ${new Date(ticket.hold.etaAt).toLocaleTimeString(undefined, {hour: "2-digit", minute: "2-digit"})}` :
                null,
            ].filter((part): part is string => typeof part === "string" && part !== "").join(" · ")}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {borderWidth: 2, borderRadius: 12, padding: 12, gap: 6},
  head: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {fontWeight: "700", flex: 1},
  pill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  pillText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  metaRow: {flexDirection: "row", alignItems: "center", gap: 8},
  pills: {flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto"},
  metaPill: {borderWidth: 1, borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  metaPillText: {fontSize: 11, fontWeight: "700"},
  line: {fontSize: 12, flexShrink: 1},
  delayRow: {flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: "#facc15"},
  delayText: {flex: 1, color: "#111111", fontSize: 11, fontWeight: "700"},
});
