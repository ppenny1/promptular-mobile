// API client. Dev hits the local Next server (Android emulator's localhost
// is the emulator itself; the Mac is 10.0.2.2 per the standard). Production
// ALWAYS uses www.promptular.app (apex 307s break POST bodies).

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const DEV_BASE =
  Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";
export const API_BASE = __DEV__ ? DEV_BASE : "https://www.promptular.app";

const TOKEN_KEY = "promptular_token";

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Nothing to clear.
  }
}

export class ApiError extends Error {
  status: number;
  body: Record<string, unknown>;
  constructor(status: number, body: Record<string, unknown>) {
    super(typeof body.error === "string" ? body.error : `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

// Authenticated JSON call. Throws ApiError on non-2xx.
export async function api<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {}
): Promise<T> {
  const { method = "GET", body, auth = true } = options;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, json);
  return json as T;
}
