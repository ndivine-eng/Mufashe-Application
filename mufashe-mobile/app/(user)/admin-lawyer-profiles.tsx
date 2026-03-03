import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, RefreshControl } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const joinUrl = (base: string, path: string) =>
  `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

type LawyerRow = {
  _id: string;
  name?: string;
  email?: string;
  specialization?: string;
  location?: string;
  bio?: string;
  lawyerStatus?: string;
  feeMin?: number;
  feeMax?: number;
  feeNegotiable?: boolean;
  profileReviewStatus?: "PENDING" | "APPROVED" | "REJECTED";
};

async function apiReq(method: "GET" | "PATCH", path: string, body?: any) {
  const token = await AsyncStorage.getItem("token");
  if (!token) {
    router.replace("/(auth)/login");
    throw new Error("Missing token");
  }
  const res = await fetch(joinUrl(BASE_URL, path), {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(method === "PATCH" ? { "Content-Type": "application/json" } : {}),
    },
    ...(method === "PATCH" ? { body: JSON.stringify(body || {}) } : {}),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) throw new Error(data?.message || `Request failed (${res.status})`);
  return data;
}

export default function AdminLawyerProfiles() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [items, setItems] = useState<LawyerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiReq("GET", "/admin/lawyer-profiles?status=PENDING");
      setItems(res?.items || []);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load pending profiles");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const approve = useCallback(async (id: string) => {
    try {
      await apiReq("PATCH", `/admin/lawyer-profiles/${id}`, { status: "APPROVED", note: "Approved" });
      Alert.alert("Approved ✅", "Lawyer profile is now visible to users.");
      await load();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to approve");
    }
  }, [load]);

  const reject = useCallback(async (id: string) => {
    Alert.alert("Reject profile", "Reject this profile?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: async () => {
          try {
            await apiReq("PATCH", `/admin/lawyer-profiles/${id}`, { status: "REJECTED", note: "Please improve your profile info." });
            Alert.alert("Rejected ✅", "Profile rejected.");
            await load();
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to reject");
          }
        },
      },
    ]);
  }, [load]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading pending profiles…</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Pending Lawyer Profiles</Text>
        <TouchableOpacity onPress={load} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {items.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="checkmark-circle-outline" size={20} color={theme.textSub} />
            <Text style={styles.emptyTitle}>No pending profiles</Text>
            <Text style={styles.emptyText}>When lawyers update their profile, they appear here.</Text>
          </View>
        ) : (
          items.map((it) => (
            <View key={it._id} style={styles.card}>
              <Text style={styles.name}>{it.name || "Lawyer"}</Text>
              <Text style={styles.meta}>{it.email || "—"}</Text>
              <Text style={styles.meta}>
                {(it.specialization || "—")} {it.location ? `• ${it.location}` : ""}
              </Text>
              {it.bio ? <Text style={styles.bio} numberOfLines={3}>{it.bio}</Text> : null}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#16A34A" }]} onPress={() => approve(it._id)} activeOpacity={0.9}>
                  <Text style={styles.btnText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#DC2626" }]} onPress={() => reject(it._id)} activeOpacity={0.9}>
                  <Text style={styles.btnText}>Reject</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    muted: { color: theme.textSub, fontWeight: "800" },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
    title: { color: theme.text, fontWeight: "900", fontSize: 14 * s },

    iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" },

    card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12 },
    name: { color: theme.text, fontWeight: "900", fontSize: 14 * s },
    meta: { color: theme.textSub, fontWeight: "800", marginTop: 4 },
    bio: { color: theme.textSub, fontWeight: "700", marginTop: 10 },

    btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
    btnText: { color: "#fff", fontWeight: "900" },

    emptyCard: { alignItems: "center", gap: 8, padding: 18, borderRadius: 16, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.card },
    emptyTitle: { color: theme.text, fontWeight: "900" },
    emptyText: { color: theme.textSub, fontWeight: "700", textAlign: "center" },
  };
}