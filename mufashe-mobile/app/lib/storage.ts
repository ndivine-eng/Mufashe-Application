// app/lib/storage.ts
// this file contains the logic to persist the auth token and user in AsyncStorage. It also contains the logic to clear the auth data when the user logs out. The auth data includes the token and the user object.
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthUser } from "./auth";

export async function saveAuth(token: string, user: AuthUser) {
  await AsyncStorage.setItem("token", token);
  await AsyncStorage.setItem("user", JSON.stringify(user));
}

export async function getToken() {
  return AsyncStorage.getItem("token");
}

export async function getUser() {
  const raw = await AsyncStorage.getItem("user");
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export async function clearAuth() {
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("user");
}
