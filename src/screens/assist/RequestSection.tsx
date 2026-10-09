import type {ReactNode} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {TicketType} from "../../api/dispatch";
import {vehicleIcon} from "../route/routeGeo";
import {vehicleButtonState} from "../../components/vehicles/vehicleButtonState";

type Props = {
  t: Strings;
  theme: AppTheme;
  ticketType: TicketType | null;
  onTicketType: (t: TicketType) => void;
  showMechanic: boolean;
  onOpenTicket: (t: TicketType) => void;
  vehicleType: string | null;
  hasVehicles: boolean;
  onOpenVehicle: () => void;
};

const KINDS: {id: TicketType; icon: "sos" | "tow" | "mechanic"}[] = [
  {id: "SOS", icon: "sos"},
  {id: "TOW", icon: "tow"},
  {id: "MECHANIC", icon: "mechanic"},
];

function KindIcon({kind, selected, theme}: {kind: "sos" | "tow" | "mechanic"; selected: boolean; theme: AppTheme}): ReactNode {
  const color = selected ? "#fff" : theme.primary;
  if (kind === "mechanic") return <MaterialIcons name="car-repair" size={22} color={color} />;
  if (kind === "tow") return <MaterialCommunityIcons name="tow-truck" size={22} color={color} />;
  return <MaterialIcons name="sos" size={22} color={color} />;
}

export default function RequestSection({t, theme, ticketType, onTicketType, showMechanic, onOpenTicket, vehicleType, hasVehicles, onOpenVehicle}: Props) {
  const state = vehicleButtonState(hasVehicles, vehicleType !== null);
  const kinds = showMechanic ? KINDS : KINDS.filter((k) => k.id !== "MECHANIC");
  return (
    <View style={styles.wrap}>
      <View style={styles.typeGroup}>
        {kinds.map((kind) => {
          const selected = ticketType === kind.id;
          const open = () => {
            onTicketType(kind.id);
            if (kind.id !== "MECHANIC") onOpenTicket(kind.id);
          };
          return (
            <Pressable
              key={kind.id}
              onPress={open}
              style={[styles.typeBtn, {borderColor: theme.primary, borderWidth: selected ? 2 : 1}, selected && {backgroundColor: theme.primary}]}
              accessibilityRole="button"
              accessibilityState={{checked: selected}}
              accessibilityLabel={kind.id === "SOS" ? t.assist.sos : kind.id === "TOW" ? t.assist.tow : t.assist.mechanic}
            >
              <KindIcon kind={kind.icon} selected={selected} theme={theme} />
            </Pressable>
          );
        })}
        <Pressable
          onPress={onOpenVehicle}
          style={[styles.vehicleBtn, {borderColor: theme.border}, state === "empty" && {borderStyle: "dashed"}]}
          accessibilityRole="button"
          accessibilityLabel={state === "empty" ? t.vehicle.create : t.vehicle.myVehicle}
        >
          <MaterialCommunityIcons name={vehicleIcon(vehicleType ?? undefined)} size={22} color={state === "ready" ? theme.primary : theme.muted} />
          {state === "unselected" ? <View style={[styles.badge, {backgroundColor: theme.danger}]} /> : null}
          {state === "empty" ? (
            <View style={[styles.badge, styles.plusBadge, {backgroundColor: theme.paper, borderColor: theme.primary}]}>
              <MaterialIcons name="add" size={12} color={theme.primary} />
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  typeGroup: {flexDirection: "row", gap: 8},
  typeBtn: {flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, alignItems: "center", justifyContent: "center", minWidth: 52, borderStyle: "solid"},
  vehicleBtn: {width: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  badge: {position: "absolute", right: -3, bottom: -3, width: 12, height: 12, borderRadius: 6},
  plusBadge: {borderWidth: 1, alignItems: "center", justifyContent: "center", width: 16, height: 16, borderRadius: 8},
});
