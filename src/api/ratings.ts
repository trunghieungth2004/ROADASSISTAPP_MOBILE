import {api} from "./client";

export type RatingTargetKind = "SHOP" | "RIDER";

export type SubmitRatingPayload = {
  targetId: string;
  targetKind: RatingTargetKind;
  ticketId: string;
  score: number;
  text?: string;
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
  byUserId?: string;
  byUserName?: string | null;
  score: number;
  text?: string | null;
  reply?: string | null;
  repliedByName?: string | null;
  ticketId?: string;
  repliedAt?: string | null;
  createdAt?: string;
  excluded?: boolean;
  appealStatus?: string | null;
};

export type UserRatings = {
  ratings: UserRating[];
  avg: number;
  count: number;
};

export async function userRatings(userId: string, targetKind: "RIDER", ticketId: string | undefined, token: string): Promise<UserRatings> {
  return api.post<UserRatings>("/users/ratings", {userId, targetKind, ticketId}, token);
}

export async function ratingsByTicket(ticketId: string, token: string): Promise<UserRating[]> {
  return api.post<UserRating[]>("/ratings/by-ticket", {ticketId}, token);
}

export type RatingAppealStatus = "OPEN" | "RESOLVED" | "DISMISSED" | null;

export type ReceivedRating = {
  id: string;
  score: number;
  text: string | null;
  ticketId: string;
  createdAt: string;
  byUserId: string;
  byUserName: string | null;
  excluded: boolean;
  appealStatus: RatingAppealStatus;
  appealResolution: string | null;
  appealReason?: string | null;
  appealNote?: string | null;
  appealCreatedAt?: string | null;
  appealDecidedAt?: string | null;
  canAppeal: boolean;
};

export type ReceivedRatingGroup = {
  id: string;
  name: string;
  avg: number;
  count: number;
  window: number;
  ratings: ReceivedRating[];
};

export type ReceivedRatings = {
  rider: ReceivedRatingGroup;
  providers: ReceivedRatingGroup[];
};


export async function receivedRatings(token: string): Promise<ReceivedRatings> {
  return api.post<ReceivedRatings>("/ratings/received", {}, token);
}
