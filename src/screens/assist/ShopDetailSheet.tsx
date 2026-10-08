import {useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View, useColorScheme, useWindowDimensions} from "react-native";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme} from "../../theme";
import type {Provider} from "../../api/providers";
import Overlay from "../../components/overlay/Overlay";
import ShopClassIcons, {classIconLabel} from "./ShopClassIcons";
import RatingRow from "./RatingRow";

type Props = {
  t: Strings;
  shop: Provider;
  openLabel: string;
  openColor: string;
  walkBusy: boolean;
  navBusy: boolean;
  imHereBusy: boolean;
  jobs: number | null;
  reviews: {id: string; score: number; text?: string | null; byUserName?: string | null; reply?: string | null}[] | null;
  onReport: () => void;
  onWalkHere: () => void;
  onRouteFromHere: () => void;
  onImHere: (() => void) | null;
  onClose: () => void;
};

export default function ShopDetailSheet({t, shop, openLabel, openColor, walkBusy, navBusy, imHereBusy, jobs, reviews, onReport, onWalkHere, onRouteFromHere, onImHere, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const count = typeof shop.ratingCount === "number" ? shop.ratingCount : 0;
  const avg = typeof shop.ratingAvg === "number" ? shop.ratingAvg : 0;
  const filled = Math.max(0, Math.min(5, Math.round(avg)));
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const preview = reviews !== null ? reviews.slice(0, 2) : null;
  const {height} = useWindowDimensions();
  return (
    <Overlay
      visible
      variant="sheet"
      title={shop.name}
      right={
        <View style={styles.headPills}>
          <View style={[styles.statusPill, {backgroundColor: openColor}]}>
            <Text style={styles.statusText}>{openLabel}</Text>
          </View>
          <View style={[styles.classPill, {borderColor: theme.border}]}>
            <ShopClassIcons theme={theme} shop={shop} label={classIconLabel(shop, t)} size={14} />
          </View>
        </View>
      }
      closeLabel={t.common.cancel}
      onClose={onClose}
      actions={[
        ...(onImHere ? [{label: t.assist.imHere, tone: "primary" as const, busy: imHereBusy, onPress: onImHere}] : []),
      ]}
    >
      <View style={styles.body}>
        <View style={styles.iconRow}>
          <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={onWalkHere} disabled={walkBusy} accessibilityRole="button" accessibilityLabel={t.shop.walkTo}>
            {walkBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="directions-walk" size={22} color={theme.primary} />}
          </Pressable>
          <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={onRouteFromHere} disabled={navBusy} accessibilityRole="button" accessibilityLabel={t.common.routeFromHere}>
            {navBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="navigation" size={22} color={theme.primary} />}
          </Pressable>
          <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={onReport} accessibilityRole="button" accessibilityLabel={t.report.title}>
            <MaterialIcons name="flag" size={22} color={theme.danger} />
          </Pressable>
        </View>
        {count > 0 || jobs !== null ? (
          <View style={[styles.metaRow, styles.spread]}>
            {jobs !== null ? (
              <Text style={[styles.coords, {color: theme.muted}]}>{t.shop.jobsDone.replace("{n}", String(jobs))}</Text>
            ) : (
              <View />
            )}
            {count > 0 ? (
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <MaterialIcons key={n} name={n <= filled ? "star" : "star-border"} size={14} color="#f59e0b" />
                ))}
                <Text style={[styles.coords, {color: theme.muted}]}>{avg.toFixed(1)} ({count})</Text>
              </View>
            ) : (
              <View />
            )}
          </View>
        ) : null}
        {preview !== null && preview.length > 0 ? (
          <Pressable style={[styles.preview, {borderColor: theme.border}]} onPress={() => setReviewsOpen(true)} accessibilityRole="button" accessibilityLabel={t.rating.allReviews}>
            {preview.map((r) => (
              <View key={r.id} style={styles.previewRow}>
                <RatingRow theme={theme} rating={{id: r.id, score: r.score, text: r.text, authorName: r.byUserName}} />
              </View>
            ))}
            <Text style={[styles.coords, {color: theme.primary}]}>{t.rating.allReviews} ({count})</Text>
          </Pressable>
        ) : null}
      </View>
      {reviewsOpen && reviews !== null ? (
        <Overlay visible variant="dialog" title={t.rating.allReviews} closeLabel={t.common.cancel} onClose={() => setReviewsOpen(false)}>
          <View style={{minHeight: Math.round(height / 2), gap: 8}}>
          {reviews.map((r) => (
            <View key={r.id} style={[styles.reviewRow, {borderColor: theme.border}]}>
              <RatingRow theme={theme} rating={{id: r.id, score: r.score, text: r.text, reply: r.reply, authorName: r.byUserName}} />
            </View>
          ))}
          </View>
        </Overlay>
      ) : null}
    </Overlay>
  );
}

const styles = StyleSheet.create({
  body: {gap: 8, width: "100%"},
  iconRow: {flexDirection: "row", gap: 12, justifyContent: "center", paddingVertical: 4},
  iconBtn: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  metaRow: {flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap"},
  spread: {justifyContent: "space-between", flexWrap: "nowrap"},
  headPills: {flexDirection: "row", alignItems: "center", gap: 6},
  statusPill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  coords: {fontSize: 12},
  classPill: {borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  stars: {flexDirection: "row", gap: 1, alignItems: "center"},
  preview: {gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  previewRow: {gap: 2},
  reviewRow: {gap: 4, borderWidth: 1, borderRadius: 12, padding: 10},
});
