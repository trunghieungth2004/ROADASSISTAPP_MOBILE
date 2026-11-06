import type {Provider} from "../../api/providers";

export function providerFromParty(
  party: unknown,
  fallback: {lat: number; lng: number} | null,
): Provider | null {
  if (typeof party !== "object" || party === null) return null;
  const record = party as {
    id?: unknown;
    name?: unknown;
    kind?: unknown;
    lat?: unknown;
    lng?: unknown;
    label?: unknown;
    openNow?: unknown;
    ratingAvg?: unknown;
    ratingCount?: unknown;
    phone?: unknown;
    services?: unknown;
  };
  if (typeof record.id !== "string" || record.id === "" ||
    typeof record.name !== "string") {
    return null;
  }
  const coords = typeof record.lat === "number" &&
    typeof record.lng === "number" ?
    {lat: record.lat, lng: record.lng} :
    fallback;
  if (!coords) return null;
  return {
    id: record.id,
    kind: record.kind === "TOW" ? "TOW" :
      record.kind === "MOBILE_SHOP" ? "MOBILE_SHOP" : "SHOP",
    name: record.name,
    lat: coords.lat,
    lng: coords.lng,
    status: "ACTIVE",
    accepting: true,
    ...(typeof record.label === "string" ? {label: record.label} : {}),
    ...(typeof record.openNow === "boolean" ?
      {openNow: record.openNow} :
      {}),
    ...(typeof record.ratingAvg === "number" ?
      {ratingAvg: record.ratingAvg} :
      {}),
    ...(typeof record.ratingCount === "number" ?
      {ratingCount: record.ratingCount} :
      {}),
    ...(typeof record.phone === "string" ? {phone: record.phone} : {}),
    ...(Array.isArray(record.services) ?
      {services: record.services} :
      {}),
  } as Provider;
}
