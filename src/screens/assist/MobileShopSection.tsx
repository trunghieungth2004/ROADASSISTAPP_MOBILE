import {useMemo, useState} from "react";
import {Pressable, ScrollView, StyleSheet, useWindowDimensions, View} from "react-native";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {DispatchTicket, FeedTicket} from "../../api/dispatch";
import StatusRow from "../../components/ui/StatusRow";
import TicketRow from "./TicketRow";

type Props = {
  t: Strings;
  theme: AppTheme;
  tickets: DispatchTicket[];
  loading: boolean;
  locationMissing: boolean;
  onOpen: (ticket: FeedTicket) => void;
};

type SortMode = "closest" | "furthest";
type VehicleFilter = "ALL" | "CAR" | "BIKE";

function toFeed(ticket: DispatchTicket, t: Strings): FeedTicket {
  const riderName = typeof ticket.riderName === "string" && ticket.riderName !== "" ?
    ticket.riderName :
    t.assist.unassigned;
  const party = ticket.riderParty ?? {id: ticket.userId, name: riderName, kind: "RIDER"};
  return {
    ...ticket,
    direction: "in",
    otherParty: party,
    riderParty: party,
  } as FeedTicket;
}

function distanceLabel(ticket: DispatchTicket): string | null {
  if (typeof ticket.distance !== "number" || !Number.isFinite(ticket.distance)) {
    return null;
  }
  if (ticket.distance < 1000) return `${Math.round(ticket.distance)} m`;
  return `${(ticket.distance / 1000).toFixed(1)} km`;
}

function vehicleKind(ticket: DispatchTicket): "CAR" | "BIKE" {
  return ticket.vehicleType === "BIKE" ? "BIKE" : "CAR";
}

export default function MobileShopSection({
  t,
  theme,
  tickets,
  loading,
  locationMissing,
  onOpen,
}: Props) {
  const {height} = useWindowDimensions();
  const listHeight = Math.max(160, Math.min(300, Math.round(height * 0.3)));
  const [sort, setSort] = useState<SortMode>("closest");
  const [vehicle, setVehicle] = useState<VehicleFilter>("ALL");
  const rows = useMemo(() => {
    const filtered = vehicle === "ALL" ?
      tickets :
      tickets.filter((ticket) => vehicleKind(ticket) === vehicle);
    return [...filtered].sort((a, b) => {
      const av = typeof a.distance === "number" ? a.distance : Number.MAX_SAFE_INTEGER;
      const bv = typeof b.distance === "number" ? b.distance : Number.MAX_SAFE_INTEGER;
      return sort === "closest" ? av - bv : bv - av;
    });
  }, [tickets, vehicle, sort]);
  return (
    <View style={styles.wrap}>
      <View style={styles.filterWrap}>
        <Text style={[styles.section, {color: theme.text}]}>{t.assist.mobileShopRequests}</Text>
        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            {(["closest", "furthest"] as const).map((mode) => (
              <Pressable
                key={mode}
                style={[styles.iconChip, {borderColor: theme.primary}, sort === mode && {backgroundColor: theme.primary}]}
                onPress={() => setSort(mode)}
                accessibilityRole="button"
                accessibilityState={{selected: sort === mode}}
                accessibilityLabel={mode === "closest" ? t.assist.sortClosest : t.assist.sortFurthest}
              >
                <MaterialIcons
                  name={mode === "closest" ? "near-me" : "swap-vert"}
                  size={18}
                  color={sort === mode ? "#fff" : theme.primary}
                />
              </Pressable>
            ))}
          </View>
          <View style={[styles.filterGroup, styles.filterGroupRight]}>
            {(["ALL", "CAR", "BIKE"] as const).map((kind) => (
              <Pressable
                key={kind}
                style={[styles.iconChip, {borderColor: theme.primary}, vehicle === kind && {backgroundColor: theme.primary}]}
                onPress={() => setVehicle(kind)}
                accessibilityRole="button"
                accessibilityState={{selected: vehicle === kind}}
                accessibilityLabel={kind === "ALL" ? t.assist.filterAll : kind === "CAR" ? t.assist.vehicleCarFilter : t.assist.vehicleBikeFilter}
              >
                {kind === "CAR" ? (
                  <MaterialIcons name="directions-car" size={18} color={vehicle === kind ? "#fff" : theme.primary} />
                ) : kind === "BIKE" ? (
                  <MaterialCommunityIcons name="motorbike" size={18} color={vehicle === kind ? "#fff" : theme.primary} />
                ) : (
                  <MaterialIcons name="apps" size={18} color={vehicle === kind ? "#fff" : theme.primary} />
                )}
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <ScrollView style={{maxHeight: listHeight}} contentContainerStyle={styles.list} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        {locationMissing ? (
          <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.towLocationNeeded}</Text>
        ) : loading && rows.length === 0 ? (
          <StatusRow theme={theme} text={t.common.loading} />
        ) : rows.length === 0 ? (
          <Text style={[styles.hint, {color: theme.muted}]}>{t.assist.noNearby}</Text>
        ) : (
          rows.map((ticket) => {
            const row = toFeed(ticket, t);
            return (
            <TicketRow
              key={ticket.id}
              t={t}
              theme={theme}
              ticket={row}
              kind="MOBILE_SHOP"
              subtitle={distanceLabel(ticket)}
              onPress={() => onOpen(row)}
            />
          );
        })
      )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  list: {gap: 8},
  filterWrap: {gap: 6},
  section: {fontSize: 15, fontWeight: "700"},
  filterRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap"},
  filterGroup: {flexDirection: "row", alignItems: "center", gap: 8},
  filterGroupRight: {marginLeft: "auto"},
  iconChip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10, alignItems: "center", justifyContent: "center"},
  hint: {fontSize: 12},
});
