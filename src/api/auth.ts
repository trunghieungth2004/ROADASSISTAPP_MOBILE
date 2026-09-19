import {api} from "./client";

export type RegisterPayload = {
  email: string;
  password: string;
  displayName?: string;
  phone: string;
};

export type RegisterResult = {
  uid: string;
};

export function register(payload: RegisterPayload): Promise<RegisterResult> {
  return api.post<RegisterResult>("/users/register", payload);
}
