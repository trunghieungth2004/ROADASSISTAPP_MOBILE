import {useEffect, useMemo, useRef, useState, type MutableRefObject} from "react";
import {AppState} from "react-native";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import {type CameraRef} from "@maplibre/maplibre-react-native";
import {findRoute, isFlagWarning, isHazardZone, isWidthBlock, type FlagWarning, type RouteOption} from "../../api/routes";
import {reverseLabel} from "../../api/places";
import {toMessage} from "../../api/client";
import {maneuverSteps} from "../../services/maneuvers";
import {readBgFix, startBgNav, stopBgNav} from "../../services/bgNav";
import {notifyHazardHeadsUp} from "../../services/push";
import {playEventSound, unloadEventSounds} from "../../services/sound";
import {
  ANNOUNCE_CLOSE_METERS,
  ANNOUNCE_NEAR_METERS,
  ARRIVAL_METERS,
  HAZARD_ALERT_METERS,
  OFF_ROUTE_FIXES,
  OFF_ROUTE_METERS,
  projectOntoRoute,
  windowAround,
  type RouteProgress,
} from "../../services/navigation";
import type {Strings} from "../../i18n/en";
import {FOLLOW_MIN_MOVE_M, FOLLOW_PITCH, FOLLOW_ZOOM, courseBetween, distBetween, splitRoute} from "./navUtils";

export type NavTrackingOpts = {
  token: string;
  lang: string;
  t: Strings;
  dest: {lat: number; lng: number};
  stops: {lat: number; lng: number}[];
  width?: number;
  vehicleType?: string;
  initialRoute: RouteOption;
  seed: {lat: number; lng: number};
  speak: (text: string) => void;
  resolveVoice: () => Promise<boolean>;
};

export function useNavTracking(opts: NavTrackingOpts): {
  route: RouteOption;
  pos: {lat: number; lng: number} | null;
  progress: RouteProgress | null;
  following: boolean;
  arrived: boolean;
  rerouting: boolean;
  error: string | null;
  clearError: () => void;
  notice: string | null;
  streets: Record<number, string>;
  steps: ReturnType<typeof maneuverSteps>;
  stepProg: number[];
  arrowRotate: number;
  cameraRef: MutableRefObject<CameraRef | null>;
  next: {kind: string; street: string | undefined; toGo: number} | null;
  speedKmh: number | null;
  onRegionChanging: (e: unknown) => void;
  onRegionDid: () => void;
  onRecenter: () => void;
  requestRerouteNow: () => void;
  rerouteForConfirm: () => Promise<boolean>;
  refreshRouteQuiet: () => Promise<boolean>;
  previewStep: (idx: number) => void;
  preview: {at: [number, number]; highlight: [number, number][]; bearing: number} | null;
  hazardFocus: {at: [number, number]; highlight: [number, number][]; idx: number} | null;
  hazardCount: number;
  flagWarnings: FlagWarning[];
  cycleHazard: () => void;
  focusAt: (lat: number, lng: number) => void;
  recentering: boolean;
  traveled: [number, number][];
  remaining: [number, number][];
} {
  const {t, lang, token, dest, stops, width, vehicleType, initialRoute, seed, speak, resolveVoice} = opts;
  const [route, setRoute] = useState<RouteOption>(initialRoute);
  const [pos, setPos] = useState<{lat: number; lng: number} | null>(null);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [following, setFollowing] = useState(true);
  const [arrived, setArrived] = useState(false);  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [streets, setStreets] = useState<Record<number, string>>({});
  const [arrowRotate, setArrowRotate] = useState(0);
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const lastAcceptedRef = useRef<{lat: number; lng: number; ts: number} | null>(null);
  const speedSamplesRef = useRef<number[]>([]);
  const speedRef = useRef(0);
  const GPS_DISPLAY_MAX_M = 65;
  const GPS_ROUTE_MAX_M = 40;
  const GPS_MAX_SPEED_MPS = 60;
  const GPS_SNAP_METERS = 25;
  const [preview, setPreview] = useState<{at: [number, number]; highlight: [number, number][]; bearing: number} | null>(null);
  const [hazardFocus, setHazardFocus] = useState<{at: [number, number]; highlight: [number, number][]; idx: number} | null>(null);
  const hazardFocusRef = useRef<{at: [number, number]; highlight: [number, number][]; idx: number} | null>(null);
  const [recentering, setRecentering] = useState(false);
  const routeRef = useRef(initialRoute);
  const reroutingRef = useRef(false);
  const arrivedRef = useRef(false);
  const offRef = useRef(0);
  const lastRerouteRef = useRef(0);
  const seqRef = useRef(0);
  const announcedRef = useRef({idx: -1, tier: 0});
  const alertedRef = useRef(new Set<string>());
  const streetPendingRef = useRef(new Set<number>());
  const streetsRef = useRef<Record<number, string>>({});
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const followingRef = useRef(true);
  const lastCmdRef = useRef(0);
  const seedPendingRef = useRef(false);
  const seedFrameRef = useRef<(() => void) | null>(null);
  const appSubRef = useRef<{remove: () => void} | null>(null);
  const recenterUntilRef = useRef(0);
  const lastBearingRef = useRef<number | null>(null);
  const lastBearCmdRef = useRef(0);
  const arrowRef = useRef<{value: number; ts: number} | null>(null);
  const firstFixRef = useRef(true);
  const lastFixRef = useRef<{lat: number; lng: number} | null>(null);
  const courseRef = useRef(0);
  const headingRef = useRef<{value: number; ts: number} | null>(null);
  const zoomRef = useRef(FOLLOW_ZOOM);

  const steps = useMemo(() => maneuverSteps(route), [route]);
  const stepProg = useMemo(() => {
    const coords = route.geometry.coordinates;
    return steps.map((s) => projectOntoRoute(s.at[1], s.at[0], coords).progressMeters);
  }, [steps, route]);
  const stepSeg = useMemo(() => {
    const coords = route.geometry.coordinates;
    return steps.map((s) => projectOntoRoute(s.at[1], s.at[0], coords).segIndex);
  }, [steps, route]);

  const distText = (m: number): string =>
    m >= 1000 ? `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} ${t.route.km}` : `${Math.round(m)} ${t.nav.m}`;
  const turnText = (kind: string): string =>
    (t.nav.turns as Record<string, string>)[kind] ?? t.nav.turns.other;

  const ARROW_MIN_INTERVAL_MS = 200;
  const ARROW_MIN_CHANGE_DEG = 2;
  const BEARING_DEADBAND_DEG = 3;
  const CAM_CMD_MIN_GAP_MS = 500;
  const RECENTER_SETTLE_MS = 600;
  const RECENTER_FIX_TIMEOUT_MS = 8000;
  const FOLLOW_MIN_ZOOM = 15;
  const GPS_WAIT_NOTICE_MS = 10000;
  const SEED_FRAME_FALLBACK_MS = 4000;
  const ANNOUNCE_NEAR_SEC = 12;
  const ANNOUNCE_CLOSE_SEC = 5;
  const BEARING_DIRECT_GAP_MS = 250;
  const REROUTE_COOLDOWN_MS = 30000;
  const wrapDeg = (d: number): number => ((d + 540) % 360) - 180;
  const pickBearing = (): number => {
    const h = headingRef.current;
    if (h && Date.now() - h.ts < 15000) return h.value;
    return courseRef.current;
  };

  const flash = (text: string): void => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  };
  const clearError = (): void => setError(null);

  async function reroute(lat: number, lng: number, manual = false): Promise<boolean> {
    const now = Date.now();
    if (!manual && now - lastRerouteRef.current < REROUTE_COOLDOWN_MS) return false;
    lastRerouteRef.current = now;
    const id = (seqRef.current += 1);
    reroutingRef.current = true;
    setRerouting(true);
    void playEventSound("reroute");
    speak(t.nav.rerouting);
    try {
      const res = await findRoute(
        {originLat: lat, originLng: lng, destLat: dest.lat, destLng: dest.lng, stops, width, vehicleType},
        token,
      );
      if (seqRef.current !== id) return false;
      const nr = res.routes?.[0];
      if (!nr) throw new Error(t.route.noResults);
      const changed = JSON.stringify(nr.geometry.coordinates) !== JSON.stringify(routeRef.current.geometry.coordinates);
      routeRef.current = nr;
      setRoute(nr);
      setPreview(null);
      hazardFocusRef.current = null;
      setHazardFocus(null);
      offRef.current = 0;
      announcedRef.current = {idx: -1, tier: 0};
      alertedRef.current = new Set<string>();
      streetPendingRef.current = new Set<number>();
      streetsRef.current = {};
      setStreets({});
      return changed;
    } catch (err) {
      if (seqRef.current === id) setError(toMessage(err));
      return false;
    } finally {
      if (seqRef.current === id) {
        reroutingRef.current = false;
        setRerouting(false);
      }
    }
  }

  const rerouteForConfirm = async (): Promise<boolean> => {
    const p = lastFixRef.current;
    if (!p || reroutingRef.current || arrivedRef.current) return false;
    return reroute(p.lat, p.lng, true);
  };

  const refreshRouteQuiet = async (): Promise<boolean> => {
    const p = lastFixRef.current;
    if (!p || reroutingRef.current || arrivedRef.current) return false;
    const id = (seqRef.current += 1);
    try {
      const res = await findRoute(
        {originLat: p.lat, originLng: p.lng, destLat: dest.lat, destLng: dest.lng, stops, width, vehicleType},
        token,
      );
      if (seqRef.current !== id) return false;
      const nr = res.routes?.[0];
      if (!nr) return false;
      const changed = JSON.stringify(nr.geometry.coordinates) !== JSON.stringify(routeRef.current.geometry.coordinates);
      routeRef.current = nr;
      setRoute(nr);
      setPreview(null);
      hazardFocusRef.current = null;
      setHazardFocus(null);
      offRef.current = 0;
      return changed;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let headSub: Location.LocationSubscription | null = null;
    let alive = true;
    const seedRoute = routeRef.current;
    const seedProg = projectOntoRoute(seed.lat, seed.lng, seedRoute.geometry.coordinates);
    lastFixRef.current = {lat: seed.lat, lng: seed.lng};
    setPos({lat: seed.lat, lng: seed.lng});
    setProgress(seedProg);
    seedPendingRef.current = true;
    const fireSeedFrame = (): void => {
      if (!alive || !seedPendingRef.current || !cameraRef.current) return;
      seedPendingRef.current = false;
      const now = Date.now();
      lastCmdRef.current = now;
      const b = pickBearing();
      lastBearingRef.current = b;
      if (__DEV__) console.log("[nav] seed-frame");
      void cameraRef.current.setStop({
        center: [seed.lng, seed.lat],
        zoom: FOLLOW_ZOOM,
        bearing: b,
        pitch: FOLLOW_PITCH,
        duration: 0,
      });
    };
    seedFrameRef.current = fireSeedFrame;
    const seedTimer = setTimeout(() => {
      fireSeedFrame();
    }, SEED_FRAME_FALLBACK_MS);
    const gpsTimer = setTimeout(() => {
      if (alive && !lastAcceptedRef.current) flash(t.nav.waitingGps);
    }, GPS_WAIT_NOTICE_MS);
    void (async () => {
      const matched = await resolveVoice();
      if (!alive) return;
      if (!matched) flash(t.nav.noVoice);
      try {
        headSub = await Location.watchHeadingAsync((h) => {
          if (!alive) return;
          const v = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          headingRef.current = {value: v, ts: Date.now()};
          const now = Date.now();
          const lastArrow = arrowRef.current;
          if (!lastArrow || now - lastArrow.ts >= ARROW_MIN_INTERVAL_MS || Math.abs(wrapDeg(v - lastArrow.value)) >= ARROW_MIN_CHANGE_DEG) {
            arrowRef.current = {value: v, ts: now};
            setArrowRotate(v);
          }
          if (followingRef.current && now >= recenterUntilRef.current && lastFixRef.current) {
            const p = lastFixRef.current;
            const prevB = lastBearingRef.current;
            if (now - lastBearCmdRef.current >= BEARING_DIRECT_GAP_MS && (prevB === null || Math.abs(wrapDeg(v - prevB)) >= ARROW_MIN_CHANGE_DEG)) {
              lastBearCmdRef.current = now;
              lastBearingRef.current = v;
              void cameraRef.current?.setStop({
                center: [p.lng, p.lat],
                bearing: v,
                duration: 150,
              });
            }
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
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (alive && last) {
            const r = routeRef.current;
            const p = projectOntoRoute(last.coords.latitude, last.coords.longitude, r.geometry.coordinates);
            setPos({lat: last.coords.latitude, lng: last.coords.longitude});
            setProgress(p);
          }
        } catch {}
        const handleFix = (lat: number, lng: number, acc: number, rawSpeed: number | null): void => {
          if (acc > GPS_DISPLAY_MAX_M) return;
          const now = Date.now();
          const prevAccepted = lastAcceptedRef.current;
          if (prevAccepted) {
            const dt = Math.max(1, now - prevAccepted.ts) / 1000;
            const implied = distBetween(prevAccepted, {lat, lng}) / dt;
            if (implied > GPS_MAX_SPEED_MPS) return;
          }
          lastAcceptedRef.current = {lat, lng, ts: now};
          speedRef.current = rawSpeed ?? 0;
          if (rawSpeed !== null) {
            const samples = [...speedSamplesRef.current, rawSpeed].slice(-3);
            speedSamplesRef.current = samples;
            setSpeedKmh(Math.round((samples.reduce((a, b) => a + b, 0) / samples.length) * 3.6));
          } else {
            speedSamplesRef.current = [];
            setSpeedKmh(null);
          }
          const r = routeRef.current;
          const p = projectOntoRoute(lat, lng, r.geometry.coordinates);
          const shown = p.distToRoute <= GPS_SNAP_METERS ? {lat: p.point[1], lng: p.point[0]} : {lat, lng};
          setPos(shown);
          setProgress(p);
          const prev = lastFixRef.current;
          lastFixRef.current = {lat, lng};
          if (prev && distBetween(prev, {lat, lng}) >= FOLLOW_MIN_MOVE_M) {
            courseRef.current = courseBetween(prev, {lat, lng});
          }
          const bearing = pickBearing();
          setArrowRotate(bearing);
          if (followingRef.current) {
            const cmdNow = Date.now();
            const first = firstFixRef.current;
            const suppressed = !first && (cmdNow < recenterUntilRef.current || cmdNow - lastCmdRef.current < CAM_CMD_MIN_GAP_MS);
            if (!suppressed) {
              firstFixRef.current = false;
              lastCmdRef.current = cmdNow;
              const prevBearing = lastBearingRef.current;
              const h = headingRef.current;
              const headingFresh = !!h && cmdNow - h.ts < 15000;
              const driveBearing = first || (!headingFresh && (prevBearing === null || Math.abs(wrapDeg(bearing - prevBearing)) >= BEARING_DEADBAND_DEG));
              if (driveBearing) lastBearingRef.current = bearing;
              void cameraRef.current?.setStop({
                center: [shown.lng, shown.lat],
                ...(first ? {zoom: FOLLOW_ZOOM, pitch: FOLLOW_PITCH} : {}),
                ...(driveBearing ? {bearing} : {}),
                duration: first ? 0 : 300,
              });
            }
          }
          if (!arrivedRef.current && p.remainingMeters <= ARRIVAL_METERS) {
            arrivedRef.current = true;
            setArrived(true);
            const s = t.nav.arrived;
            void playEventSound("arrived");
            speak(s);
            flash(s);
            return;
          }
          if (!reroutingRef.current && !arrivedRef.current) {
            if (p.distToRoute > OFF_ROUTE_METERS && acc <= GPS_ROUTE_MAX_M) {
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
          if (ni >= 0 && !arrivedRef.current) {
            const toGo = Math.max(0, stepProg[ni] - p.progressMeters);
            const kind = steps[ni].kind;
            if (kind !== "destination") {
              const a = announcedRef.current;
              const spd = speedRef.current;
              const etaSec = spd > 1 ? toGo / spd : Number.POSITIVE_INFINITY;
              const nearDue = toGo <= ANNOUNCE_NEAR_METERS || etaSec <= ANNOUNCE_NEAR_SEC;
              const closeDue = toGo <= ANNOUNCE_CLOSE_METERS || etaSec <= ANNOUNCE_CLOSE_SEC;
              if (closeDue && !(a.idx === ni && a.tier >= 2)) {
                announcedRef.current = {idx: ni, tier: 2};
                const street = steps[ni].street ?? streetsRef.current[ni];
                speak(`${turnText(kind)}${street ? `, ${street}` : ""}, ${t.nav.inDistance.replace("{d}", distText(toGo))}`);
              } else if (nearDue && !(a.idx === ni && a.tier >= 1)) {
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
              void playEventSound("hazard");
              speak(msg);
              flash(msg);
              void notifyHazardHeadsUp(t.nav.hazardAlertTitle, msg);
            }
          }
          const flagWarnings = (r.warnings ?? []).filter(isFlagWarning);
          for (const w of flagWarnings) {
            const toGo = w.distanceMeters - p.progressMeters;
            const key = `h:${w.flagId}`;
            if (toGo > 0 && toGo <= HAZARD_ALERT_METERS && !alertedRef.current.has(key)) {
              alertedRef.current.add(key);
              const msg = t.nav.hazardAhead.replace("{d}", distText(toGo));
              void playEventSound("hazard");
              speak(msg);
              flash(msg);
              void notifyHazardHeadsUp(t.nav.hazardAlertTitle, msg);
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
        };
        sub = await Location.watchPositionAsync(
          {accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 1},
          (loc) => {
            if (!alive) return;
            handleFix(
              loc.coords.latitude,
              loc.coords.longitude,
              loc.coords.accuracy ?? Number.POSITIVE_INFINITY,
              typeof loc.coords.speed === "number" && loc.coords.speed >= 0 ? loc.coords.speed : null,
            );
          },
        );
        void startBgNav(t.nav.bgNavTitle, `${t.nav.bgNavBody} · ${distText(seedRoute.distanceMeters)}`);
        const appSub = AppState.addEventListener("change", (state) => {
          if (state !== "active" || !alive) return;
          void (async () => {
            const fix = await readBgFix();
            if (!alive || !fix) return;
            const last = lastAcceptedRef.current;
            if (last && fix.ts <= last.ts) return;
            handleFix(fix.lat, fix.lng, fix.accuracy ?? Number.POSITIVE_INFINITY, fix.speed);
          })();
        });
        appSubRef.current = appSub;
      } catch (err) {
        if (alive) setError(toMessage(err));
      }
    })();
    return () => {
      alive = false;
      clearTimeout(gpsTimer);
      clearTimeout(seedTimer);
      seedFrameRef.current = null;
      appSubRef.current?.remove();
      appSubRef.current = null;
      sub?.remove();
      headSub?.remove();
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
      void Speech.stop();
      void unloadEventSounds();
      void stopBgNav();
    };
  }, []);

  const onRegionChanging = (e: unknown): void => {
    seedFrameRef.current?.();
    const props = (e as {nativeEvent?: {userInteraction?: boolean; zoom?: number}}).nativeEvent;
    if (typeof props?.zoom === "number") zoomRef.current = props.zoom;
    if (props?.userInteraction && Date.now() - lastCmdRef.current > 350) {
      setFollowing(false);
      followingRef.current = false;
    }
  };

  const onRegionDid = (): void => {};

  const HIGHLIGHT_HALF_METERS = 80;
  const flagWarningList = useMemo(() => (route.warnings ?? []).filter(isFlagWarning), [route]);
  const cycleHazard = (): void => {
    const r = routeRef.current;
    const list = (r.warnings ?? []).filter(isFlagWarning);
    if (list.length === 0) return;
    const cur = hazardFocusRef.current;
    const next = cur === null ? 0 : cur.idx + 1;
    if (next >= list.length) {
      hazardFocusRef.current = null;
      setHazardFocus(null);
      setPreview(null);
      return;
    }
    const h = list[next];
    driveToHazard(h.lat, h.lng, h.distanceMeters);
    hazardFocusRef.current = {at: [h.lng, h.lat], highlight: windowAround(r.geometry.coordinates, h.distanceMeters, HIGHLIGHT_HALF_METERS), idx: next};
    setHazardFocus(hazardFocusRef.current);
  };
  const driveToHazard = (lat: number, lng: number, distanceMeters: number): void => {
    const r = routeRef.current;
    const highlight = windowAround(r.geometry.coordinates, distanceMeters, HIGHLIGHT_HALF_METERS);
    hazardFocusRef.current = {at: [lng, lat], highlight, idx: -1};
    setHazardFocus(hazardFocusRef.current);
    setPreview(null);
    setFollowing(false);
    followingRef.current = false;
    lastCmdRef.current = Date.now();
    void cameraRef.current?.setStop({
      center: [lng, lat],
      zoom: Math.max(zoomRef.current, 16),
      duration: 500,
    });
  };
  const focusAt = (lat: number, lng: number): void => {
    const r = routeRef.current;
    const p = projectOntoRoute(lat, lng, r.geometry.coordinates);
    driveToHazard(lat, lng, p.progressMeters);
  };
  const previewStep = (idx: number): void => {
    const r = routeRef.current;
    const coords = r.geometry.coordinates;
    if (idx < 0 || idx >= steps.length || coords.length < 2) return;
    const at = steps[idx].at;
    const from = stepProg[idx] ?? 0;
    const highlight = windowAround(coords, from, HIGHLIGHT_HALF_METERS);
    const seg = stepSeg[idx] ?? 0;
    const p0 = coords[Math.max(0, Math.min(seg, coords.length - 2))];
    const p1 = coords[Math.max(0, Math.min(seg + 1, coords.length - 1))];
    const bearing = (p0[0] !== p1[0] || p0[1] !== p1[1])
      ? courseBetween({lat: p0[1], lng: p0[0]}, {lat: p1[1], lng: p1[0]})
      : pickBearing();
    setPreview({at, highlight, bearing});
    hazardFocusRef.current = null;
    setHazardFocus(null);
    setFollowing(false);
    followingRef.current = false;
    lastCmdRef.current = Date.now();
    void cameraRef.current?.setStop({
      center: [at[0], at[1]],
      bearing,
      duration: 500,
    });
  };
  const requestRerouteNow = (): void => {
    const p = lastFixRef.current;
    if (p && !reroutingRef.current && !arrivedRef.current) void reroute(p.lat, p.lng, true);
  };

  const onRecenter = (): void => {
    setFollowing(true);
    followingRef.current = true;
    setPreview(null);
    hazardFocusRef.current = null;
    setHazardFocus(null);
    const drive = (lat: number, lng: number): void => {
      const now = Date.now();
      lastCmdRef.current = now;
      recenterUntilRef.current = now + RECENTER_SETTLE_MS;
      const bearing = pickBearing();
      lastBearingRef.current = bearing;
      void cameraRef.current?.setStop({
        center: [lng, lat],
        zoom: Math.max(zoomRef.current, FOLLOW_MIN_ZOOM),
        bearing,
        pitch: FOLLOW_PITCH,
        duration: 500,
      });
    };
    const p = lastFixRef.current;
    if (p) {
      drive(p.lat, p.lng);
      return;
    }
    if (recentering) return;
    setRecentering(true);
    void (async () => {
      try {
        const raced = await Promise.race([
          Location.getCurrentPositionAsync({accuracy: Location.Accuracy.Balanced}),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), RECENTER_FIX_TIMEOUT_MS)),
        ]);
        const fix = raced ?? (await Location.getLastKnownPositionAsync().catch(() => null));
        if (fix) {
          const lat = fix.coords.latitude;
          const lng = fix.coords.longitude;
          lastFixRef.current = {lat, lng};
          drive(lat, lng);
        }
      } catch {}
      setRecentering(false);
    })();
  };

  const nextIdx = useMemo(() => {
    if (!progress || arrived) return -1;
    for (let i = 0; i < steps.length; i++) {
      if (stepProg[i] > progress.progressMeters + 5) return i;
    }
    return -1;
  }, [steps, stepProg, progress, arrived]);
  const next = nextIdx >= 0 ? steps[nextIdx] : null;
  const nextStreet = next ? (next.street ?? streets[nextIdx]) : undefined;
  const nextToGo = next && progress ? Math.max(0, stepProg[nextIdx] - progress.progressMeters) : 0;
  const coords = route.geometry.coordinates;
  const split = progress ? splitRoute(coords, progress.segIndex, progress.point) : {traveled: [] as [number, number][], remaining: coords};

  return {
    route,
    pos,
    progress,
    following,
  arrived,
  rerouting,
  error,
  clearError,
    notice,
    streets,
    steps,
    stepProg,
    arrowRotate,
    cameraRef,
    next: next ? {kind: next.kind, street: nextStreet, toGo: nextToGo} : null,
    speedKmh,
  onRegionChanging,
  onRegionDid,
  onRecenter,
  requestRerouteNow,
  rerouteForConfirm,
  refreshRouteQuiet,
  previewStep,
  preview,
  hazardFocus,
  hazardCount: flagWarningList.length,
  flagWarnings: flagWarningList,
  cycleHazard,
  focusAt,
  recentering,
  traveled: split.traveled,
  remaining: split.remaining,
};
}
