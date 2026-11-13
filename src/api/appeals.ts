import {api} from "./client";

export type AppealSubjectKind = "RATING" | "REPORT" | "DISPUTE";

export type AppealItem = {
  subjectKind: AppealSubjectKind;
  subjectId: string;
  ticketId: string | null;
  label: string;
  createdAt: string;
  canAppeal: boolean;
  appealStatus: string | null;
  appealReason?: string | null;
  appealNote?: string | null;
  appealResolution?: string | null;
  appealCreatedAt?: string | null;
  appealDecidedAt?: string | null;
  snapshot: Record<string, unknown>;
};

export type EligibleAppeals = {
  ratings: AppealItem[];
  reports: AppealItem[];
  disputes: AppealItem[];
};

export type AppealReason =
  | "RETALIATORY"
  | "NOT_THE_SERVICE"
  | "WRONG_TICKET"
  | "ABUSIVE_CONTENT"
  | "SPAM"
  | "FALSE_REPORT"
  | "NOT_MY_CONDUCT"
  | "CONTEXT_MISSING"
  | "NEW_EVIDENCE"
  | "WRONG_OUTCOME"
  | "AMOUNT_ERROR"
  | "PROCEDURAL_ERROR"
  | "OTHER";

export function eligibleAppeals(token: string): Promise<EligibleAppeals> {
  return api.post<EligibleAppeals>("/appeals/eligible", {}, token);
}

export function fileAppeal(
  payload: {
    subjectKind: AppealSubjectKind;
    subjectId: string;
    reason: AppealReason;
    note: string;
    photoUrls?: string[];
  },
  token: string,
): Promise<{id: string}> {
  return api.post<{id: string}>("/appeals", payload, token);
}
