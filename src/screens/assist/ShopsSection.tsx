import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {Provider} from "../../api/providers";
import type {RouteOption} from "../../api/routes";
import StatusRow from "../../components/ui/StatusRow";

type Props = {
  t: Strings;
  theme: AppTheme;
  query: string;
  onOpenSearch: () => void;
  mapSel: {label: string; lat: number; lng: number} | null;
  onClearMapSel: () => void;
  onNavigateMapSel: () => void;
  onRegisterShop: () => void;
  radiusLabel: string;
  onCycleRadius: () => void;
  shopLoading: boolean;
  emptyShops: boolean;
  shopSel: Provider | null;
  walkRoute: RouteOption | null;
  walkBusy: boolean;
  navBusy: boolean;
  onClearShop: () => void;
  onNavigate: (shop: Provider) => void;
};

export default function ShopsSection(props: Props) {
  const {t, theme} = props;
  return (
    <View style={styles.wrap}>
      <View style={styles.filterRow}>
        <Pressable
          style={[styles.input, styles.halfInput, {borderColor: theme.border}]}
          onPress={props.onOpenSearch}
          accessibilityRole="button"
          accessibilityLabel={t.shop.searchPlaceholder}
        >
          <Text style={{color: props.query ? theme.text : theme.muted}} numberOfLines={1}>
            {props.query ? props.query : t.shop.searchPlaceholder}
          </Text>
        </Pressable>
        <Pressable style={[styles.radiusCycle, styles.halfCycle, {borderColor: theme.border}]} onPress={props.onCycleRadius} accessibilityRole="button" accessibilityLabel={props.radiusLabel}>
          <MaterialIcons name="directions-walk" size={18} color={theme.primary} />
          <Text style={[styles.radiusCycleText, {color: theme.text}]} numberOfLines={1}>{props.radiusLabel}</Text>
        </Pressable>
      </View>
      {props.mapSel ? (
            <View style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: theme.primary}]}>
              <View style={styles.selectedRow}>
                <Text style={[styles.cardTitle, {color: theme.text}]} numberOfLines={1}>{props.mapSel.label}</Text>
                <Pressable onPress={props.onClearMapSel} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.close}>
                  <MaterialIcons name="close" size={18} color={theme.muted} />
                </Pressable>
              </View>
              <View style={styles.mapSelActions}>
                <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}]} onPress={props.onNavigateMapSel} accessibilityRole="button" accessibilityLabel={t.common.routeFromHere}>
                  <Text style={styles.actionText}>{t.common.routeFromHere}</Text>
                </Pressable>
                <Pressable style={[styles.chipBtn, {borderColor: theme.primary}]} onPress={() => props.onRegisterShop()} accessibilityRole="button" accessibilityLabel={t.shop.claimShop}>
                  <Text style={{color: theme.primary}}>{t.shop.claimShop}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
          {props.shopSel ? (
            <View style={[styles.innerCard, styles.activeCard, {backgroundColor: theme.paper, borderColor: theme.primary}]}>
              <View style={styles.selectedRow}>
                <Text style={[styles.cardTitle, {color: theme.text}]}>{props.shopSel.name}</Text>
                <Pressable onPress={props.onClearShop} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.shop.clearRoute}>
                  <MaterialIcons name="close" size={18} color={theme.muted} />
                </Pressable>
              </View>
              {props.walkBusy ? (
                <StatusRow theme={theme} text={t.common.loading} />
              ) : props.walkRoute ? (
                <Text style={[styles.coords, {color: theme.muted}]}>{t.shop.walkRoute} · {((props.walkRoute.distanceMeters ?? 0) / 1000).toFixed(1)} {t.route.km} · {Math.round((props.walkRoute.durationSeconds ?? 0) / 60)} {t.route.min}</Text>
              ) : (
                <Text style={[styles.coords, {color: theme.muted}]}>{t.shop.walkTo}</Text>
              )}
              <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, props.navBusy && styles.disabled]} disabled={props.navBusy} onPress={() => props.shopSel && props.onNavigate(props.shopSel)} accessibilityRole="button" accessibilityLabel={t.common.routeFromHere}>
                {props.navBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.common.routeFromHere}</Text>}
              </Pressable>
            </View>
          ) : null}
          {props.shopLoading && !props.shopSel ? <StatusRow theme={theme} text={t.shop.loading} /> : null}
          {props.emptyShops ? <Text style={[styles.hint, {color: theme.muted}]}>{t.shop.empty}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  filterRow: {flexDirection: "row", gap: 8},
  halfInput: {flex: 1, minWidth: 0},
  halfCycle: {flex: 1, justifyContent: "center"},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  coords: {fontSize: 12},
  radiusCycle: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12},
  radiusCycleText: {fontSize: 13, fontWeight: "600"},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6},
  activeCard: {borderWidth: 2},
  cardTitle: {fontWeight: "700"},
  hint: {fontSize: 12},
  actionBtn: {borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  chipBtn: {borderWidth: 1, borderRadius: 16, paddingVertical: 6, paddingHorizontal: 12, alignItems: "center", justifyContent: "center"},
  mapSelActions: {flexDirection: "row", gap: 8, alignItems: "center"},
  disabled: {opacity: 0.6},
  selectedRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
});
