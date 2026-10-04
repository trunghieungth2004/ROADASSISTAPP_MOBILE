import {ActivityIndicator, Pressable, StyleSheet, View} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text, AppTextInput as TextInput} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import type {AppTheme} from "../../theme";
import type {Provider} from "../../api/providers";
import type {RouteOption} from "../../api/routes";
import StatusRow from "../../components/ui/StatusRow";

type Props = {
  t: Strings;
  theme: AppTheme;
  query: string;
  onQuery: (q: string) => void;
  searchResults: Provider[];
  searchBusy: boolean;
  searching: boolean;
  onPickSearch: (id: string) => void;
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
      <TextInput
        style={[styles.input, {borderColor: theme.border, color: theme.text}]}
        placeholder={t.shop.searchPlaceholder}
        placeholderTextColor={theme.muted}
        value={props.query}
        onChangeText={props.onQuery}
        accessibilityLabel={t.shop.searchPlaceholder}
      />
      {props.searching ? (
        props.searchBusy ? (
          <StatusRow theme={theme} text={t.common.loading} />
        ) : (
          props.searchResults.map((shop) => (
            <Pressable key={shop.id} style={[styles.row, {borderColor: theme.border}]} onPress={() => props.onPickSearch(shop.id)} accessibilityRole="button" accessibilityLabel={shop.name}>
              <Text style={[styles.name, {color: theme.text}]}>{shop.name}</Text>
              {typeof shop.distance === "number" ? <Text style={[styles.coords, {color: theme.muted}]}>{(shop.distance / 1000).toFixed(1)} {t.route.km}</Text> : null}
              <Text style={[styles.badge, {color: shop.openNow === false ? theme.danger : shop.openNow === true ? theme.primary : theme.muted}]}>
                {shop.openNow === false ? t.shop.closed : shop.openNow === true ? t.shop.open : t.shop.unknownHours}
              </Text>
            </Pressable>
          ))
        )
      ) : (
        <>
          <Pressable style={[styles.radiusCycle, {borderColor: theme.border}]} onPress={props.onCycleRadius} accessibilityRole="button" accessibilityLabel={props.radiusLabel}>
            <MaterialIcons name="directions-walk" size={18} color={theme.primary} />
            <Text style={[styles.radiusCycleText, {color: theme.text}]}>{props.radiusLabel}</Text>
          </Pressable>
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {gap: 8},
  input: {borderWidth: 1, borderRadius: 8, padding: 10},
  row: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 4},
  name: {fontWeight: "700"},
  coords: {fontSize: 12},
  badge: {fontSize: 12, fontWeight: "700"},
  radiusCycle: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12},
  radiusCycleText: {fontSize: 13, fontWeight: "600"},
  innerCard: {borderWidth: 1, borderRadius: 12, padding: 12, gap: 6},
  activeCard: {borderWidth: 2},
  cardTitle: {fontWeight: "700"},
  hint: {fontSize: 12},
  actionBtn: {borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
  selectedRow: {flexDirection: "row", alignItems: "center", justifyContent: "space-between"},
});
