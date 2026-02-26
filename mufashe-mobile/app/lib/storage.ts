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
