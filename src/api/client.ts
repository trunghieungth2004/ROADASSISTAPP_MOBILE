import {config} from "../config";

export const API_URL = config.apiBaseUrl;
let tokenRefresher: (() => Promise<string | null>) | null = null;
let unauthorizedHandler: (() => void) | null = null;

export function setTokenRefresher(fn: (() => Promise<string | null>) | null): void {
  tokenRefresher = fn;
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

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
  let res = await send(path, init, token);
  if (res.status === 401 && tokenRefresher) {
    const fresh = await tokenRefresher().catch(() => null);
    if (fresh) res = await send(path, init, fresh);
  }
  const body = (await res.json()) as ApiEnvelope<T> & {message?: string};
  if (!res.ok || body.status === "ERROR") {
    const statusCode = body.statusCode ?? res.status;
    if (res.status === 401 || statusCode === 401 || (statusCode === 403 && body.message === "User is inactive")) {
      unauthorizedHandler?.();
    }
    throw new ApiError(body.message ?? `Request failed (${res.status})`, statusCode, body.errors);
  }
  return body.data;
}

function send(path: string, init: RequestInit, token?: string): Promise<Response> {
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? {Authorization: `Bearer ${token}`} : {}),
      ...(init.headers ?? {}),
    },
  });
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
