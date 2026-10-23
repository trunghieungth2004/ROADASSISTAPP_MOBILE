import {api} from "./client";

export type NotificationPrefs = {
  paymentUpdates: boolean;
  payoutUpdates: boolean;
};

export async function getNotificationPrefs(token: string): Promise<NotificationPrefs> {
  return api.post<NotificationPrefs>("/notifications/prefs", {}, token);
}

export async function updateNotificationPrefs(token: string, patch: Partial<NotificationPrefs>): Promise<NotificationPrefs> {
  return api.put<NotificationPrefs>("/notifications/prefs", patch, token);
}
