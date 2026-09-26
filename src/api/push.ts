import {api} from "./client";

export function registerPush(token: string, deviceToken: string, platform = "android"): Promise<{userId: string; tokens: string[]; updatedAt: string}> {
  return api.post<{userId: string; tokens: string[]; updatedAt: string}>("/push/register", {token: deviceToken, platform}, token);
}

export function unregisterPush(token: string, deviceToken: string): Promise<{removed: boolean}> {
  return api.post<{removed: boolean}>("/push/unregister", {token: deviceToken}, token);
}
