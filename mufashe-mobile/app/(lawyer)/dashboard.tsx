import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, RefreshControl, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const joinUrl = (base: string, path: string) => `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

type StoredUser = { role?: string; name?: string };

type Appointment = {
  _id: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  startsAt: string;
  durationMin?: number;
  topic?: string;
  caseDescription?: string;
  user?: { _id: string; name?: string; email?: string | null; phone?: string | null };
};

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");

  const res = await fetch(joinUrl(BASE_URL, path), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

async function apiPatch(path: string, body?: any) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");

  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

export default function LawyerDashboard() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState("Lawyer");
  const [items, setItems] = useState<Appointment[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const protectAndLoad = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const rawUser = await AsyncStorage.getItem("user");
      const user: StoredUser | null = rawUser ? JSON.parse(rawUser) : null;

      const role = String(user?.role || "").toLowerCase();
      if (role !== "lawyer") {
        router.replace("/(user)/dashboard");
        return;
      }

      setName(user?.name || "Lawyer");

      const res = await apiGet("/appointments/my");
      const all: Appointment[] = res?.items || [];

      const sorted = [...all].sort((a, b) => (a.status === "PENDING" ? -1 : 1));
      setItems(sorted);
    } catch (e: any) {
      setErr(e?.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { protectAndLoad(); }, [protectAndLoad]));

  const onRefresh = useCallback(async () => {
    try { setRefreshing(true); await protectAndLoad(); } finally { setRefreshing(false); }
  }, [protectAndLoad]);

  const approve = useCallback((id: string) => {
    Alert.alert("Approve booking", "Approve this booking request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            await apiPatch(`/appointments/${id}/approve`, {});
            await protectAndLoad();
            Alert.alert("Approved ✅", "User will be notified.");
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed");
          }
        },
      },
    ]);
  }, [protectAndLoad]);

  const reject = useCallback((id: string) => {
    Alert.alert("Reject booking", "Reject this booking request?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await apiPatch(`/appointments/${id}/reject`, {});
            await protectAndLoad();
            Alert.alert("Rejected ❌", "User will be notified.");
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed");
          }
        },
      },
    ]);
  }, [protectAndLoad]);

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    router.replace("/(auth)/login");
  }, []);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>Lawyer Dashboard</Text>
            <Text style={styles.sub}>Hi, {name}</Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/(lawyer)/profile")} activeOpacity={0.9}>
              <Ionicons name="create-outline" size={18} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/(lawyer)/notifications")} activeOpacity={0.9}>
              <Ionicons name="notifications-outline" size={18} color={theme.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={logout} activeOpacity={0.9}>
              <Ionicons name="log-out-outline" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {err ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
            <Text style={styles.errorText}>{err}</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Booking requests</Text>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={18} color={theme.textSub} />
            <Text style={styles.muted}>No bookings yet.</Text>
          </View>
        ) : (
          items.map((a) => {
            const pending = a.status === "PENDING";
            return (
              <View key={a._id} style={styles.card}>
                <Text style={styles.cardTitle}>{a.user?.name || "User"}</Text>
                <Text style={styles.meta}>
                  {new Date(a.startsAt).toLocaleString()} • {a.durationMin || 30} min
                </Text>
                {a.topic ? <Text style={styles.topic}>Topic: {a.topic}</Text> : null}
                {a.caseDescription ? <Text style={styles.desc}>{a.caseDescription}</Text> : null}

                <View style={styles.chip}><Text style={styles.chipText}>{a.status}</Text></View>

                {pending ? (
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <TouchableOpacity style={styles.approveBtn} onPress={() => approve(a._id)} activeOpacity={0.9}>
                      <Text style={styles.btnText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => reject(a._id)} activeOpacity={0.9}>
                      <Text style={styles.btnText}>Reject</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: { flex: 1, backgroundColor: theme.bg },
    container: { padding: 16, paddingTop: 14 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    muted: { color: theme.textSub, fontWeight: "800" },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { fontSize: 16 * s, fontWeight: "900", color: theme.text },
    sub: { color: theme.textSub, fontWeight: "800", marginTop: 2 },

    iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: theme.border },

    section: { marginTop: 8, marginBottom: 10, fontWeight: "900", color: theme.text },

    errorCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 16, backgroundColor: `${theme.danger}10`, borderWidth: 1, borderColor: theme.danger },
    errorText: { flex: 1, color: theme.danger, fontWeight: "800" },

    card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12, marginBottom: 10 },
    cardTitle: { fontWeight: "900", color: theme.text, fontSize: 14 * s },
    meta: { marginTop: 4, color: theme.textSub, fontWeight: "800" },
    topic: { marginTop: 8, color: theme.text, fontWeight: "800" },
    desc: { marginTop: 6, color: theme.textSub, fontWeight: "700" },

    chip: { marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.muted },
    chipText: { fontWeight: "900", color: theme.text, fontSize: 10 * s },

    approveBtn: { flex: 1, backgroundColor: "#16A34A", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
    rejectBtn: { flex: 1, backgroundColor: "#DC2626", paddingVertical: 12, borderRadius: 12, alignItems: "center" },
    btnText: { color: "#fff", fontWeight: "900" },

    empty: { alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  };
}