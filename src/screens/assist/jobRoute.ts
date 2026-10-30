import type {FeedTicket} from "../../api/dispatch";
import {towDestOf} from "./towDest";

export type JobRoutePoint = {lat: number; lng: number} | null;

export function isLiveJob(ticket: FeedTicket | null): boolean {
  if (!ticket) return false;
  if (ticket.ticketType !== "TOW" && ticket.ticketType !== "SOS") return false;
  return ticket.status === "2" || ticket.status === "3" ||
    (ticket.ticketType === "SOS" && ticket.status === "7");
}


export function jobRouteKeyFor(
  ticket: FeedTicket | null,
  sosProviderPoint: JobRoutePoint,
): string | null {
  if (!ticket || !isLiveJob(ticket)) return null;
  if (ticket.ticketType === "SOS") {
    return [
      ticket.id,
      ticket.status,
      "SOS",
      sosProviderPoint?.lat ?? "",
      sosProviderPoint?.lng ?? "",
    ].join(":");
  }
  const tower = ticket.towerFix &&
    typeof ticket.towerFix.lat === "number" &&
    typeof ticket.towerFix.lng === "number" ?
    ticket.towerFix :
    null;
  const dest = towDestOf(ticket);
  return [
    ticket.id,
    ticket.status,
    dest ? `${dest.lat},${dest.lng}` : "no-dest",
    tower?.lat ?? "",
    tower?.lng ?? "",
  ].join(":");
}
