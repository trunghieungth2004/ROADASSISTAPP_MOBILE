import {config} from "../config";

export const API_URL = config.apiBaseUrl;

export type ApiEnvelope<T> = {
  statusCode: number;
  status: string;
  message?: string;
  data: T;
  errors?: unknown;
};

export class ApiError extends Error {
  statusCode: number;
  errors?: unknown;
  constructor(message: string, statusCode: number, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

export function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}

async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = (await res.json()) as ApiEnvelope<T> & {message?: string};
  if (!res.ok || body.status === "ERROR") {
    throw new ApiError(body.message ?? `Request failed (${res.status})`, body.statusCode ?? res.status, body.errors);
  }
  return body.data;
}

export const api = {
  get<T>(path: string, token?: string): Promise<T> {
    return request<T>(path, {method: "GET"}, token);
  },
  post<T>(path: string, payload: unknown, token?: string): Promise<T> {
    return request<T>(path, {method: "POST", body: JSON.stringify(payload ?? {})}, token);
  },
  put<T>(path: string, payload: unknown, token?: string): Promise<T> {
    return request<T>(path, {method: "PUT", body: JSON.stringify(payload ?? {})}, token);
  },
};
