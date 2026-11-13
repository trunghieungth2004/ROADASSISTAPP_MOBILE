import {api} from "./client";

export type ChatScope = "TICKET" | "HAZARD";

export type ChatMessage = {
  id: string;
  senderUid: string;
  senderName: string | null;
  text: string | null;
  photoUrls: string[];
  kind?: string;
  event?: string;
  params?: Record<string, string | number>;
  createdAt: string;
};

export type ChatRoom = {
  id: string;
  scope: ChatScope;
  refId: string;
  version?: number;
  participantUids: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  closedAt: string | null;
};

export function openChat(scope: ChatScope, refId: string, token: string, version?: number): Promise<ChatRoom> {
  return api.post<ChatRoom>("/chat/open", {scope, refId, ...(version !== undefined ? {version} : {})}, token);
}

export function chatMessages(scope: ChatScope, refId: string, token: string, version?: number): Promise<ChatMessage[]> {
  return api.post<ChatMessage[]>("/chat/messages", {scope, refId, ...(version !== undefined ? {version} : {})}, token);
}

export function sendChatMessage(scope: ChatScope, refId: string, payload: {text?: string; photoUrls?: string[]}, token: string, version?: number): Promise<ChatMessage> {
  return api.post<ChatMessage>("/chat/send", {scope, refId, ...(version !== undefined ? {version} : {}), ...payload}, token);
}
