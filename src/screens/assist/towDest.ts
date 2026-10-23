import type {DispatchTicket, FeedTicket} from "../../api/dispatch";

export type TowRouteTicket = Pick<
  DispatchTicket,
  "id" | "lat" | "lng" | "ticketType" | "vehicleType" | "vehicleWidth" | "destinationSnapshot" | "destinationPoint"
> & {
  direction?: FeedTicket["direction"];
  status?: string;
  towerFix?: {lat: number; lng: number} | null;
  destinationParty?: FeedTicket["destinationParty"];
};

export function towDestOf(  ticket: Pick<TowRouteTicket, "destinationParty" | "destinationSnapshot" | "destinationPoint">,
): {lat: number; lng: number} | null {
  const party = ticket.destinationParty;
  if (party !== null && typeof party === "object" && typeof party.lat === "number" && typeof party.lng === "number") {
    return {lat: party.lat, lng: party.lng};
  }
  const snap = ticket.destinationSnapshot;
  if (snap && typeof snap.lat === "number" && typeof snap.lng === "number") {
    return {lat: snap.lat, lng: snap.lng};
  }
  const point = ticket.destinationPoint;
  if (point && typeof point.lat === "number" && typeof point.lng === "number") {
    return {lat: point.lat, lng: point.lng};
  }
  return null;
}

export function hasDropOff(
  ticket: Pick<TowRouteTicket, "destinationParty" | "destinationSnapshot" | "destinationPoint">,
): boolean {
  const party = ticket.destinationParty;
  if (party !== null && typeof party === "object" &&
    typeof party.name === "string" && party.name !== "") {
    return true;
  }
  const snap = ticket.destinationSnapshot;
  if (snap && typeof snap === "object" &&
    ((typeof snap.name === "string" && snap.name !== "") ||
      (typeof snap.label === "string" && snap.label !== ""))) {
    return true;
  }
  const point = ticket.destinationPoint;
  if (point && typeof point === "object" &&
    typeof point.label === "string" && point.label !== "") {
    return true;
  }
  return towDestOf(ticket) !== null;
}

export function declinedShopIds(
  ticket: Pick<DispatchTicket, "towLegs">,
): Set<string> {
  const out = new Set<string>();
  if (!Array.isArray(ticket.towLegs)) return out;
  for (const leg of ticket.towLegs) {
    if (typeof leg?.toShopId === "string" && leg.toShopId !== "") {
      out.add(leg.toShopId);
    }
  }
  return out;
}
