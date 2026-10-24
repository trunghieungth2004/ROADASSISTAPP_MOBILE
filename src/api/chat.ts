import {api} from "./client";

export type ChatScope = "TICKET" | "HAZARD";

export type ChatMessage = {
  id: string;
  senderUid: string;
  senderName: string | null;
  text: string | null;
  photoUrls: string[];
  createdAt: string;
};

export type ChatRoom = {
  id: string;
  scope: ChatScope;
  refId: string;
  participantUids: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  closedAt: string | null;
};

export function openChat(scope: ChatScope, refId: string, token: string): Promise<ChatRoom> {
  return api.post<ChatRoom>("/chat/open", {scope, refId}, token);
}

export function chatMessages(scope: ChatScope, refId: string, token: string): Promise<ChatMessage[]> {
  return api.post<ChatMessage[]>("/chat/messages", {scope, refId}, token);
}

export function sendChatMessage(scope: ChatScope, refId: string, payload: {text?: string; photoUrls?: string[]}, token: string): Promise<ChatMessage> {
  return api.post<ChatMessage>("/chat/send", {scope, refId, ...payload}, token);
}