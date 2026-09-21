import {useEffect, useMemo, useRef, useState, type MutableRefObject} from "react";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import {type CameraRef} from "@maplibre/maplibre-react-native";
import {findRoute, isHazardZone, isWidthBlock, type RouteOption} from "../../api/routes";
import {reverseLabel} from "../../api/places";
import {toMessage} from "../../api/client";
import {maneuverSteps} from "../../services/maneuvers";
import {
  ANNOUNCE_CLOSE_METERS,
  ANNOUNCE_NEAR_METERS,
  ARRIVAL_METERS,
  HAZARD_ALERT_METERS,
  OFF_ROUTE_FIXES,
  OFF_ROUTE_METERS,
  projectOntoRoute,
  routeLengths,
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
  notice: string | null;
  nextIdx: number;
  streets: Record<number, string>;
  steps: ReturnType<typeof maneuverSteps>;
  stepProg: number[];
  arrowRotate: number;
  cameraRef: MutableRefObject<CameraRef | null>;
  next: {kind: string; street: string | undefined; toGo: number} | null;
  onRegionChanging: (e: unknown) => void;
  onRegionDid: () => void;
  onRecenter: () => void;
  previewStep: (idx: number) => void;
  preview: {at: [number, number]; highlight: [number, number][]; bearing: number} | null;
  traveled: [number, number][];
  remaining: [number, number][];
} {
  const {t, lang, token, dest, stops, width, vehicleType, initialRoute, speak, resolveVoice} = opts;
  const [route, setRoute] = useState<RouteOption>(initialRoute);
  const [pos, setPos] = useState<{lat: number; lng: number} | null>(null);
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [following, setFollowing] = useState(true);
  const [arrived, setArrived] = useState(false);
  const [rerouting, setRerouting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nextIdx, setNextIdx] = useState(-1);
  const [streets, setStreets] = useState<Record<number, string>>({});
  const [arrowRotate, setArrowRotate] = useState(0);
  const [preview, setPreview] = useState<{at: [number, number]; highlight: [number, number][]; bearing: number} | null>(null);
  const routeRef = useRef(initialRoute);
  const reroutingRef = useRef(false);
  const arrivedRef = useRef(false);
  const offRef = useRef(0);
  const seqRef = useRef(0);
  const announcedRef = useRef({idx: -1, tier: 0});
  const alertedRef = useRef(new Set<string>());
  const streetPendingRef = useRef(new Set<number>());
  const streetsRef = useRef<Record<number, string>>({});
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cameraRef = useRef<CameraRef | null>(null);
  const followingRef = useRef(true);
  const lastCmdRef = useRef(0);
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
      setPreview(null);
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
            lastCmdRef.current = Date.now();
            cameraRef.current?.setCamera({
              centerCoordinate: [p.lng, p.lat],
              zoomLevel: FOLLOW_ZOOM,
              heading: v,
              pitch: FOLLOW_PITCH,
              animationDuration: 300,
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
              lastCmdRef.current = Date.now();
              const first = firstFixRef.current;
              firstFixRef.current = false;
              cameraRef.current?.setCamera({
                centerCoordinate: [lng, lat],
                ...(first ? {zoomLevel: FOLLOW_ZOOM, pitch: FOLLOW_PITCH} : {}),
                heading: bearing,
                animationDuration: first ? 0 : 300,
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
            setNextIdx((prevIdx) => (prevIdx === ni ? prevIdx : ni));
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

  const onRegionChanging = (e: unknown): void => {
    const props = (e as {properties?: {isUserInteraction?: boolean; zoomLevel?: number}}).properties;
    if (typeof props?.zoomLevel === "number") zoomRef.current = props.zoomLevel;
    if (props?.isUserInteraction && Date.now() - lastCmdRef.current > 350) {
      setFollowing(false);
      followingRef.current = false;
    }
  };

  const onRegionDid = (): void => {};

  const previewStep = (idx: number): void => {
    const r = routeRef.current;
    const coords = r.geometry.coordinates;
    if (idx < 0 || idx >= steps.length || coords.length < 2) return;
    const at = steps[idx].at;
    const {cum, total} = routeLengths(coords);
    const from = stepProg[idx] ?? 0;
    const to = idx + 1 < stepProg.length ? stepProg[idx + 1] : total;
    const highlight: [number, number][] = [at];
    for (let i = 0; i < coords.length; i++) {
      if (cum[i] > from && cum[i] < to) highlight.push(coords[i]);
    }
    highlight.push(idx + 1 < steps.length ? steps[idx + 1].at : coords[coords.length - 1]);
    const seg = stepSeg[idx] ?? 0;
    const p0 = coords[Math.max(0, Math.min(seg, coords.length - 2))];
    const p1 = coords[Math.max(0, Math.min(seg + 1, coords.length - 1))];
    const bearing = (p0[0] !== p1[0] || p0[1] !== p1[1])
      ? courseBetween({lat: p0[1], lng: p0[0]}, {lat: p1[1], lng: p1[0]})
      : pickBearing();
    setPreview({at, highlight, bearing});
    setFollowing(false);
    followingRef.current = false;
    lastCmdRef.current = Date.now();
    cameraRef.current?.setCamera({
      centerCoordinate: [at[0], at[1]],
      heading: bearing,
      animationDuration: 500,
    });
  };
  const onRecenter = (): void => {
    setFollowing(true);
    followingRef.current = true;
    setPreview(null);
    const p = lastFixRef.current;
    if (p) {
      lastCmdRef.current = Date.now();
      cameraRef.current?.setCamera({
        centerCoordinate: [p.lng, p.lat],
        zoomLevel: FOLLOW_ZOOM,
        heading: pickBearing(),
        pitch: FOLLOW_PITCH,
        animationDuration: 500,
      });
    }
  };

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
    notice,
    nextIdx,
    streets,
    steps,
    stepProg,
    arrowRotate,
    cameraRef,
    next: next ? {kind: next.kind, street: nextStreet, toGo: nextToGo} : null,
  onRegionChanging,
  onRegionDid,
  onRecenter,
  previewStep,
  preview,
  traveled: split.traveled,
  remaining: split.remaining,
};
}
