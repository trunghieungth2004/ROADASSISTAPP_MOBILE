import type {FeedTicket} from "../../api/dispatch";
import {towDestOf} from "./towDest";

export type JobRoutePoint = {lat: number; lng: number} | null;

const routeCoord = (value: number | undefined): string =>
  typeof value === "number" ? value.toFixed(3) : "";

export function isLiveJob(ticket: FeedTicket | null): boolean {
  if (!ticket) return false;
  if (ticket.ticketType !== "TOW" && ticket.ticketType !== "SOS") return false;
  return ticket.status === "2" || ticket.status === "3" ||
    (ticket.ticketType === "SOS" &&
      (ticket.status === "7" || ticket.status === "9"));
}

export function jobRouteKeyFor(
  ticket: FeedTicket | null,
  sosProviderPoint: JobRoutePoint,
  localPoint?: JobRoutePoint,
): string | null {
  if (!ticket || !isLiveJob(ticket)) return null;
  if (ticket.ticketType === "SOS") {
    return [
      ticket.id,
      ticket.status,
      "SOS",
      routeCoord(sosProviderPoint?.lat),
      routeCoord(sosProviderPoint?.lng),
    ].join(":");
  }
  const tower = ticket.towerFix &&
    typeof ticket.towerFix.lat === "number" &&
    typeof ticket.towerFix.lng === "number" ?
    ticket.towerFix :
    null;
  const origin = ticket.direction === "in" ? localPoint ?? null : tower;
  const dest = towDestOf(ticket);
  return [
    ticket.id,
    ticket.status,
    dest ? `${dest.lat},${dest.lng}` : "no-dest",
    routeCoord(origin?.lat),
    routeCoord(origin?.lng),
  ].join(":");
}
