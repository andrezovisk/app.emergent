import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export const API_BASE = process.env.EXPO_PUBLIC_BACKEND_URL || Constants.expoConfig?.extra?.backendUrl || "";

const KEY = "delivery.token";

async function getStore() {
  if (Platform.OS === "web") {
    return window.localStorage.getItem(KEY);
  }
  return SecureStore.getItemAsync(KEY);
}

async function setStore(v: string | null) {
  if (Platform.OS === "web") {
    if (v) window.localStorage.setItem(KEY, v);
    else window.localStorage.removeItem(KEY);
    return;
  }
  if (v) await SecureStore.setItemAsync(KEY, v);
  else await SecureStore.deleteItemAsync(KEY);
}

export async function getToken() {
  return getStore();
}
export async function setToken(v: string | null) {
  await setStore(v);
}

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(opts.headers || {});
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const url = `${API_BASE}/api${path}`;
  const res = await fetch(url, { ...opts, headers });
  const text = await res.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const err = new Error(data?.detail || `HTTP ${res.status}`);
    (err as any).status = res.status;
    throw err;
  }
  return data as T;
}
