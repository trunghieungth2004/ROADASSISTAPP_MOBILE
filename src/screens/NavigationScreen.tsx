import {useEffect, useMemo, useRef, useState, type ComponentProps} from "react";
import {ActivityIndicator, BackHandler, Pressable, StyleSheet, View, useColorScheme} from "react-native";
import {AppText as Text} from "../components/AppText";
import {MaterialIcons} from "@expo/vector-icons";
import {useSafeAreaInsets} from "react-native-safe-area-context";
import {Camera, Images, LineLayer, MapView, ShapeSource, SymbolLayer, type CameraRef} from "@maplibre/maplibre-react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import {useKeepAwake} from "expo-keep-awake";
import {findRoute, isHazardZone, isWidthBlock, type RouteOption} from "../api/routes";
import {reverseLabel} from "../api/places";
import {toMessage} from "../api/client";
import {maneuverSteps} from "../services/maneuvers";
import {
  ANNOUNCE_CLOSE_METERS,
  ANNOUNCE_NEAR_METERS,
  ARRIVAL_METERS,
  HAZARD_ALERT_METERS,
  OFF_ROUTE_FIXES,
  OFF_ROUTE_METERS,
  projectOntoRoute,
  type RouteProgress,
} from "../services/navigation";
import {maptilerStyleUrl} from "../map/style";
import {darkTheme, lightTheme} from "../theme";
import type {Strings} from "../i18n/en";

type Props = {
  t: Strings;
  lang: string;
  token: string;
  initialRoute: RouteOption;
  dest: {lat: number; lng: number};
  stops: {lat: number; lng: number}[];
  width?: number;
  vehicleType?: string;
  onExit: () => void;
};

const FOLLOW_ZOOM = 17;
const FOLLOW_PITCH = 50;
const FOLLOW_MIN_MOVE_M = 3;

const courseBetween = (a: {lat: number; lng: number}, b: {lat: number; lng: number}): number => {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
};

const distBetween = (a: {lat: number; lng: number}, b: {lat: number; lng: number}): number => {
  const x = ((b.lng - a.lng) * Math.PI) / 180 * Math.cos(((a.lat + b.lat) / 2 * Math.PI) / 180);
  const y = ((b.lat - a.lat) * Math.PI) / 180;
  return Math.sqrt(x * x + y * y) * 6371000;
};

function turnIcon(kind: string): ComponentProps<typeof MaterialIcons>["name"] {
  switch (kind) {
    case "start":
      return "navigation";
    case "destination":
      return "flag";
    case "continue":
      return "straight";
    case "slight-right":
      return "turn-slight-right";
    case "slight-left":
      return "turn-slight-left";
    case "turn-right":
    case "sharp-right":
    case "ramp":
      return "turn-right";
    case "turn-left":
    case "sharp-left":
      return "turn-left";
    case "uturn":
      return "u-turn-right";
    case "exit":
      return "exit-to-app";
    case "merge":
      return "merge-type";
    case "roundabout":
      return "roundabout-right";
    default:
      return "navigation";
  }
}

export default function NavigationScreen({t, lang, token, initialRoute, dest, stops, width, vehicleType, onExit}: Props) {
  useKeepAwake();
  const scheme = useColorScheme();
  const theme = scheme === "dark" ? darkTheme : lightTheme;
  const insets = useSafeAreaInsets();
  const [route, setRoute] = useState<RouteOption>(initialRoute);
  const [pos, setPos] = useState<{lat: number; lng: number} | null>(null);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [following, setFollowing] = useState(true);
  const [muted, setMuted] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nextIdx, setNextIdx] = useState(-1);
  const [streets, setStreets] = useState<Record<number, string>>({});
  const routeRef = useRef(initialRoute);
  const mutedRef = useRef(false);
  const reroutingRef = useRef(false);
  const arrivedRef = useRef(false);
  const offRef = useRef(0);
  const seqRef = useRef(0);
  const announcedRef = useRef({idx: -1, tier: 0});
  const alertedRef = useRef(new Set<string>());
  const streetPendingRef = useRef(new Set<number>());
  const streetsRef = useRef<Record<number, string>>({});
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceRef = useRef<string | undefined>(undefined);
  const cameraRef = useRef<CameraRef | null>(null);
  const followingRef = useRef(true);
  const animatingRef = useRef(false);
  const firstFixRef = useRef(true);
  const lastFixRef = useRef<{lat: number; lng: number} | null>(null);
  const courseRef = useRef(0);
  const headingRef = useRef<{value: number; ts: number} | null>(null);
  const [arrowRotate, setArrowRotate] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const pickBearing = (): number => {
    const h = headingRef.current;
    if (h && Date.now() - h.ts < 15000) return h.value;
    return courseRef.current;
  };

  const steps = useMemo(() => maneuverSteps(route), [route]);
  const stepProg = useMemo(() => {
    const coords = route.geometry.coordinates;
    return steps.map((s) => projectOntoRoute(s.at[1], s.at[0], coords).progressMeters);
  }, [steps, route]);

  const distText = (m: number): string =>
    m >= 1000 ? `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} ${t.route.km}` : `${Math.round(m)} ${t.nav.m}`;
  const turnText = (kind: string): string =>
    (t.nav.turns as Record<string, string>)[kind] ?? t.nav.turns.other;

  const speak = (text: string): void => {
    if (mutedRef.current) return;
    void Speech.speak(text, {
      language: lang === "vi" ? "vi-VN" : "en-US",
      ...(voiceRef.current ? {voice: voiceRef.current} : {}),
      rate: lang === "vi" ? 0.95 : 1.0,
    });
  };

  const flash = (text: string): void => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };

  async function resolveVoice(): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const prefs = lang === "vi" ? ["vi-vn", "vi"] : ["en-us", "en"];
      const norm = (s: string): string => s.toLowerCase().replace("_", "-");
      for (const p of prefs) {
        const cands = voices.filter((v) => norm(v.language).startsWith(p));
        if (cands.length === 0) continue;
        voiceRef.current = (
          cands.find((v) => v.quality === Speech.VoiceQuality.Enhanced) ?? cands[0]
        ).identifier;
        return true;
      }
      voiceRef.current = undefined;
      return false;
    } catch {
      voiceRef.current = undefined;
      return false;
    }
  }

  async function reroute(lat: number, lng: number): Promise<void> {
    const id = (seqRef.current += 1);
    reroutingRef.current = true;
    setRerouting(true);
    speak(t.nav.rerouting);
    try {
      const res = await findRoute(
        {originLat: lat, originLng: lng, destLat: dest.lat, destLng: dest.lng, stops, width, vehicleType},
        token,
      );
      if (seqRef.current !== id) return;
      const nr = res.routes?.[0];
      if (!nr) throw new Error(t.route.noResults);
      routeRef.current = nr;
      setRoute(nr);
      offRef.current = 0;
      announcedRef.current = {idx: -1, tier: 0};
      alertedRef.current = new Set<string>();
      streetPendingRef.current = new Set<number>();
      streetsRef.current = {};
      setStreets({});
      setNextIdx(-1);
    } catch (err) {
      if (seqRef.current === id) setError(toMessage(err));
    } finally {
      if (seqRef.current === id) {
        reroutingRef.current = false;
        setRerouting(false);
      }
    }
  }

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let headSub: Location.LocationSubscription | null = null;
    let alive = true;
    void (async () => {
      const matched = await resolveVoice();
      if (!alive) return;
      if (!matched) flash(t.nav.noVoice);
      try {
        headSub = await Location.watchHeadingAsync((h) => {
          if (!alive) return;
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          headingRef.current = {value: v, ts: Date.now()};
          setArrowRotate(v);
          if (followingRef.current && lastFixRef.current) {
            const p = lastFixRef.current;
            animatingRef.current = true;
            cameraRef.current?.setCamera({
              centerCoordinate: [p.lng, p.lat],
              zoomLevel: FOLLOW_ZOOM,
              heading: v,
              pitch: FOLLOW_PITCH,
              animationDuration: 400,
            });
          }
        });
      } catch {
        headSub = null;
      }
      try {
        const {status} = await Location.requestForegroundPermissionsAsync();
        if (!alive) return;
        if (status !== "granted") {
          setError("Location denied");
          return;
        }
        sub = await Location.watchPositionAsync(
          {accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1},
          (loc) => {
            if (!alive) return;
            const lat = loc.coords.latitude;
            const lng = loc.coords.longitude;
            const r = routeRef.current;
            const p = projectOntoRoute(lat, lng, r.geometry.coordinates);
            setPos({lat, lng});
            setProgress(p);
            const prev = lastFixRef.current;
            lastFixRef.current = {lat, lng};
            if (prev && distBetween(prev, {lat, lng}) >= FOLLOW_MIN_MOVE_M) {
              courseRef.current = courseBetween(prev, {lat, lng});
            }
            const bearing = pickBearing();
            setArrowRotate(bearing);
            if (followingRef.current) {
              animatingRef.current = true;
              const first = firstFixRef.current;
              firstFixRef.current = false;
              cameraRef.current?.setCamera({
                centerCoordinate: [lng, lat],
                zoomLevel: FOLLOW_ZOOM,
                heading: bearing,
                pitch: FOLLOW_PITCH,
                animationDuration: first ? 0 : 800,
              });
            }
            if (!arrivedRef.current && p.remainingMeters <= ARRIVAL_METERS) {
              arrivedRef.current = true;
              setArrived(true);
              const s = t.nav.arrived;
              speak(s);
              flash(s);
              return;
            }
            if (!reroutingRef.current && !arrivedRef.current) {
              if (p.distToRoute > OFF_ROUTE_METERS) {
                offRef.current += 1;
                if (offRef.current >= OFF_ROUTE_FIXES) {
                  offRef.current = 0;
                  void reroute(lat, lng);
                  return;
                }
              } else {
                offRef.current = 0;
              }
            }
            let ni = -1;
            for (let i = 0; i < steps.length; i++) {
              if (stepProg[i] > p.progressMeters + 5) {
                ni = i;
                break;
              }
            }
            setNextIdx((prev) => (prev === ni ? prev : ni));
            if (ni >= 0 && !arrivedRef.current) {
              const toGo = Math.max(0, stepProg[ni] - p.progressMeters);
              const kind = steps[ni].kind;
              if (kind !== "destination") {
                const a = announcedRef.current;
                if (toGo <= ANNOUNCE_CLOSE_METERS && !(a.idx === ni && a.tier >= 2)) {
                  announcedRef.current = {idx: ni, tier: 2};
                  const street = steps[ni].street ?? streetsRef.current[ni];
                  speak(`${turnText(kind)}${street ? `, ${street}` : ""}, ${t.nav.inDistance.replace("{d}", distText(toGo))}`);
                } else if (toGo <= ANNOUNCE_NEAR_METERS && !(a.idx === ni && a.tier >= 1)) {
                  announcedRef.current = {idx: ni, tier: 1};
                  const street = steps[ni].street ?? streetsRef.current[ni];
                  speak(`${turnText(kind)}${street ? `, ${street}` : ""}, ${t.nav.inDistance.replace("{d}", distText(toGo))}`);
                }
                if (!steps[ni].street && streetsRef.current[ni] === undefined && !streetPendingRef.current.has(ni)) {
                  streetPendingRef.current.add(ni);
                  const at = steps[ni].at;
                  void reverseLabel(at[1], at[0], lang).then((label) => {
                    if (!alive) return;
                    streetsRef.current = {...streetsRef.current, [ni]: label};
                    setStreets(streetsRef.current);
                  });
                }
              }
            }
            const hazards = (r.hazards ?? []).filter(isHazardZone);
            for (const h of hazards) {
              const toGo = h.distanceMeters - p.progressMeters;
              const key = `h:${h.flagId}`;
              if (toGo > 0 && toGo <= HAZARD_ALERT_METERS && !alertedRef.current.has(key)) {
                alertedRef.current.add(key);
                const msg = t.nav.hazardAhead.replace("{d}", distText(toGo));
                speak(msg);
                flash(msg);
              }
            }
            const blocks = (r.warnings ?? []).filter(isWidthBlock);
            for (const w of blocks) {
              const toGo = w.distanceMeters - p.progressMeters;
              const key = `w:${w.segmentId}`;
              if (toGo > 0 && toGo <= HAZARD_ALERT_METERS && !alertedRef.current.has(key)) {
                alertedRef.current.add(key);
                const msg = t.nav.widthAhead.replace("{d}", distText(toGo));
                speak(msg);
                flash(msg);
              }
            }
          },
        );
      } catch (err) {
        if (alive) setError(toMessage(err));
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
      headSub?.remove();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      void Speech.stop();
    };
  }, []);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (listOpen) {
        setListOpen(false);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [listOpen]);

  const toggleMute = (): void => {
    const next = !muted;
    setMuted(next);
    mutedRef.current = next;
    if (next) void Speech.stop();
  };

  const onRecenter = (): void => {
    setFollowing(true);
    followingRef.current = true;
    const p = lastFixRef.current;
    if (p) {
      animatingRef.current = true;
      cameraRef.current?.setCamera({
        centerCoordinate: [p.lng, p.lat],
        zoomLevel: FOLLOW_ZOOM,
        heading: pickBearing(),
        pitch: FOLLOW_PITCH,
        animationDuration: 500,
      });
    }
  };

  const pace = route.distanceMeters > 0 ? route.durationSeconds / route.distanceMeters : 0;
  const remaining = progress?.remainingMeters ?? route.distanceMeters;
  const etaMin = Math.max(1, Math.round((remaining * pace) / 60));
  const frac = route.distanceMeters > 0 ? Math.min(1, (progress?.progressMeters ?? 0) / route.distanceMeters) : 0;
  const next = nextIdx >= 0 ? steps[nextIdx] : null;
  const nextStreet = next ? (next.street ?? streets[nextIdx]) : undefined;
  const nextToGo = next && progress ? Math.max(0, stepProg[nextIdx] - progress.progressMeters) : 0;

  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={maptilerStyleUrl}
        logoEnabled={false}
        attributionEnabled={false}
        onRegionIsChanging={(e: unknown) => {
          const flag = (e as {properties?: {isUserInteraction?: boolean}}).properties?.isUserInteraction;
          if (flag && !animatingRef.current) {
            setFollowing(false);
            followingRef.current = false;
          }
        }}
        onRegionDidChange={() => {
          animatingRef.current = false;
        }}
      >
        <Camera ref={cameraRef} centerCoordinate={[106.6602, 10.7626]} zoomLevel={13} />
        <Images images={{"nav-arrow": require("../../assets/map/nav-arrow.png")}} />
        {pos ? (
          <ShapeSource id="nav-puck" shape={{type: "Feature", geometry: {type: "Point", coordinates: [pos.lng, pos.lat]}, properties: {}}}>
            <SymbolLayer
              id="nav-puck-arrow"
              style={{iconImage: "nav-arrow", iconSize: 0.42, iconAnchor: "center", iconRotate: arrowRotate, iconRotationAlignment: "map", iconAllowOverlap: true, iconIgnorePlacement: true}}
            />
          </ShapeSource>
        ) : null}
        <ShapeSource id="nav-route" shape={{type: "Feature", geometry: route.geometry, properties: {}}}>
          <LineLayer id="nav-route-line" style={{lineColor: theme.primary, lineWidth: 5, lineOpacity: 0.9, lineCap: "round", lineJoin: "round"}} />
        </ShapeSource>
      </MapView>
      <View style={[styles.header, {backgroundColor: theme.paper, borderColor: theme.border, paddingTop: insets.top + 12}]}>
        <View style={styles.headerRow}>
          <View style={styles.headerMain}>
            <Text style={[styles.remaining, {color: theme.text}]}>{distText(remaining)} {t.nav.remaining}</Text>
            <Text style={[styles.eta, {color: theme.muted}]}>{t.nav.eta} {etaMin} {t.route.min}</Text>
          </View>
          <Pressable style={styles.iconBtn} onPress={() => setListOpen(true)} accessibilityRole="button" accessibilityLabel="Turn list">
            <MaterialIcons name="list" size={24} color={theme.text} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={onExit} accessibilityRole="button" accessibilityLabel={t.nav.exitNav}>
            <MaterialIcons name="close" size={24} color={theme.text} />
          </Pressable>
        </View>
        <View style={[styles.bar, {backgroundColor: theme.border}]}>
          <View style={[styles.barFill, {backgroundColor: theme.primary, width: `${Math.round(frac * 100)}%`}]} />
        </View>
        {next && !arrived ? (
          <View style={[styles.banner, {backgroundColor: theme.primary}]}>
            <MaterialIcons name={turnIcon(next.kind)} size={28} color="#fff" />
            <View style={styles.bannerCol}>
              <Text style={styles.bannerText}>{turnText(next.kind)}{nextStreet ? ` · ${nextStreet}` : ""}</Text>
              <Text style={styles.bannerSub}>{distText(nextToGo)}</Text>
            </View>
          </View>
        ) : null}
        {arrived ? (
          <View style={[styles.banner, {backgroundColor: theme.primary}]}>
            <MaterialIcons name="flag" size={28} color="#fff" />
            <Text style={styles.bannerText}>{t.nav.arrived}</Text>
          </View>
        ) : null}
        {rerouting ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={{color: theme.text}}>{t.nav.rerouting}</Text>
          </View>
        ) : null}
        {!pos && !error ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={{color: theme.text}}>{t.nav.locating}</Text>
          </View>
        ) : null}
        {error ? <Text style={{color: theme.danger}}>{error}</Text> : null}
        {notice ? <Text style={{color: theme.text}}>{notice}</Text> : null}
      </View>
      <View style={[styles.fabCol, {bottom: insets.bottom + 16}]}>
        {!following ? (
          <Pressable style={[styles.fab, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={onRecenter} accessibilityRole="button" accessibilityLabel={t.nav.recenter}>
            <MaterialIcons name="my-location" size={22} color={theme.primary} />
          </Pressable>
        ) : null}
        <Pressable style={[styles.fab, {backgroundColor: theme.paper, borderColor: theme.border}]} onPress={toggleMute} accessibilityRole="button" accessibilityLabel={muted ? t.nav.unmute : t.nav.mute}>
          <MaterialIcons name={muted ? "volume-off" : "volume-up"} size={22} color={theme.primary} />
        </Pressable>
      </View>
      {listOpen ? (
        <View style={styles.sheetRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setListOpen(false)} accessibilityRole="button" accessibilityLabel={t.common.close} />
          <View style={[styles.sheet, {backgroundColor: theme.paper, borderColor: theme.border, paddingBottom: insets.bottom + 12}]}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, {color: theme.text}]}>{distText(progress?.remainingMeters ?? route.distanceMeters)}</Text>
              <Pressable onPress={() => setListOpen(false)} accessibilityRole="button" accessibilityLabel={t.common.close}>
                <MaterialIcons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>
            {steps.map((s, i) => {
              const street = s.street ?? streets[i];
              const behind = progress !== null && stepProg[i] <= progress.progressMeters + 5;
              const toGo = progress !== null ? Math.max(0, stepProg[i] - progress.progressMeters) : 0;
              return (
                <View key={i} style={[styles.turnRow, behind && styles.turnRowDone]}>
                  <MaterialIcons name={turnIcon(s.kind)} size={24} color={behind ? theme.muted : theme.primary} />
                  <View style={styles.turnMain}>
                    <Text style={[styles.turnText, {color: behind ? theme.muted : theme.text}]} numberOfLines={1}>
                      {turnText(s.kind)}{street ? ` · ${street}` : ""}
                    </Text>
                    {!behind ? <Text style={[styles.turnSub, {color: theme.muted}]}>{distText(toGo)}</Text> : null}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
  header: {position: "absolute", top: 0, left: 0, right: 0, borderBottomWidth: 1, paddingHorizontal: 12, paddingBottom: 12, gap: 8},
  headerRow: {flexDirection: "row", alignItems: "center", gap: 8},
  headerMain: {flex: 1, gap: 2},
  remaining: {fontSize: 22, fontWeight: "700"},
  eta: {fontSize: 13},
  iconBtn: {width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center"},
  bar: {height: 6, borderRadius: 3, overflow: "hidden"},
  barFill: {height: 6, borderRadius: 3},
  banner: {flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 10},
  bannerCol: {flex: 1, gap: 2},
  bannerText: {color: "#fff", fontSize: 17, fontWeight: "700"},
  bannerSub: {color: "#fff", fontSize: 13},
  statusRow: {flexDirection: "row", alignItems: "center", gap: 8},
  fabCol: {position: "absolute", right: 12, gap: 8},
  fab: {width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center"},
  sheetRoot: {position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)"},
  sheet: {borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 12, gap: 8, maxHeight: "70%"},
  sheetHead: {flexDirection: "row", alignItems: "center", gap: 8},
  sheetTitle: {flex: 1, fontSize: 18, fontWeight: "700"},
  turnRow: {flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8},
  turnRowDone: {opacity: 0.55},
  turnMain: {flex: 1, minWidth: 0, gap: 2},
  turnText: {fontSize: 15, fontWeight: "600"},
  turnSub: {fontSize: 13},
});
