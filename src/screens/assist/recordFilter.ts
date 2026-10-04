import type {FeedDirection, FeedTicket} from "../../api/dispatch";

export type RecordFilter = "ALL" | "IN" | "OUT";

export const RECORD_FILTERS: RecordFilter[] = ["ALL", "IN", "OUT"];

export function directionOf(ticket: Pick<FeedTicket, "direction">): FeedDirection {
  return ticket.direction;
}

export function filterRecords(tickets: FeedTicket[], filter: RecordFilter): FeedTicket[] {
  if (filter === "ALL") return [...tickets];
  const want: FeedDirection = filter === "IN" ? "in" : "out";
  return tickets.filter((t) => t.direction === want);
}
