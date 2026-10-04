import {api} from "./client";

export type RatingTargetKind = "VOLUNTEER" | "SHOP" | "RIDER";

export type SubmitRatingPayload = {
  targetId: string;
  targetKind: RatingTargetKind;
  ticketId: string;
  score: number;
};

export type RatingSummary = {
  avg: number;
  count: number;
  updated: number;
};

export async function submitRating(payload: SubmitRatingPayload, token: string): Promise<RatingSummary> {
  return api.post<RatingSummary>("/ratings", payload, token);
}

export async function replyRating(ratingId: string, reply: string, token: string): Promise<{replied: boolean}> {
  return api.post<{replied: boolean}>("/ratings/reply", {ratingId, reply}, token);
}

export type UserRating = {
  id: string;
  targetId?: string;
  targetKind?: string;
  score: number;
  ticketId?: string;
  reply?: string | null;
  repliedAt?: string | null;
  createdAt?: string;
};

export type UserRatings = {
  ratings: UserRating[];
  avg: number;
  count: number;
};

export async function userRatings(userId: string, targetKind: "VOLUNTEER" | "RIDER", ticketId: string | undefined, token: string): Promise<UserRatings> {
  return api.post<UserRatings>("/users/ratings", {userId, targetKind, ticketId}, token);
}

export async function ratingsByTicket(ticketId: string, token: string): Promise<UserRating[]> {
  return api.post<UserRating[]>("/ratings/by-ticket", {ticketId}, token);
}
