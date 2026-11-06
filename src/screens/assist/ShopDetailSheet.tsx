import {useState} from "react";
import {ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions} from "react-native";
import {useAppMode} from "../../context/ThemeContext";
import {MaterialIcons} from "@expo/vector-icons";
import {AppText as Text} from "../../components/ui/AppText";
import type {Strings} from "../../i18n/en";
import {darkTheme, lightTheme, type AppTheme} from "../../theme";
import type {Provider, ProviderService} from "../../api/providers";
import Overlay from "../../components/overlay/Overlay";
import ShopClassIcons, {classIconLabel} from "./ShopClassIcons";
import RatingRow from "./RatingRow";
import {hasChannel} from "../../services/serviceChannels";

type ShopIconActionsProps = {
  t: Strings;
  theme: AppTheme;
  walkBusy: boolean;
  navBusy: boolean;
  onReport?: (() => void) | null;
  onWalkHere?: (() => void) | null;
  onRouteFromHere?: (() => void) | null;
};

function ShopIconActions({t, theme, walkBusy, navBusy, onReport, onWalkHere, onRouteFromHere}: ShopIconActionsProps) {
  if (!onWalkHere && !onRouteFromHere && !onReport) return null;
  return (
    <View style={styles.iconRow}>
      {onWalkHere ? (
        <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={onWalkHere} disabled={walkBusy} accessibilityRole="button" accessibilityLabel={t.shop.walkTo}>
          {walkBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="directions-walk" size={22} color={theme.primary} />}
        </Pressable>
      ) : null}
      {onRouteFromHere ? (
        <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={onRouteFromHere} disabled={navBusy} accessibilityRole="button" accessibilityLabel={t.common.routeFromHere}>
          {navBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="navigation" size={22} color={theme.primary} />}
        </Pressable>
      ) : null}
      {onReport ? (
        <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={onReport} accessibilityRole="button" accessibilityLabel={t.report.title}>
          <MaterialIcons name="flag" size={22} color={theme.danger} />
        </Pressable>
      ) : null}
    </View>
  );
}

function serviceMeta(service: ProviderService, shop: Provider, t: Strings): string {
  const classes = Array.isArray(service.vehicleClasses) && service.vehicleClasses.length > 0 ?
    service.vehicleClasses :
    shop.vehicleClasses ?? [];
  const parts = [
    service.quoteRequired ? t.provider.serviceQuote : t.provider.serviceFixedPrice,
    ...(typeof service.warrantyDays === "number" && service.warrantyDays > 0 ?
      [`${service.warrantyDays}d`] : []),
    ...classes.map((cls) =>
      cls === "CAR" ? t.shop.vehicleCar : t.shop.vehicleBike),
    ...(service.channels ?? []).map((channel) =>
      channel === "BOOKING" ? t.provider.channelBooking : t.provider.channelAssist),
  ];
  return parts.join(" · ");
}

type ShopServicesProps = {
  t: Strings;
  theme: AppTheme;
  shop: Provider;
  services: NonNullable<Provider["services"]>;
};

function ShopServices({t, theme, shop, services}: ShopServicesProps) {
  if (services.length === 0) {
    return <Text style={[styles.coords, {color: theme.muted}]}>{t.shop.noServices}</Text>;
  }
  return (
    <View style={[styles.services, {borderColor: theme.border}]}>
      <Text style={[styles.servicesTitle, {color: theme.text}]}>{t.provider.servicesTitle}</Text>
      {services.map((service) => (
        <View key={service.code} style={styles.serviceBlock}>
          <View style={styles.serviceRow}>
            <Text style={[styles.serviceName, {color: theme.text}]} numberOfLines={1}>
              {`${service.name}${(shop.serviceUsage?.[service.code] ?? 0) > 0 ? ` · ${t.provider.popular}` : ""}`}
            </Text>
            <Text style={[styles.coords, {color: service.quoteRequired ? theme.muted : theme.success}]}>
              {service.quoteRequired ? t.provider.serviceQuote : `${service.displayPrice.toLocaleString()} ₫`}
            </Text>
          </View>
          <Text style={[styles.coords, {color: theme.muted}]}>{serviceMeta(service, shop, t)}</Text>
        </View>
      ))}
    </View>
  );
}

type Props = {
  t: Strings;
  shop: Provider;
  openLabel: string;
  openColor: string;
  serviceChannel?: "ASSIST" | "BOOKING";
  showOffDuty?: boolean;
  walkBusy?: boolean;
  navBusy?: boolean;
  imHereBusy?: boolean;
  jobs?: number | null;
  reviews?: {id: string; score: number; text?: string | null; byUserName?: string | null; reply?: string | null}[] | null;
  onReport?: (() => void) | null;
  onWalkHere?: (() => void) | null;
  onRouteFromHere?: (() => void) | null;
  onImHere?: (() => void) | null;
  onBook?: (() => void) | null;
  onChoose?: (() => void) | null;
  onManage?: (() => void) | null;
  onClose: () => void;
};

export default function ShopDetailSheet({t, shop, openLabel, openColor, serviceChannel = "ASSIST", showOffDuty = true, walkBusy = false, navBusy = false, imHereBusy = false, jobs = null, reviews = null, onReport, onWalkHere, onRouteFromHere, onImHere, onBook, onChoose, onManage, onClose}: Props) {
  const scheme = useAppMode();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const count = typeof shop.ratingCount === "number" ? shop.ratingCount : 0;
  const avg = typeof shop.ratingAvg === "number" ? shop.ratingAvg : 0;
  const filled = Math.max(0, Math.min(5, Math.round(avg)));
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const preview = reviews !== null ? reviews.slice(0, 2) : null;
  const {height} = useWindowDimensions();
  const offDuty = shop.accepting === false || shop.status !== "ACTIVE" || shop.suspended === true;
  const pricing = shop.kind === "TOW" &&
    (typeof shop.towBaseFee === "number" || typeof shop.towPerKmFee === "number") ? [
      typeof shop.towBaseFee === "number" ? `${t.provider.towBaseFee}: ${shop.towBaseFee.toLocaleString()} ₫` : null,
      typeof shop.towPerKmFee === "number" ? `${t.provider.towPerKmFee}: ${shop.towPerKmFee.toLocaleString()} ₫` : null,
    ].filter((row): row is string => row !== null).join(" · ") :
    shop.kind === "MOBILE_SHOP" &&
      (typeof shop.callOutFee === "number" || typeof shop.travelPerKmFee === "number") ? [
        typeof shop.callOutFee === "number" ? `${t.provider.callOutFee}: ${shop.callOutFee.toLocaleString()} ₫` : null,
        typeof shop.travelPerKmFee === "number" ? `${t.provider.travelPerKmFee}: ${shop.travelPerKmFee.toLocaleString()} ₫` : null,
      ].filter((row): row is string => row !== null).join(" · ") : null;
  const visibleServices = Array.isArray(shop.services) ? [...shop.services]
    .filter((service) => hasChannel(service, serviceChannel))
    .sort((a, b) =>
      (shop.serviceUsage?.[b.code] ?? 0) -
      (shop.serviceUsage?.[a.code] ?? 0)) : [];
  return (
    <Overlay
      visible
      variant="sheet"
      title={shop.name}
      leading={<MaterialIcons name={shop.kind === "TOW" ? "local-shipping" : shop.kind === "MOBILE_SHOP" ? "build" : "storefront"} size={20} color={theme.primary} />}
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
        ...(onChoose ? [{label: t.shop.useShop, tone: "primary" as const, onPress: onChoose}] : []),
        ...(onImHere && !offDuty ? [{label: t.assist.imHere, tone: "neutral" as const, outline: true, busy: imHereBusy, onPress: onImHere}] : []),
        ...(onBook && shop.kind === "SHOP" && shop.bookingEnabled === true ? [{label: t.bookings.book, tone: "neutral" as const, outline: true, onPress: onBook}] : []),
        ...(onManage ? [{label: t.provider.manageProvider, tone: "neutral" as const, outline: true, onPress: onManage}] : []),
      ]}
    >
      <View style={styles.body}>
        <ShopIconActions t={t} theme={theme} walkBusy={walkBusy} navBusy={navBusy} onReport={onReport} onWalkHere={onWalkHere} onRouteFromHere={onRouteFromHere} />
        {pricing !== null ? <Text style={[styles.coords, {color: theme.text}]}>{pricing}</Text> : null}
        <ShopServices t={t} theme={theme} shop={shop} services={visibleServices} />
        {offDuty && showOffDuty ? (
          <View style={[styles.offDuty, {borderColor: theme.border}]}>
            <MaterialIcons name="info-outline" size={16} color={theme.muted} />
            <Text style={[styles.coords, {color: theme.muted}]}>{t.assist.shopOffDuty}</Text>
          </View>
        ) : null}
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
  offDuty: {flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 8, padding: 8},
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
  services: {borderWidth: 1, borderRadius: 12, padding: 10, gap: 6},
  servicesTitle: {fontSize: 13, fontWeight: "700"},
  serviceRow: {flexDirection: "row", alignItems: "center", gap: 8},
  serviceName: {flex: 1, fontSize: 13},
  serviceBlock: {gap: 2},
  reviewRow: {gap: 4, borderWidth: 1, borderRadius: 12, padding: 10},
});
