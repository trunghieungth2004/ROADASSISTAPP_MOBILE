import {config} from "../config";

export const mapDefaults = {
  center: [106.6602, 10.7626] as [number, number],
  zoom: 13,
};

const TILE_ZOOM = 14;

export function brandTileUrl(): string {
  const n = 2 ** TILE_ZOOM;
  const [lng, lat] = mapDefaults.center;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return config.maptilerKey
    ? `https://api.maptiler.com/maps/streets-v2/${TILE_ZOOM}/${x}/${y}.png?key=${config.maptilerKey}`
    : `https://tile.openstreetmap.org/${TILE_ZOOM}/${x}/${y}.png`;
}
