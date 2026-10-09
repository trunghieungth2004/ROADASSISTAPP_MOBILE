import {useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {FeedTicket} from "../../api/dispatch";
import StatusRow from "../../components/ui/StatusRow";
import {timeAgoLabel} from "../hazards/hazardFilter";
import {statusPillColor, ticketStatusLabel, ticketTitle, ticketTypeLabel} from "./ticketLabels";
import {RECORD_FILTERS, businessKindOf, filterByKind, filterRecords, roleIconName, type BusinessKind, type RecordFilter} from "./recordFilter";

type Props = {
  t: Strings;
  theme: AppTheme;
  tickets: FeedTicket[];
  loading: boolean;
  shopKinds: Map<string, BusinessKind>;
  onOpen: (ticket: FeedTicket) => void;
};

function filterLabel(filter: RecordFilter, t: Strings): string {
  if (filter === "IN") return t.assist.filterIn;
  if (filter === "OUT") return t.assist.filterOut;
  return t.assist.filterAll;
}

function partyName(ticket: FeedTicket, t: Strings): string {
  if (typeof ticket.otherParty === "object" && ticket.otherParty !== null && typeof ticket.otherParty.name === "string") {
    return ticket.otherParty.name;
  }
  return t.assist.unassigned;
}

export default function RecordsSection({t, theme, tickets, loading, shopKinds, onOpen}: Props) {
  const [filter, setFilter] = useState<RecordFilter>("ALL");
  const [showShop, setShowShop] = useState(true);
  const [showTow, setShowTow] = useState(true);
  const [showRider, setShowRider] = useState(true);
  const operated = new Set(shopKinds.values());
  const visible = filterByKind(filterRecords(tickets, filter), showShop, showTow, showRider, shopKinds);
  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        <View style={styles.filterGroup}>
        {RECORD_FILTERS.map((f) => {
          const selected = filter === f;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.filterChip, {borderColor: theme.primary}, selected && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{selected}} accessibilityLabel={filterLabel(f, t)}>
              <Text style={{color: selected ? "#fff" : theme.text}}>{filterLabel(f, t)}</Text>
            </Pressable>
          );
        })}
        </View>
        <View style={styles.filterGroup}>
        {operated.has("SHOP") ? (
          <Pressable onPress={() => setShowShop((v) => !v)} style={[styles.iconChip, {borderColor: theme.primary}, showShop && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{selected: showShop}} accessibilityLabel={t.shop.title}>
            <MaterialIcons name="storefront" size={18} color={showShop ? "#fff" : theme.primary} />
          </Pressable>
        ) : null}
        {operated.has("TOW") ? (
          <Pressable onPress={() => setShowTow((v) => !v)} style={[styles.iconChip, {borderColor: theme.primary}, showTow && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{selected: showTow}} accessibilityLabel={t.assist.typeTow}>
            <MaterialCommunityIcons name="tow-truck" size={18} color={showTow ? "#fff" : theme.primary} />
          </Pressable>
        ) : null}
          <Pressable onPress={() => setShowRider((v) => !v)} style={[styles.iconChip, {borderColor: theme.primary}, showRider && {backgroundColor: theme.primary}]} accessibilityRole="button" accessibilityState={{selected: showRider}} accessibilityLabel={t.assist.filterRider}>
            <MaterialIcons name="person" size={18} color={showRider ? "#fff" : theme.primary} />
          </Pressable>
        </View>
      </View>
      {loading && tickets.length === 0 ? (
        <StatusRow theme={theme} text={t.common.loading} />
      ) : visible.length === 0 ? (
        <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.emptyRecords}</Text>
      ) : (
        visible.map((item) => {
          const inbound = item.direction === "in";
          const ago = typeof item.createdAt === "string" ? timeAgoLabel(item.createdAt, Date.now(), t.hazards) : null;
          return (
            <Pressable key={item.id} onPress={() => onOpen(item)} accessibilityRole="button" accessibilityLabel={ticketTitle(item, t)}>
              <View style={[styles.innerCard, {backgroundColor: theme.paper, borderColor: theme.border}]}>
                <View style={styles.titleRow}>
                  {(() => {
                    const icon = roleIconName(businessKindOf(item, shopKinds));
                    return icon.set === "community" ? (
                      <MaterialCommunityIcons name={icon.name as never} size={16} color={theme.muted} />
                    ) : (
                      <MaterialIcons name={icon.name as never} size={16} color={theme.muted} />
                    );
                  })()}
                  <MaterialIcons name={inbound ? "arrow-downward" : "arrow-upward"} size={16} color={inbound ? theme.primary : theme.muted} />
                  <Text style={[styles.cardTitle, {color: theme.text}]}>{ticketTypeLabel(item.ticketType, t)}</Text>
                  <View style={[styles.pill, {backgroundColor: statusPillColor(item.status, theme)}]}>
                    <Text style={styles.pillText}>{ticketStatusLabel(item.status, t)}</Text>
                  </View>
                </View>
                <View style={styles.subRow}>
                  <Text style={[styles.coords, {color: theme.muted}]} numberOfLines={1}>{partyName(item, t)}</Text>
                  {ago ? <Text style={[styles.coords, {color: theme.muted}]}>{ago}</Text> : null}
                </View>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  filterRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap"},
  filterGroup: {flexDirection: "row", alignItems: "center", gap: 8},
  filterChip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 14},
  iconChip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center"},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 4},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 6},
  cardTitle: {fontWeight: "700", flex: 1},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  pillText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  subRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  coords: {fontSize: 12},
  hint: {fontSize: 12},
});
