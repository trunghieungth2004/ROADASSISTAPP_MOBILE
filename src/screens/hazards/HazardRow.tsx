import {useEffect, useState} from "react";
import {Pressable, StyleSheet, View} from "react-native";
import {AppText as Text} from "../../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {FLAG_CONSENSUS_THRESHOLD, type Flag} from "../../api/flags";
import {reverseLabel} from "../../api/places";
import {flagStatusColor, flagStatusLabel} from "../../components/flagStatus";
import {hazardKind} from "../../components/hazardStyle";
import {Fab} from "../../components/Fab";
import {flagTypeLabel} from "../../i18n/labels";
import type {AppTheme} from "../../theme";
import type {Strings} from "../../i18n/en";
import {formatDist} from "../navigation/navUtils";
import {formatUntil} from "./flagActions";
import {timeAgoLabel} from "./hazardFilter";

const addressCache = new Map<string, string>();

type Props = {
  t: Strings;
  theme: AppTheme;
  lang: string;
  flag: Flag;
  distanceM: number | null;
  onOpen: (flag: Flag) => void;
  onCenter: (flag: Flag) => void;
};

export default function HazardRow(props: Props) {
  const {t, theme, flag} = props;
  const kind = hazardKind(flag.type);
  const key = `${flag.lat.toFixed(4)},${flag.lng.toFixed(4)}`;
  const [address, setAddress] = useState<string | null>(addressCache.get(key) ?? null);
  useEffect(() => {
    let alive = true;
    const hit = addressCache.get(key);
    if (hit) {
      setAddress(hit);
      return;
    }
    void reverseLabel(flag.lat, flag.lng, props.lang).then((label) => {
      addressCache.set(key, label);
      if (alive) setAddress(label);
    });
    return () => {
      alive = false;
    };
  }, [key, flag.lat, flag.lng, props.lang]);
  const ago = timeAgoLabel(flag.createdAt, Date.now(), t.hazards);
  const progress = flag.status === "1" ? t.flag.confirmations.replace("{v}", String(Math.max(0, flag.voteCount ?? 0))).replace("{t}", String(FLAG_CONSENSUS_THRESHOLD)) : null;
  const until = formatUntil(flag.ttlExpiresAtMs, Date.now(), t.flag);
  const sub = [progress, until].filter((part) => part !== null).join(" · ");
  return (
    <View style={[styles.row, {backgroundColor: theme.paper, borderColor: theme.border}]}>
      <Pressable style={styles.body} onPress={() => props.onOpen(flag)} accessibilityRole="button">
        <View style={[styles.iconCircle, {borderColor: kind.color}]}>
          <MaterialIcons name={kind.icon} size={22} color={kind.color} />
        </View>
        <View style={styles.main}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, {color: theme.text}]}>{flagTypeLabel(flag.type, t)}</Text>
            <View style={[styles.chip, {backgroundColor: flagStatusColor(flag.status)}]}>
              <Text style={styles.chipText}>{flagStatusLabel(flag.status, t)}</Text>
            </View>
          </View>
          <Text style={[styles.meta, {color: theme.muted}]}>
            {flag.voteCount ?? 0} {t.hazards.votes}
            {ago ? ` · ${ago}` : ""}
            {props.distanceM !== null ? ` · ${formatDist(props.distanceM, t.route.km, t.nav.m)}` : ""}
          </Text>
          {sub !== "" ? (
            <Text style={[styles.meta, {color: theme.muted}]}>{sub}</Text>
          ) : null}
          {flag.note ? (
            <Text style={[styles.note, {color: theme.text}]} numberOfLines={1}>
              {flag.note}
            </Text>
          ) : null}
          {address ? (
            <Text style={[styles.addr, {color: theme.muted}]} numberOfLines={1}>
              {address}
            </Text>
          ) : null}
        </View>
      </Pressable>
      <Fab theme={theme} size={44} hitSlop={6} label={t.hazards.centerPin} onPress={() => props.onCenter(flag)}>
        <MaterialIcons name="my-location" size={20} color={theme.primary} />
      </Fab>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 16, padding: 12},
  body: {flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0},
  iconCircle: {width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  main: {flex: 1, minWidth: 0, gap: 2},
  titleRow: {flexDirection: "row", alignItems: "center", gap: 8},
  title: {fontSize: 15, fontWeight: "700"},
  chip: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9},
  chipText: {color: "#fff", fontSize: 11, fontWeight: "700"},
  meta: {fontSize: 12},
  note: {fontSize: 13},
  addr: {fontSize: 12},
});
