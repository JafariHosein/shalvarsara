import { http } from "@/lib/api";
import type { AuthResponse, RegisterCodeResponse, User } from "@/types/api";

export interface RegisterPayload {
  name: string;
  email: string;
  phone: string;
  password: string;
  /** The code that was sent to `phone`. */
  code: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export const authService = {
  /** Ask for the sign-up verification code; the API sends (or returns) it. */
  requestRegisterCode: (payload: { phone: string }) =>
    http.post<RegisterCodeResponse>("/auth/register/code", payload),

  register: (payload: RegisterPayload) =>
    http.post<AuthResponse>("/auth/register", payload),

  login: (payload: LoginPayload) =>
    http.post<AuthResponse>("/auth/login", payload),

  logout: () => http.post<void>("/auth/logout", undefined, { auth: true }),

  me: (signal?: AbortSignal) => http.get<User>("/auth/me", { auth: true, signal }),

  updateProfile: (payload: { name: string; phone?: string }) =>
    http.patch<User>("/users/me", payload, { auth: true }),

  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    http.patch<void>("/auth/password", payload, { auth: true }),
};
