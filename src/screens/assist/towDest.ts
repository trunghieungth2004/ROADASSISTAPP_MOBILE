import type {DispatchTicket, FeedTicket} from "../../api/dispatch";

export type TowRouteTicket = Pick<
  DispatchTicket,
  "id" | "lat" | "lng" | "ticketType" | "vehicleType" | "vehicleWidth" | "destinationSnapshot" | "destinationPoint"
> & {
  destinationParty?: FeedTicket["destinationParty"];
};

export function towDestOf(
  ticket: Pick<TowRouteTicket, "destinationParty" | "destinationSnapshot" | "destinationPoint">,
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
