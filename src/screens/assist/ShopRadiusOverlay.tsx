import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View, useColorScheme, useWindowDimensions} from "react-native";
import {AppText as Text} from "../../components/ui/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {Camera, GeoJSONSource, Images, Map, Marker, type CameraRef} from "@maplibre/maplibre-react-native";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {nearProviders, providerRatings, type Provider, type ProviderRating} from "../../api/providers";
import {toMessage} from "../../api/client";
import {darkTheme, lightTheme} from "../../theme";
import {bundledMapStyle} from "../../map/style";
import StyledLayer from "../../components/map/StyledLayer";
import MapStyleVeil from "../../components/map/MapStyleVeil";
import {useStyleVeil} from "../../components/map/useStyleVeil";
import {HCMC_CENTER} from "../route/types";
import {pointFeature} from "../route/routeGeo";
import {walkMinutes} from "./walkShop";
import ShopPill from "./ShopPill";
import ShopClassIcons, {classIconLabel} from "./ShopClassIcons";
import RatingRow from "./RatingRow";
import type {Strings} from "../../i18n/en";

export type RadiusCardHandlers = {
  walkBusy: boolean;
  navBusy: boolean;
  imHereBusy: boolean;
  canImHere: (shop: Provider) => boolean;
  onWalkHere: (shop: Provider) => void;
  onRouteFromHere: (shop: Provider) => void;
  onReport: (shop: Provider) => void;
  onImHere: (shop: Provider) => void;
};

type Props = {
  t: Strings;
  token: string | null;
  gps: {lat: number; lng: number} | null;
  vehicleClass?: string;
  radii: number[];
  radius: number;
  onRadius: (radius: number) => void;
  mode: "browse" | "tow";
  card: RadiusCardHandlers;
  onUseShop: (shop: Provider) => void;
  onClose: () => void;
};

function radiusLabel(t: Strings, r: number): string {
  if (r < 1000) return t.shop.radiusM.replace("{n}", String(r));
  return t.shop.radiusKm.replace("{n}", String(r / 1000));
}

function pillFor(shop: Provider, t: Strings): string | null {
  if (typeof shop.distance !== "number") return null;
  return `~${walkMinutes(shop.distance)} ${t.route.min}`;
}

export default function ShopRadiusOverlay({t, token, gps, vehicleClass, radii, radius, onRadius, mode, card, onUseShop, onClose}: Props) {
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const mapStyle = useMemo(() => bundledMapStyle(scheme === "dark" ? "dark" : "light") ?? "https://demotiles.maplibre.org/style.json", [scheme]);
  const {veiled, onStyleLoaded} = useStyleVeil(scheme);
  const cameraRef = useRef<CameraRef | null>(null);
  const [shops, setShops] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rateCache, setRateCache] = useState<Record<string, {jobs: number; reviews: ProviderRating[]}>>({});
  const [rateBusy, setRateBusy] = useState<string | null>(null);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const {height} = useWindowDimensions();
  const center = gps ? {lat: gps.lat, lng: gps.lng} : null;
  function openBadge(shop: Provider): {label: string; color: string} {
    if (shop.openNow === true) return {label: t.shop.open, color: theme.primary};
    if (shop.openNow === false) return {label: t.shop.closed, color: theme.danger};
    return {label: t.shop.unknownHours, color: theme.muted};
  }
  function select(shop: Provider): void {
    setSelectedId(shop.id);
    setReviewsOpen(false);
    void cameraRef.current?.setStop({center: [shop.lng, shop.lat], zoom: 15, duration: 600});
  }
  const load = useCallback(async () => {
    if (!token || !gps) return;
    setLoading(true);
    setError(null);
    try {
      const found = await nearProviders(gps.lat, gps.lng, token, {
        radiusMeters: radius,
        kind: "SHOP",
        acceptingOnly: true,
        ...(vehicleClass ? {vehicleClass} : {}),
      });
      setShops(found);
    } catch (err) {
      setError(toMessage(err));
    } finally {
      setLoading(false);
    }
  }, [token, gps?.lat, gps?.lng, radius, vehicleClass]);
  useEffect(() => {
    void load();
  }, [load]);
  const selected = selectedId ? (shops.find((s) => s.id === selectedId) ?? null) : null;
  const cached = selected ? rateCache[selected.id] : undefined;
  useEffect(() => {
    if (!selected || !token || cached || rateBusy) return;
    let alive = true;
    setRateBusy(selected.id);
    void providerRatings(selected.id, token).then(
      (res) => {
        if (!alive) return;
        setRateCache((prev) => ({...prev, [selected.id]: {jobs: res.completedJobs, reviews: res.ratings}}));
      },
      () => undefined,
    ).finally(() => {
      if (alive) setRateBusy(null);
    });
    return () => {
      alive = false;
    };
  }, [selected?.id, token]);
  return (
    <View style={[styles.screen, {backgroundColor: theme.background, paddingTop: insets.top + 12}]}>
      <View style={styles.header}>
        <Pressable style={[styles.closeBtn, {backgroundColor: theme.danger}]} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close}>
          <MaterialIcons name="close" size={20} color="#fff" />
        </Pressable>
        <Text style={[styles.title, {color: theme.text}]}>{t.shop.title}</Text>
      </View>
      <Pressable
        style={[styles.radiusCycle, {borderColor: theme.border}]}
        onPress={() => {
          const at = radii.indexOf(radius);
          onRadius(radii[(at + 1) % radii.length] ?? radius);
        }}
        accessibilityRole="button"
        accessibilityLabel={radiusLabel(t, radius)}
      >
        <MaterialIcons name="directions-walk" size={18} color={theme.primary} />
        <Text style={[styles.radiusCycleText, {color: theme.text}]} numberOfLines={1}>{radiusLabel(t, radius)}</Text>
      </Pressable>
      {error ? <Text style={[styles.note, {color: theme.danger}]}>{error}</Text> : null}
      <View style={styles.mapWrap}>
        <Map
          style={StyleSheet.absoluteFill}
          mapStyle={mapStyle}
          logo={false}
          attribution={false}
          androidView="texture"
          onDidFinishLoadingStyle={onStyleLoaded}
        >
          <Camera ref={cameraRef} initialViewState={{center: center ? [center.lng, center.lat] : HCMC_CENTER, zoom: 14}} />
          <Images
            images={{
              "shop-pin": require("../../../assets/map/shops/shop-pin.png"),
              "shop-pin-closed": require("../../../assets/map/shops/shop-pin-closed.png"),
            }}
          />
          {gps ? (
            <GeoJSONSource id="radius-gps" data={pointFeature(gps.lng, gps.lat)}>
              <StyledLayer type="circle" id="radius-gps-dot" style={{circleRadius: 8, circleColor: "#0284c7", circleStrokeColor: "#ffffff", circleStrokeWidth: 3}} />
            </GeoJSONSource>
          ) : null}
          {shops.map((shop) => (
            <GeoJSONSource
              key={`radius-shop-${shop.id}`}
              id={`radius-shop-${shop.id}`}
              data={pointFeature(shop.lng, shop.lat)}
              onPress={() => select(shop)}
            >
              <StyledLayer
                type="symbol"
                id={`radius-shop-icon-${shop.id}`}
                style={{iconImage: shop.openNow === false ? "shop-pin-closed" : "shop-pin", iconSize: shop.id === selectedId ? 0.6 : 0.5, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}}
              />
            </GeoJSONSource>
          ))}
          {shops.map((shop) => {
            const label = pillFor(shop, t);
            if (!label) return null;
            return (
              <Marker
                key={`radius-shop-pill-${shop.id}`}
                id={`radius-shop-pill-${shop.id}`}
                lngLat={[shop.lng, shop.lat]}
                anchor="bottom"
                offset={[0, -28]}
              >
                <ShopPill theme={theme} label={label} selected={shop.id === selectedId} onPress={() => select(shop)} />
              </Marker>
            );
          })}
        </Map>
        <MapStyleVeil visible={veiled} backgroundColor={theme.background} />
        {loading ? (
          <View style={styles.loading} pointerEvents="none">
            <ActivityIndicator size="small" color="#fff" />
          </View>
        ) : null}
      </View>
      {!loading && !error && shops.length === 0 ? <Text style={[styles.note, {color: theme.muted}]}>{t.shop.empty}</Text> : null}
      {selected ? (
        <View style={[styles.card, {backgroundColor: theme.paper, borderColor: theme.border, paddingBottom: insets.bottom + 12}]}>
          <View style={styles.handle} />
          <ScrollView contentContainerStyle={styles.cardBody} showsVerticalScrollIndicator={false}>
            <View style={styles.cardHead}>
              <Text style={[styles.cardTitle, {color: theme.text}]} numberOfLines={1}>{selected.name}</Text>
              <Pressable onPress={() => setSelectedId(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.close}>
                <MaterialIcons name="close" size={18} color={theme.muted} />
              </Pressable>
            </View>
            <View style={styles.cardPills}>
              <View style={[styles.statusPill, {backgroundColor: openBadge(selected).color}]}>
                <Text style={styles.statusText}>{openBadge(selected).label}</Text>
              </View>
              <View style={[styles.classPill, {borderColor: theme.border}]}>
                <ShopClassIcons theme={theme} shop={selected} label={classIconLabel(selected, t)} size={14} />
              </View>
              {pillFor(selected, t) ? (
                <Text style={[styles.coords, {color: theme.muted}]}>{pillFor(selected, t)}</Text>
              ) : null}
            </View>
            {rateBusy === selected.id ? (
              <View style={styles.metaRow}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text style={[styles.coords, {color: theme.muted}]}>{t.common.loading}</Text>
              </View>
            ) : (
              <View style={[styles.metaRow, styles.spread]}>
                {cached ? (
                  <Text style={[styles.coords, {color: theme.muted}]}>{t.shop.jobsDone.replace("{n}", String(cached.jobs))}</Text>
                ) : (
                  <View />
                )}
                {typeof selected.ratingAvg === "number" && typeof selected.ratingCount === "number" && selected.ratingCount > 0 ? (
                  <View style={styles.stars}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <MaterialIcons key={n} name={n <= Math.max(0, Math.min(5, Math.round(selected.ratingAvg as number))) ? "star" : "star-border"} size={14} color="#f59e0b" />
                    ))}
                    <Text style={[styles.coords, {color: theme.muted}]}>{(selected.ratingAvg as number).toFixed(1)} ({selected.ratingCount})</Text>
                  </View>
                ) : (
                  <View />
                )}
              </View>
            )}
            <View style={styles.iconRow}>
              <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={() => card.onWalkHere(selected)} disabled={card.walkBusy} accessibilityRole="button" accessibilityLabel={t.shop.walkTo}>
                {card.walkBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="directions-walk" size={22} color={theme.primary} />}
              </Pressable>
              <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={() => card.onRouteFromHere(selected)} disabled={card.navBusy} accessibilityRole="button" accessibilityLabel={t.common.routeFromHere}>
                {card.navBusy ? <ActivityIndicator size="small" color={theme.primary} /> : <MaterialIcons name="navigation" size={22} color={theme.primary} />}
              </Pressable>
              <Pressable style={[styles.iconBtn, {borderColor: theme.border}]} onPress={() => card.onReport(selected)} accessibilityRole="button" accessibilityLabel={t.report.title}>
                <MaterialIcons name="flag" size={22} color={theme.danger} />
              </Pressable>
            </View>
            {card.canImHere(selected) ? (
              <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}, card.imHereBusy && styles.disabled]} disabled={card.imHereBusy} onPress={() => card.onImHere(selected)} accessibilityRole="button" accessibilityLabel={t.assist.imHere}>
                {card.imHereBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionText}>{t.assist.imHere}</Text>}
              </Pressable>
            ) : null}
            {mode === "tow" ? (
              <Pressable style={[styles.actionBtn, {backgroundColor: theme.primary}]} onPress={() => onUseShop(selected)} accessibilityRole="button" accessibilityLabel={t.shop.useShop}>
                <Text style={styles.actionText}>{t.shop.useShop}</Text>
              </Pressable>
            ) : null}
            {cached && cached.reviews.length > 0 ? (
              <Pressable style={[styles.preview, {borderColor: theme.border}]} onPress={() => setReviewsOpen(true)} accessibilityRole="button" accessibilityLabel={t.rating.allReviews}>
                {cached.reviews.slice(0, 2).map((r) => (
                  <View key={r.id} style={styles.previewRow}>
                    <RatingRow theme={theme} rating={{id: r.id, score: r.score, text: r.text, authorName: r.byUserName}} />
                  </View>
                ))}
                <Text style={[styles.coords, {color: theme.primary}]}>{t.rating.allReviews} ({typeof selected.ratingCount === "number" ? selected.ratingCount : cached.reviews.length})</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
      {reviewsOpen && selected && cached && cached.reviews.length > 0 ? (
        <View style={[styles.reviewsModal, {backgroundColor: theme.paper, borderColor: theme.border}]}>
          <View style={styles.cardHead}>
            <Text style={[styles.cardTitle, {color: theme.text}]}>{t.rating.allReviews}</Text>
            <Pressable onPress={() => setReviewsOpen(false)} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.common.close}>
              <MaterialIcons name="close" size={18} color={theme.muted} />
            </Pressable>
          </View>
          <View style={{minHeight: Math.round(height / 4), gap: 8}}>
            {cached.reviews.map((r) => (
              <View key={r.id} style={[styles.reviewRow, {borderColor: theme.border}]}>
                <RatingRow theme={theme} rating={{id: r.id, score: r.score, text: r.text, reply: r.reply, authorName: r.byUserName}} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {!loading && !error && shops.length === 0 ? <Text style={[styles.note, {color: theme.muted}]}>{t.shop.empty}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 8},
  header: {flexDirection: "row", gap: 8, alignItems: "center"},
  closeBtn: {width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center"},
  title: {fontSize: 16, fontWeight: "700", flex: 1},
  radiusCycle: {flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12},
  radiusCycleText: {fontSize: 13, fontWeight: "600"},
  note: {fontSize: 13},
  mapWrap: {flex: 1, borderRadius: 16, overflow: "hidden", position: "relative"},
  loading: {position: "absolute", left: 12, top: 12, width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.7)"},
  card: {position: "absolute", left: 0, right: 0, bottom: 0, borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 12, gap: 8, maxHeight: "62%"},
  handle: {width: 40, height: 4, borderRadius: 2, backgroundColor: "#a3a3a3", alignSelf: "center"},
  cardBody: {gap: 8},
  cardHead: {flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8},
  cardTitle: {fontWeight: "700", fontSize: 15, flex: 1},
  cardPills: {flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap"},
  statusPill: {borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  statusText: {color: "#fff", fontSize: 12, fontWeight: "700"},
  classPill: {borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10},
  coords: {fontSize: 12},
  metaRow: {flexDirection: "row", alignItems: "center", gap: 8},
  spread: {justifyContent: "space-between"},
  stars: {flexDirection: "row", gap: 1, alignItems: "center"},
  iconRow: {flexDirection: "row", gap: 12, justifyContent: "center", paddingVertical: 4},
  iconBtn: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  actionBtn: {borderRadius: 8, padding: 10, alignItems: "center"},
  actionText: {color: "#fff", fontWeight: "700"},
  disabled: {opacity: 0.6},
  preview: {gap: 8, borderWidth: 1, borderRadius: 12, padding: 10},
  previewRow: {gap: 2},
  reviewRow: {gap: 4, borderWidth: 1, borderRadius: 12, padding: 10},
  reviewsModal: {position: "absolute", left: 12, right: 12, top: 64, borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, maxHeight: "70%"},
});
