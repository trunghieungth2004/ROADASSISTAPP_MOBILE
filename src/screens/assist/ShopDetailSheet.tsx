import {StyleSheet, View, useColorScheme} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import type {Provider} from "../../api/providers";
import Overlay from "../../components/overlay/Overlay";

type Props = {
  t: Strings;
  shop: Provider;
  distanceLabel: string | null;
  walkLabel: string | null;
  openLabel: string;
  openColor: string;
  closesLabel: string | null;
  closedWarn: boolean;
  classChips: string[];
  walkBusy: boolean;
  navBusy: boolean;
  imHereBusy: boolean;
  onReport: () => void;
  onWalkHere: () => void;
  onRouteFromHere: () => void;
  onImHere: (() => void) | null;
  onClose: () => void;
};

export default function ShopDetailSheet({t, shop, distanceLabel, walkLabel, openLabel, openColor, closesLabel, closedWarn, classChips, walkBusy, navBusy, imHereBusy, onReport, onWalkHere, onRouteFromHere, onImHere, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const count = typeof shop.ratingCount === "number" ? shop.ratingCount : 0;
  const avg = typeof shop.ratingAvg === "number" ? shop.ratingAvg : 0;
  const filled = Math.max(0, Math.min(5, Math.round(avg)));
  const hollow = count < 3;
  return (
    <Overlay
      visible
      variant="sheet"
      title={shop.name}
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[
        {label: t.report.title, tone: "danger", outline: true, onPress: onReport},
        {label: t.shop.walkTo, tone: "neutral", outline: true, busy: walkBusy, onPress: onWalkHere},
        ...(onImHere ? [{label: t.assist.imHere, tone: "primary" as const, busy: imHereBusy, onPress: onImHere}] : []),
        {label: t.common.routeFromHere, tone: onImHere ? ("neutral" as const) : ("primary" as const), outline: onImHere !== null, busy: navBusy, onPress: onRouteFromHere},
      ]}
    >
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={[styles.badge, {color: openColor}]}>{openLabel}</Text>
          {closesLabel ? <Text style={[styles.badge, {color: theme.primary}]}>{closesLabel}</Text> : null}
          {distanceLabel ? <Text style={[styles.coords, {color: theme.muted}]}>{distanceLabel}</Text> : null}
          {walkLabel ? <Text style={[styles.coords, {color: theme.muted}]}>{walkLabel}</Text> : null}
        </View>
        {closedWarn ? <Text style={[styles.coords, {color: theme.danger}]}>{t.shop.shopClosed}</Text> : null}
        {classChips.length > 0 ? (
          <View style={styles.metaRow}>
            {classChips.map((chip) => (
              <Text key={chip} style={[styles.chipText, {color: theme.primary, borderColor: theme.border}]}>{chip}</Text>
            ))}
          </View>
        ) : null}
        {count > 0 ? (
          <View style={styles.metaRow}>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <MaterialIcons key={n} name={n <= filled && !hollow ? "star" : "star-border"} size={14} color={hollow ? theme.muted : "#f59e0b"} />
              ))}
            </View>
            <Text style={[styles.coords, {color: theme.muted}]}>{avg.toFixed(1)} ({count})</Text>
          </View>
        ) : null}
      </View>
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  metaRow: {flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap"},
  badge: {fontSize: 13, fontWeight: "700"},
  coords: {fontSize: 12},
  chipText: {fontSize: 12, fontWeight: "700", borderWidth: 1, borderRadius: 12, paddingVertical: 2, paddingHorizontal: 8},
  stars: {flexDirection: "row", gap: 1, alignItems: "center"},
});
