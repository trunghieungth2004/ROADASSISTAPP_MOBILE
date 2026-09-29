import {useEffect, useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "./AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import {listProfiles, type VehicleProfile} from "../api/vehicles";
import {toMessage} from "../api/client";
import type {AppTheme} from "../theme";
import type {Strings} from "../i18n/en";
import {vehicleIcon} from "../screens/route/routeGeo";
import StatusRow from "./StatusRow";
import {vehicleMeta, vehicleTypeName} from "./vehicleMeta";

type Props = {
  t: Strings;
  theme: AppTheme;
  token: string | null;
  activeId: string | null;
  onPick: (profileId: string) => void;
  onClose: () => void;
};

export default function VehiclePickerSheet({t, theme, token, activeId, onPick, onClose}: Props) {
  const [profiles, setProfiles] = useState<VehicleProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    setError(null);
    listProfiles(token)
      .then((list) => {
        if (alive) setProfiles(list);
      })
      .catch((err) => {
        if (alive) setError(toMessage(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token]);
  return (
    <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <View style={styles.headRow}>
        <Text style={[styles.title, {color: theme.text}]}>{t.vehicle.title}</Text>
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={22} color={theme.text} />
        </Pressable>
      </View>
      {error ? <Text style={{color: theme.danger}}>{error}</Text> : null}
      {loading ? <StatusRow theme={theme} text={t.vehicle.loading} /> : null}
      {!loading && !error && profiles.length === 0 ? <Text style={{color: theme.muted}}>{t.vehicle.empty}</Text> : null}
      {profiles.map((v) => (
        <Pressable key={v.id} style={styles.vehicleRow} onPress={() => onPick(v.id)} accessibilityRole="button">
          <MaterialIcons name={activeId === v.id ? "radio-button-checked" : "radio-button-unchecked"} size={22} color={activeId === v.id ? theme.primary : theme.muted} />
          <MaterialCommunityIcons name={vehicleIcon(v.type)} size={20} color={theme.primary} />
          <View style={styles.vehicleMain}>
            <Text style={[styles.vehicleName, {color: theme.text}]}>{vehicleTypeName(v.type, t)}</Text>
            <Text style={[styles.vehicleMeta, {color: theme.muted}]}>{vehicleMeta(v.baseWidth, v.baseHeight, v.towVehicleType, t)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {borderRadius: 20, borderWidth: 1, padding: 12, gap: 8, maxHeight: "85%", overflow: "hidden"},
  headRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {flex: 1, fontSize: 16, fontWeight: "700"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  vehicleRow: {flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 8},
  vehicleMain: {flex: 1, minWidth: 0, gap: 2},
  vehicleName: {fontSize: 15, fontWeight: "700"},
  vehicleMeta: {fontSize: 12},
});
