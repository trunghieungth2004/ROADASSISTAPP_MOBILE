import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/AppText";
import StatusRow from "../../components/StatusRow";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import type {HazardZone, RouteOption, WidthBlock} from "../../api/routes";
import type {MeVehicle} from "../../api/users";
import {formatPoint} from "../../api/places";
import {vehicleMeta} from "../../components/vehicleMeta";
import {MAX_STOPS, type Point, type SearchField, type Stop} from "./types";
import {vehicleIcon} from "./routeGeo";
import {useStopLabels} from "./useStopLabels";

type Props = {
  t: Strings;
  theme: AppTheme;
  lang: string;
  originText: string;
  destText: string;
  stops: Stop[];
  result: RouteOption | null;
  origin: Point | null;
  dest: Point | null;
  activeVehicle: MeVehicle | null;
  busy: boolean;
  starting: boolean;
  hazardZones: HazardZone[];
  widthBlocks: WidthBlock[];
  onOpenSearch: (field: SearchField) => void;
  onSwap: () => void;
  onDeleteStop: (index: number) => void;
  onOpenVehicle: () => void;
  onStart: () => void;
  onSave: () => void;
};

export default function RouteCard(props: Props) {
  const {t, theme} = props;
  const stopLabels = useStopLabels(props.stops, props.lang);
  const canAddStop = props.stops.length < MAX_STOPS;
  return (
    <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <View style={styles.row}>
        <View style={styles.fieldCol}>
          <Pressable style={[styles.input, styles.selectBtn, {borderColor: theme.border}]} onPress={() => props.onOpenSearch("origin")}><Text style={{color: props.originText ? theme.text : theme.muted}} numberOfLines={1}>{props.originText || t.route.selectOrigin}</Text></Pressable>
        </View>
        <Pressable style={[styles.swapBtn, {borderColor: theme.border}]} onPress={props.onSwap}>
          <Text style={{color: theme.primary}}>⇄</Text>
        </Pressable>
        <View style={styles.fieldCol}>
          <Pressable style={[styles.input, styles.selectBtn, {borderColor: theme.border}]} onPress={() => props.onOpenSearch("destination")}><Text style={{color: props.destText ? theme.text : theme.muted}} numberOfLines={1}>{props.destText || t.route.selectDestination}</Text></Pressable>
        </View>
      </View>
      <View style={styles.stopVehicleRow}>
        <View style={styles.stopGroup}>
          <Pressable style={[styles.plusBtn, {borderColor: canAddStop ? theme.primary : theme.border}, !canAddStop && styles.disabled]} disabled={!canAddStop} onPress={() => props.onOpenSearch("stop")} accessibilityRole="button" accessibilityLabel={t.route.addStop}>
            <MaterialIcons name="add" size={20} color={canAddStop ? theme.primary : theme.muted} />
          </Pressable>
          {props.stops.map((s, i) => (
            <View key={`${s.lat},${s.lng},${i}`} style={[styles.chip, {borderColor: theme.primary}]}>
              <View style={[styles.stopBadge, {backgroundColor: theme.primary}]}>
                <Text style={styles.stopBadgeText}>{i + 1}</Text>
              </View>
              <Text style={[styles.chipLabel, {color: theme.primary}]} numberOfLines={1}>{stopLabels[i] ?? formatPoint(s.lat, s.lng)}</Text>
              <Pressable onPress={() => props.onDeleteStop(i)} hitSlop={6} accessibilityRole="button" accessibilityLabel={t.route.stopRemove}>
                <MaterialIcons name="close" size={16} color={theme.primary} />
              </Pressable>
            </View>
          ))}
        </View>
        <Pressable style={[styles.input, styles.vehicleCompact, {borderColor: theme.border}]} onPress={props.onOpenVehicle}>
          <View style={styles.vehicleBtnRow}>
            <MaterialCommunityIcons name={vehicleIcon(props.activeVehicle?.type)} size={20} color={theme.primary} />
            <Text style={[styles.vehicleBtnText, {color: props.activeVehicle ? theme.text : theme.muted}]} numberOfLines={1}>{props.activeVehicle ? vehicleMeta(props.activeVehicle.baseWidth, props.activeVehicle.baseHeight, null, t) : t.route.selectVehicle}</Text>
            <MaterialIcons name="expand-more" size={20} color={theme.muted} />
          </View>
        </Pressable>
      </View>
      {props.result ? (
        <View style={styles.actionRow}>
          <Pressable style={[styles.primary, {backgroundColor: theme.primary}, (props.busy || props.starting) && styles.disabled]} disabled={props.busy || props.starting} onPress={props.onStart}>{props.starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.nav.start}</Text>}</Pressable>
          <Pressable style={[styles.primary, styles.saveBtn, {borderColor: theme.primary}, props.busy && styles.disabled]} disabled={props.busy} onPress={props.onSave}><Text style={[styles.primaryText, {color: theme.primary}]}>{t.route.saveRoute}</Text></Pressable>
        </View>
      ) : props.busy ? (
        <StatusRow theme={theme} text={t.route.findingRoute} />
      ) : null}
      {props.widthBlocks.length > 0 ? (
        <View style={[styles.resultCard, {borderColor: theme.border}]}>
          <View style={styles.warnBox}>
            <Text style={[styles.warnTitle, {color: theme.danger}]}>{t.route.widthBlocked}</Text>
            {props.widthBlocks.map((w) => (
              <Text key={w.segmentId} style={{color: theme.text}}>{w.segmentId} ({w.baseWidth}m)</Text>
            ))}
          </View>
        </View>
      ) : null}
      <Text style={[styles.attribution, {color: theme.muted}]}>{t.route.geoAttribution}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {width: "100%", borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden"},
  row: {flexDirection: "row", gap: 8, alignItems: "center"},
  vehicleRow: {flexDirection: "row", gap: 8, alignItems: "center"},
  vehicleHalf: {flex: 1, minWidth: 0},
  vehicleSpacer: {flex: 1},
  stopVehicleRow: {flexDirection: "row", gap: 8, alignItems: "center"},
  stopGroup: {flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1, alignItems: "center"},
  plusBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  vehicleCompact: {justifyContent: "center", minHeight: 42, maxWidth: "45%"},
  fieldCol: {flex: 1, gap: 8, minWidth: 0},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  selectBtn: {justifyContent: "center", minHeight: 42},
  swapBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  vehicleBtnRow: {flexDirection: "row", alignItems: "center", gap: 8},
  vehicleBtnText: {flex: 1, fontSize: 14, textAlign: "center"},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 6},
  stopBadge: {width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center"},
  stopBadgeText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  chipLabel: {fontSize: 12, fontWeight: "600", flexShrink: 1, maxWidth: 140},
  actionRow: {flexDirection: "row", gap: 8},
  primary: {flex: 1, borderRadius: 8, padding: 12, alignItems: "center"},
  saveBtn: {borderWidth: 1, backgroundColor: "transparent"},
  disabled: {opacity: 0.6},
  primaryText: {color: "#fff", fontWeight: "700"},
  error: {fontSize: 13},
  resultCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, borderStyle: "dashed"},
  warnBox: {gap: 2},
  warnTitle: {fontSize: 13, fontWeight: "700"},
  attribution: {fontSize: 10, textAlign: "right"},
});
