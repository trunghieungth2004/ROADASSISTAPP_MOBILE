import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/AppText";
import {MaterialCommunityIcons, MaterialIcons} from "@expo/vector-icons";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import type {HazardZone, RouteOption, WidthBlock} from "../../api/routes";
import type {MeVehicle} from "../../api/users";
import {MAX_STOPS, type Point, type SearchField, type Stop} from "./types";
import {vehicleIcon} from "./routeGeo";

type Props = {
  t: Strings;
  theme: AppTheme;
  originText: string;
  destText: string;
  stops: Stop[];
  result: RouteOption | null;
  origin: Point | null;
  dest: Point | null;
  activeVehicle: MeVehicle | null;
  busy: boolean;
  starting: boolean;
  error: string | null;
  hazardZones: HazardZone[];
  widthBlocks: WidthBlock[];
  onOpenSearch: (field: SearchField) => void;
  onSwap: () => void;
  onDeleteStop: (index: number) => void;
  onOpenVehicle: () => void;
  onFind: () => void;
  onStart: () => void;
  onSave: () => void;
};

export default function RouteCard(props: Props) {
  const {t, theme} = props;
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
      {props.stops.length > 0 ? (
        <View style={styles.stopRow}>
          {props.stops.map((s, i) => (
            <Pressable key={`${s.lat},${s.lng},${i}`} style={[styles.chip, {borderColor: theme.primary}]} onPress={() => props.onDeleteStop(i)}><Text style={{color: theme.primary}}>{i + 1} · ×</Text></Pressable>
          ))}
        </View>
      ) : null}
      {props.stops.length < MAX_STOPS ? (
        <Pressable style={[styles.addStopBtn, {borderColor: theme.primary}]} onPress={() => props.onOpenSearch("stop")}>
          <MaterialIcons name="add" size={18} color={theme.primary} />
          <Text style={{color: theme.primary, fontWeight: "600"}}>{t.route.addStop}</Text>
        </Pressable>
      ) : null}
      <Pressable style={[styles.input, styles.selectBtn, {borderColor: theme.border}]} onPress={props.onOpenVehicle}>
        <View style={styles.vehicleBtnRow}>
          <MaterialCommunityIcons name={vehicleIcon(props.activeVehicle?.type)} size={20} color={theme.primary} />
          <Text style={[styles.vehicleBtnText, {color: props.activeVehicle ? theme.text : theme.muted}]} numberOfLines={1}>{props.activeVehicle ? `${t.vehicle.types[props.activeVehicle.type as keyof typeof t.vehicle.types] ?? props.activeVehicle.type} · ${props.activeVehicle.baseWidth}m` : t.route.selectVehicle}</Text>
          <MaterialIcons name="expand-more" size={20} color={theme.muted} />
        </View>
      </Pressable>
      {props.error ? <Text style={[styles.error, {color: theme.danger}]}>{props.error}</Text> : null}
      {props.result ? (
        <View style={styles.actionRow}>
          <Pressable style={[styles.primary, {backgroundColor: theme.primary}, (props.busy || props.starting) && styles.disabled]} disabled={props.busy || props.starting} onPress={props.onStart}>{props.starting ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.nav.start}</Text>}</Pressable>
          <Pressable style={[styles.primary, styles.saveBtn, {borderColor: theme.primary}, props.busy && styles.disabled]} disabled={props.busy} onPress={props.onSave}><Text style={[styles.primaryText, {color: theme.primary}]}>{t.route.saveRoute}</Text></Pressable>
        </View>
      ) : props.origin && props.dest && props.activeVehicle ? (
        <Pressable style={[styles.primary, {backgroundColor: theme.primary}, props.busy && styles.disabled]} disabled={props.busy} onPress={props.onFind}>{props.busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.route.find}</Text>}</Pressable>
      ) : null}
      {props.hazardZones.length > 0 || props.widthBlocks.length > 0 ? (
        <View style={[styles.resultCard, {borderColor: theme.border}]}>
          {props.hazardZones.length > 0 ? (
            <View style={styles.warnBox}>
              <Text style={[styles.warnTitle, {color: theme.danger}]}>{t.route.suggestedTitle}</Text>
              {props.hazardZones.map((h) => (
                <Text key={h.flagId} style={{color: theme.text}}>{h.type ?? "?"} ({h.radiusMeters}m{h.note ? ` · ${h.note}` : ""})</Text>
              ))}
            </View>
          ) : null}
          {props.widthBlocks.length > 0 ? (
            <View style={styles.warnBox}>
              <Text style={[styles.warnTitle, {color: theme.danger}]}>{t.route.widthBlocked}</Text>
              {props.widthBlocks.map((w) => (
                <Text key={w.segmentId} style={{color: theme.text}}>{w.segmentId} ({w.baseWidth}m)</Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      <Text style={[styles.attribution, {color: theme.muted}]}>{t.route.geoAttribution}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {width: "100%", borderWidth: 1, borderRadius: 16, padding: 16, gap: 12, overflow: "hidden"},
  row: {flexDirection: "row", gap: 8, alignItems: "center"},
  fieldCol: {flex: 1, gap: 8, minWidth: 0},
  input: {borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 14},
  selectBtn: {justifyContent: "center", minHeight: 42},
  swapBtn: {width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  stopRow: {flexDirection: "row", flexWrap: "wrap", gap: 8},
  addStopBtn: {flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
  vehicleBtnRow: {flexDirection: "row", alignItems: "center", gap: 8},
  vehicleBtnText: {flex: 1, fontSize: 14},
  chip: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12},
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
