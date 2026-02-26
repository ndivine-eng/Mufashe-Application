import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./api";

export type AuthUser = {
  id: string;
  name: string;
  emailOrPhone: string;
};

type AuthResponse = {
  ok: boolean;
  message: string;
  user: AuthUser;
  token: string;
};

function splitEmailPhone(value: string) {
  const v = value.trim();
  const isEmail = /\S+@\S+\.\S+/.test(v);
  return {
    emailOrPhone: v,
    email: isEmail ? v.toLowerCase() : undefined,
    phone: !isEmail ? v : undefined,
  };
}

async function saveSession(data: AuthResponse) {
  await AsyncStorage.setItem("token", data.token);
  await AsyncStorage.setItem("user", JSON.stringify(data.user));
  api.defaults.headers.common.Authorization = `Bearer ${data.token}`;
}

export async function loginUser(payload: { emailOrPhone: string; password: string }) {
  const split = splitEmailPhone(payload.emailOrPhone);

  // Send BOTH styles so backend accepts whichever it expects
  const res = await api.post("/auth/login", {
    password: payload.password,
    emailOrPhone: split.emailOrPhone,
    identifier: split.emailOrPhone, // some backends use "identifier"
    email: split.email,
    phone: split.phone,
  });

  const data = res.data as AuthResponse;

  if (data?.token && data?.user) {
    await saveSession(data);
  }

  return data;
}

export async function registerUser(payload: {
  name: string;
  emailOrPhone: string;
  password: string;
}) {
  const split = splitEmailPhone(payload.emailOrPhone);

  // Send BOTH styles so backend accepts whichever it expects
  const res = await api.post("/auth/register", {
    name: payload.name,
    password: payload.password,
    emailOrPhone: split.emailOrPhone,
    email: split.email,
    phone: split.phone,
  });

  const data = res.data as AuthResponse;

  if (data?.token && data?.user) {
    await saveSession(data);
  }

  return data;
}

export async function getStoredUser(): Promise<AuthUser | null> {
  const raw = await AsyncStorage.getItem("user");
  return raw ? (JSON.parse(raw) as AuthUser) : null;
}

export async function logoutUser() {
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("user");
  delete api.defaults.headers.common.Authorization;
}
