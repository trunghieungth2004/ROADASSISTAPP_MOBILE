import {api} from "./client";

export type ReportTargetKind = "PROVIDER" | "RIDER";

export type ReportPayload = {
  targetKind: ReportTargetKind;
  targetId: string;
  ticketId?: string;
  reason: string;
  note?: string;
  photoUrls?: string[];
};

export type ReportRecord = {
  id: string;
  targetKind: ReportTargetKind;
  targetId: string;
  ticketId: string | null;
  reason: string;
  note: string | null;
  photoUrls: string[];
  status: string;
  action: string;
  actionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
};

export function fileReport(
  payload: ReportPayload,
  token: string,
): Promise<ReportRecord> {
  return api.post<ReportRecord>("/reports", payload, token);
}

export function myReports(token: string): Promise<{reports: ReportRecord[]}> {
  return api.post<{reports: ReportRecord[]}>("/reports/mine", {}, token);
}
