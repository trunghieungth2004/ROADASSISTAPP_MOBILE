import {useRef, useState, type MutableRefObject} from "react";
import {PanResponder, type PanResponderInstance} from "react-native";
import {formatPoint} from "../../api/places";
import type {RouteOption} from "../../api/routes";
import {ARM_RADIUS, MAX_STOPS, type CamState, type DragTarget, type Point, type SearchField, type Stop} from "./types";
import {midOf} from "./routeGeo";

export type DragContext = {
  origin: Point | null;
  dest: Point | null;
  stops: Stop[];
  routes: RouteOption[];
  selectedIndex: number;
  busy: boolean;
  pickingFor: SearchField | null;
  flagMode: boolean;
  requestRoute: (o: Point | null, d: Point | null, s: Stop[], width?: number, vehicleType?: string, fit?: boolean) => void;
  setOrigin: (p: Point) => void;
  setOriginText: (s: string) => void;
  setDest: (p: Point) => void;
  setDestText: (s: string) => void;
  setStops: (s: Stop[]) => void;
  onPickMapPoint: (lat: number, lng: number) => void;
  onFlagMapPoint: (lat: number, lng: number) => void;
};

export function useRouteDrag(ctx: DragContext): {
  dragging: DragTarget | null;
  dragPos: Point | null;
  dragPan: PanResponderInstance;
  camRef: MutableRefObject<CamState>;
  mapZoom: number;
  subscribeRegionDid: (cb: () => void) => () => void;
  onRegionChange: (e: unknown) => void;
  onRegionDid: (e: unknown) => void;
  onMapPress: (e: unknown) => void;
} {
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  const [dragging, setDragging] = useState<DragTarget | null>(null);
  const [dragPos, setDragPos] = useState<Point | null>(null);
  const mapZoom = 13;
  const camRef = useRef<CamState>(null);
  const grantRef = useRef<{target: DragTarget; base: Point} | null>(null);
  const dragTargetRef = useRef<DragTarget | null>(null);
  const regionListeners = useRef(new Set<() => void>());
  dragTargetRef.current = dragging;
  const subscribeRegionDid = (cb: () => void): (() => void) => {
    regionListeners.current.add(cb);
    return () => {
      regionListeners.current.delete(cb);
    };
  };
  function onRegionChange(e: unknown) {
    const p = (e as {nativeEvent?: {center?: [number, number]; zoom?: number; bounds?: [number, number, number, number]}}).nativeEvent;
    const c = p?.center;
    const b = p?.bounds;
    if (!c || !b || b.length < 4) return;
    const prev = camRef.current;
    const zoom = p?.zoom ?? 13;
    camRef.current = {center: [c[0], c[1]], zoom, ne: [b[2], b[3]], sw: [b[0], b[1]], w: prev?.w ?? 0, h: prev?.h ?? 0};
  }
  function onRegionDid(e: unknown) {
    onRegionChange(e);
    const cam = camRef.current;
    if (__DEV__ && cam) console.log("[TRACE] camera settled", cam.center[1].toFixed(5), cam.center[0].toFixed(5), "z", cam.zoom.toFixed(2));
    for (const cb of [...regionListeners.current]) {
      try {
        cb();
      } catch {}
    }
  }
  function project(lng: number, lat: number): {x: number; y: number} | null {
    const cam = camRef.current;
    if (!cam || cam.w <= 0) return null;
    const spanLng = cam.ne[0] - cam.sw[0];
    const spanLat = cam.ne[1] - cam.sw[1];
    if (spanLng <= 0 || spanLat <= 0) return null;
    return {x: ((lng - cam.sw[0]) / spanLng) * cam.w, y: ((cam.ne[1] - lat) / spanLat) * cam.h};
  }
  function markersScreen(): {t: DragTarget; at: Point; lift: number}[] {
    const live = ctxRef.current;
    const out: {t: DragTarget; at: Point; lift: number}[] = [];
    if (live.origin) out.push({t: "origin", at: live.origin, lift: 0});
    if (live.dest) out.push({t: "destination", at: live.dest, lift: 0});
    const sel = live.routes[live.selectedIndex] ?? null;
    const mid = sel ? midOf(sel.geometry.coordinates) : null;
    if (mid) out.push({t: "handle", at: {lat: mid[1], lng: mid[0]}, lift: 0});
    return out;
  }
  function nearestMarker(lng: number, lat: number, radius: number): DragTarget | null {
    const p = project(lng, lat);
    if (!p) return null;
    let best: DragTarget | null = null;
    let bestDist = radius;
    for (const m of markersScreen()) {
      const mp = project(m.at.lng, m.at.lat);
      if (!mp) continue;
      const d = Math.hypot(mp.x - p.x, mp.y + m.lift - p.y);
      if (d < bestDist) {
        bestDist = d;
        best = m.t;
      }
    }
    return best;
  }
  function onMapPress(e: unknown) {
    const live = ctxRef.current;
    if (live.busy || dragging) return;
    const coords = (e as {nativeEvent?: {lngLat?: [number, number]}}).nativeEvent?.lngLat;
    if (!coords) return;
    if (live.pickingFor) {
      live.onPickMapPoint(coords[1], coords[0]);
      return;
    }
    if (live.flagMode) {
      live.onFlagMapPoint(coords[1], coords[0]);
      return;
    }
    const hit = nearestMarker(coords[0], coords[1], ARM_RADIUS);
    if (hit) setDragging(hit);
  }
  const dragPan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: (evt) => {
      const live = ctxRef.current;
      const target = dragTargetRef.current;
      if (!target) return false;
      const m = markersScreen().find((k) => k.t === target);
      const base = target === "origin" ? live.origin : target === "destination" ? live.dest : m?.at ?? null;
      if (!m || !base) {
        setDragging(null);
        return false;
      }
      const mp = project(base.lng, base.lat);
      if (!mp) return false;
      const nx = (evt.nativeEvent as {locationX?: number}).locationX ?? 0;
      const ny = (evt.nativeEvent as {locationY?: number}).locationY ?? 0;
      if (Math.hypot(mp.x - nx, mp.y + m.lift - ny) > ARM_RADIUS * 1.5) {
        setDragging(null);
        return false;
      }
      grantRef.current = {target, base: {...base}};
      return true;
    },
    onPanResponderMove: (_, gs) => {
      const g = grantRef.current;
      const cam = camRef.current;
      if (!g || !cam) return;
      const dLng = (gs.dx / cam.w) * (cam.ne[0] - cam.sw[0]);
      const dLat = (-gs.dy / cam.h) * (cam.ne[1] - cam.sw[1]);
      const next = {lat: g.base.lat + dLat, lng: g.base.lng + dLng};
      const live = ctxRef.current;
      if (g.target === "origin") {
        live.setOrigin(next);
        live.setOriginText(formatPoint(next.lat, next.lng));
      } else if (g.target === "destination") {
        live.setDest(next);
        live.setDestText(formatPoint(next.lat, next.lng));
      } else {
        setDragPos(next);
      }
    },
    onPanResponderRelease: (_, gs) => {
      const g = grantRef.current;
      const cam = camRef.current;
      grantRef.current = null;
      setDragging(null);
      setDragPos(null);
      if (!g || !cam) return;
      if (Math.hypot(gs.dx, gs.dy) < 8) return;
      const dLng = (gs.dx / cam.w) * (cam.ne[0] - cam.sw[0]);
      const dLat = (-gs.dy / cam.h) * (cam.ne[1] - cam.sw[1]);
      const next = {lat: g.base.lat + dLat, lng: g.base.lng + dLng};
      const live = ctxRef.current;
      if (live.busy) return;
      if (g.target === "origin") {
        live.setOrigin(next);
        live.setOriginText(formatPoint(next.lat, next.lng));
        if (live.routes.length > 0 && live.dest) live.requestRoute(next, live.dest, live.stops);
      } else if (g.target === "destination") {
        live.setDest(next);
        live.setDestText(formatPoint(next.lat, next.lng));
        if (live.routes.length > 0 && live.origin) live.requestRoute(live.origin, next, live.stops);
      } else if (live.origin && live.dest && live.stops.length < MAX_STOPS) {
        const updated = [...live.stops, {label: formatPoint(next.lat, next.lng), lat: next.lat, lng: next.lng}];
        live.setStops(updated);
        live.requestRoute(live.origin, live.dest, updated);
      }
    },
    onPanResponderTerminate: () => {
      grantRef.current = null;
      setDragging(null);
      setDragPos(null);
    },
  })).current;
  return {dragging, dragPos, dragPan, camRef, mapZoom, subscribeRegionDid, onRegionChange, onRegionDid, onMapPress};
}
