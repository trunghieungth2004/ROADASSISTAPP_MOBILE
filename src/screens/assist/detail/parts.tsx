import {useEffect, useState, type ReactNode} from "react";
import {Linking, Pressable, StyleSheet, View, type StyleProp, type ViewStyle} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../../components/ui/AppText";
import {formatPoint, reverseLabel} from "../../../api/places";
import type {FeedTicket} from "../../../api/dispatch";
import {type AppTheme} from "../../../theme";
export type Party = {
  id: string | null;
  name: string;
  kind: string | null;
  label: string | null;
  lat: number | null;
  lng: number | null;
  openNow: boolean | null;
  ratingAvg: number | null;
  ratingCount: number | null;
  phone: string | null;
};

export function partyOf(ticket: FeedTicket, fallback: string): Party {
  const raw = ticket.otherParty;
  if (typeof raw !== "object" || raw === null || typeof raw.name !== "string") {
    return {id: null, name: fallback, kind: null, label: null, lat: null, lng: null, openNow: null, ratingAvg: null, ratingCount: null, phone: null};
  }
  return {
    id: typeof raw.id === "string" ? raw.id : null,
    name: raw.name,
    kind: typeof raw.kind === "string" ? raw.kind : null,
    label: typeof raw.label === "string" ? raw.label : null,
    lat: typeof raw.lat === "number" ? raw.lat : null,
    lng: typeof raw.lng === "number" ? raw.lng : null,
    openNow: typeof raw.openNow === "boolean" ? raw.openNow : null,
    ratingAvg: typeof raw.ratingAvg === "number" ? raw.ratingAvg : null,
    ratingCount: typeof raw.ratingCount === "number" ? raw.ratingCount : null,
    phone: typeof raw.phone === "string" ? raw.phone : null,
  };
}

export function Stars({theme, avg, count}: {theme: AppTheme; avg: number | null; count: number | null}) {
  if (avg === null || count === null) return null;
  return (
    <View style={styles.stars}>
      <MaterialIcons name="star" size={13} color="#f59e0b" />
      <Text style={[styles.ratingText, {color: theme.muted}]}>{avg.toFixed(1)} ({count})</Text>
    </View>
  );
}

export function PhoneLink({theme, phone}: {theme: AppTheme; phone: string}) {
  return (
    <Pressable style={styles.phoneRow} onPress={() => void Linking.openURL(`tel:${phone}`)} accessibilityRole="link" accessibilityLabel={phone}>
      <View style={[styles.phoneIcon, {backgroundColor: `${theme.primary}1a`}]}>
        <MaterialIcons name="call" size={13} color={theme.primary} />
      </View>
      <Text style={[styles.phoneText, {color: theme.primary}]}>{phone}</Text>
    </Pressable>
  );
}

export function PlaceLine({theme, lat, lng, lang, address}: {theme: AppTheme; lat: number | null; lng: number | null; lang: string; address?: string | null}) {
  const fixed = typeof address === "string" && address !== "" ? address : null;
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    if (fixed !== null || lat === null || lng === null) return;
    let alive = true;
    void reverseLabel(lat, lng, lang).then((resolved) => {
      if (alive) setLabel(resolved);
    });
    return () => {
      alive = false;
    };
  }, [lat, lng, lang, fixed]);
  const coords = lat !== null && lng !== null ? formatPoint(lat, lng) : null;
  const primary = fixed ?? label ?? coords;
  if (primary === null) return null;
  return (
    <View style={styles.place}>
      <Text style={[styles.placePrimary, {color: theme.text}]}>{primary}</Text>
      {coords !== null && primary !== coords ? <Text style={[styles.placeSecondary, {color: theme.muted}]}>{coords}</Text> : null}
    </View>
  );
}

export function ColumnHead({theme, icon, label}: {theme: AppTheme; icon: string; label: string}) {
  return (
    <View style={styles.colHead}>
      <MaterialIcons name={icon as never} size={13} color={theme.muted} />
      <Text style={[styles.colHeadText, {color: theme.muted}]}>{label}</Text>
    </View>
  );
}

export function DetailCard({theme, children, style}: {theme: AppTheme; children: ReactNode; style?: StyleProp<ViewStyle>}) {
  return <View style={[styles.card, {borderColor: theme.border, backgroundColor: theme.background}, style]}>{children}</View>;
}

export function CardHead({theme, icon, title, right}: {theme: AppTheme; icon: string; title: string; right?: ReactNode}) {
  return (
    <View style={styles.cardHead}>
      <View style={[styles.cardIcon, {backgroundColor: `${theme.primary}1f`}]}>
        <MaterialIcons name={icon as never} size={15} color={theme.primary} />
      </View>
      <Text style={[styles.cardTitle, {color: theme.text}]}>{title}</Text>
      {right}
    </View>
  );
}

export function FeeRow({theme, label, value, strong, valueColor}: {theme: AppTheme; label: string; value: string; strong?: boolean; valueColor?: string}) {
  return (
    <View style={styles.feeRow}>
      <Text style={[styles.feeLabel, {color: strong === true ? theme.text : theme.muted}, strong === true && styles.feeLabelStrong]}>{label}</Text>
      <Text style={[styles.feeValue, {color: valueColor ?? theme.text}, strong === true && styles.feeValueStrong]}>{value}</Text>
    </View>
  );
}

export const detailStyles = StyleSheet.create({
  inset: {borderWidth: 1, borderRadius: 12, padding: 10, gap: 6},
  insetHead: {flexDirection: "row", alignItems: "center", gap: 8},
  insetTitleRow: {flex: 1, minWidth: 0, gap: 1},
  name: {fontSize: 14, fontWeight: "700"},
  role: {fontSize: 11},
  labelText: {fontSize: 12},
  pill: {borderRadius: 999, paddingVertical: 3, paddingHorizontal: 8},
  pillText: {color: "#fff", fontSize: 10, fontWeight: "700"},
  inlineActions: {flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 2},
  chip: {borderWidth: 1, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10},
  chipText: {fontSize: 11, fontWeight: "700"},
  muted: {fontSize: 11},
  disabled: {opacity: 0.6},
  photoRow: {flexDirection: "row", gap: 8, flexWrap: "wrap"},
  thumb: {width: 64, height: 64, borderRadius: 8},
  divider: {height: StyleSheet.hairlineWidth},
  rowBetween: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
});

const styles = StyleSheet.create({
  stars: {flexDirection: "row", alignItems: "center", gap: 3},
  ratingText: {fontSize: 11},
  phoneRow: {flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start"},
  phoneIcon: {width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center"},
  phoneText: {fontSize: 12, fontWeight: "600"},
  place: {gap: 1},
  placePrimary: {fontSize: 13, fontWeight: "600"},
  placeSecondary: {fontSize: 11},
  colHead: {flexDirection: "row", alignItems: "center", gap: 4},
  colHeadText: {fontSize: 10, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase"},
  card: {borderWidth: 1, borderRadius: 14, padding: 10, gap: 8},
  cardHead: {flexDirection: "row", alignItems: "center", gap: 8},
  cardIcon: {width: 26, height: 26, borderRadius: 8, alignItems: "center", justifyContent: "center"},
  cardTitle: {flex: 1, fontSize: 13, fontWeight: "700"},
  feeRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  feeLabel: {fontSize: 12, flexShrink: 1},
  feeLabelStrong: {fontSize: 13, fontWeight: "700"},
  feeValue: {fontSize: 12, fontWeight: "600"},
  feeValueStrong: {fontSize: 15, fontWeight: "700"},
});
