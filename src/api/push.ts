import {api} from "./client";

export function registerPush(token: string, deviceToken: string): Promise<{userId: string; tokens: string[]; updatedAt: string}> {
  return api.post<{userId: string; tokens: string[]; updatedAt: string}>("/push/register", {token: deviceToken}, token);
}

export function unregisterPush(token: string, deviceToken: string): Promise<{removed: boolean}> {
  return api.post<{removed: boolean}>("/push/unregister", {token: deviceToken}, token);
}

export function pingPush(token: string): Promise<{tokens: number; sent: number; failed: number; firstError: string | null}> {
  return api.post<{tokens: number; sent: number; failed: number; firstError: string | null}>("/push/ping", {}, token);
}
