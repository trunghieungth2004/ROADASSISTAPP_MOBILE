type Bucket = "paint" | "layout";

const MAPPING = {
  lineColor: {bucket: "paint", key: "line-color"},
  lineWidth: {bucket: "paint", key: "line-width"},
  lineOpacity: {bucket: "paint", key: "line-opacity"},
  circleColor: {bucket: "paint", key: "circle-color"},
  circleRadius: {bucket: "paint", key: "circle-radius"},
  circleStrokeColor: {bucket: "paint", key: "circle-stroke-color"},
  circleStrokeWidth: {bucket: "paint", key: "circle-stroke-width"},
  fillColor: {bucket: "paint", key: "fill-color"},
  fillOpacity: {bucket: "paint", key: "fill-opacity"},
  textColor: {bucket: "paint", key: "text-color"},
  lineCap: {bucket: "layout", key: "line-cap"},
  lineJoin: {bucket: "layout", key: "line-join"},
  iconImage: {bucket: "layout", key: "icon-image"},
  iconSize: {bucket: "layout", key: "icon-size"},
  iconAnchor: {bucket: "layout", key: "icon-anchor"},
  iconRotate: {bucket: "layout", key: "icon-rotate"},
  iconAllowOverlap: {bucket: "layout", key: "icon-allow-overlap"},
  iconIgnorePlacement: {bucket: "layout", key: "icon-ignore-placement"},
  iconRotationAlignment: {bucket: "layout", key: "icon-rotation-alignment"},
  textField: {bucket: "layout", key: "text-field"},
  textSize: {bucket: "layout", key: "text-size"},
  textAnchor: {bucket: "layout", key: "text-anchor"},
  textAllowOverlap: {bucket: "layout", key: "text-allow-overlap"},
  textIgnorePlacement: {bucket: "layout", key: "text-ignore-placement"},
} as const satisfies Record<string, {bucket: Bucket; key: string}>;

export type FlatLayerStyle = {[K in keyof typeof MAPPING]?: string | number | boolean};

export function splitLayerStyle(style: FlatLayerStyle): {paint: Record<string, string | number | boolean>; layout: Record<string, string | number | boolean>} {
  const paint: Record<string, string | number | boolean> = {};
  const layout: Record<string, string | number | boolean> = {};
  for (const [camel, value] of Object.entries(style)) {
    const mapped = (MAPPING as Record<string, {bucket: Bucket; key: string}>)[camel];
    if (!mapped || value === undefined) continue;
    if (mapped.bucket === "paint") paint[mapped.key] = value;
    else layout[mapped.key] = value;
  }
  return {paint, layout};
}
