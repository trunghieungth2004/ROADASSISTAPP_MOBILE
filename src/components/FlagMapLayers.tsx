import {memo, useMemo} from "react";
import {Layer, GeoJSONSource} from "@maplibre/maplibre-react-native";
import type {Flag} from "../api/flags";
import {flagStatusColor} from "./flagStatus";

type Props = {flags: Flag[]; onPick: (flag: Flag) => void};

const GROUPS = [
  {status: "1", icon: "flag-1"},
  {status: "2", icon: "flag-2"},
  {status: "3", icon: "flag-3"},
  {status: "0", icon: "flag-0"},
];

function ring(lat: number, lng: number, radiusMeters: number): [number, number][] {
  const pts: [number, number][] = [];
  const cosLat = Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < 32; i++) {
    const a = (2 * Math.PI * i) / 32;
    pts.push([lng + (radiusMeters * Math.sin(a)) / (111320 * cosLat), lat + (radiusMeters * Math.cos(a)) / 111320]);
  }
  pts.push(pts[0]);
  return pts;
}

function bucket(status: string): string {
  return status === "1" || status === "2" || status === "3" ? status : "0";
}

type FillFC = {
  type: "FeatureCollection";
  features: {type: "Feature"; geometry: {type: "Polygon"; coordinates: [number, number][][]}; properties: Record<string, never>}[];
};

type DotFC = {
  type: "FeatureCollection";
  features: {type: "Feature"; geometry: {type: "Point"; coordinates: [number, number]}; properties: {id: string}}[];
};

type Grouped = {status: string; icon: string; fills: FillFC; dots: DotFC; ids: string[]; pick: (id: string | undefined) => void};

function FlagMapLayers({flags, onPick}: Props) {
  const groups = useMemo<Grouped[]>(() => {
    const byId = new Map(flags.map((f) => [f.id, f]));
    const pick = (id: string | undefined): void => {
      if (!id) return;
      const hit = byId.get(id);
      if (hit) onPick(hit);
    };
    return GROUPS.map((g) => {
      const list = flags.filter((f) => bucket(f.status) === g.status);
      const fills: FillFC = {
        type: "FeatureCollection",
        features: list.map((f) => ({
          type: "Feature",
          geometry: {type: "Polygon", coordinates: [ring(f.lat, f.lng, f.radiusMeters ?? 200)]},
          properties: {},
        })),
      };
      const dots: DotFC = {
        type: "FeatureCollection",
        features: list.map((f) => ({
          type: "Feature",
          geometry: {type: "Point", coordinates: [f.lng, f.lat]},
          properties: {id: f.id},
        })),
      };
      return {status: g.status, icon: g.icon, fills, dots, ids: list.map((f) => f.id), pick};
    });
  }, [flags, onPick]);
  return (
    <>
      {groups.map((g) => (
          <GeoJSONSource key={`flag-fill-${g.status}`} id={`flag-fill-${g.status}`} data={g.fills}>
            <Layer type="fill" id={`flag-fill-${g.status}`} style={{fillColor: flagStatusColor(g.status === "0" ? "x" : g.status), fillOpacity: 0.25}} />
          </GeoJSONSource>
      ))}
      {groups.map((g) => (
          <GeoJSONSource
            key={`flag-dot-${g.status}`}
            id={`flag-dot-${g.status}`}
            data={g.dots}
            onPress={(e: unknown) => {
              const features = (e as {nativeEvent?: {features?: {properties?: {id?: string}}[]}}).nativeEvent?.features;
              g.pick(features?.[0]?.properties?.id);
            }}
          >
            <Layer
              type="symbol"
              id={`flag-dot-${g.status}`}
              style={{iconImage: g.icon, iconSize: 0.5, iconAnchor: "center", iconAllowOverlap: true, iconIgnorePlacement: true}}
            />
          </GeoJSONSource>
        ),
      )}
    </>
  );
}

export default memo(FlagMapLayers);
