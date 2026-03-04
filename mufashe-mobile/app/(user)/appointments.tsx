// app/(user)/appointments.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const joinUrl = (base: string, path: string) =>
  `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

// 🔧 Change this to your real backend endpoint for "my bookings/appointments"
const APPOINTMENTS_ENDPOINT = "/appointments/mine"; // examples: "/appointments/mine" | "/appointments/my" | "/bookings/mine"

type AppointmentRow = {
  _id: string;

  // lawyer info (different backends name differently)
  lawyerId?: string;
  lawyer?: { _id?: string; name?: string };
  lawyerName?: string;

  // schedule info (different backends name differently)
  scheduledAt?: string;
  startAt?: string;
  date?: string;
  time?: string;

  status?: string; // PENDING/APPROVED/REJECTED/CANCELLED/COMPLETED...
  createdAt?: string;
};

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) {
    router.replace("/(auth)/login");
    throw new Error("Missing token");
  }

  const res = await fetch(joinUrl(BASE_URL, path), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
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

const FILTERS = ["ALL", "UPCOMING", "PAST"] as const;
type Filter = (typeof FILTERS)[number];

function pickLawyerName(a: AppointmentRow) {
  return a.lawyerName || a.lawyer?.name || "Lawyer";
}

function pickWhen(a: AppointmentRow) {
  const raw = a.scheduledAt || a.startAt || a.date || "";
  const dt = raw ? new Date(raw) : null;
  if (dt && !Number.isNaN(dt.getTime())) return dt;

  // fallback: if backend has date + time separated
  if (a.date && a.time) {
    const dt2 = new Date(`${a.date} ${a.time}`);
    if (!Number.isNaN(dt2.getTime())) return dt2;
  }
  return null;
}

function normStatus(s?: string) {
  return String(s || "PENDING").toUpperCase();
}

export default function AppointmentsScreen() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [items, setItems] = useState<AppointmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const res = await apiGet(APPOINTMENTS_ENDPOINT);
      const list: AppointmentRow[] = res?.items || res?.data || res?.appointments || res?.bookings || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setErr(e?.message || "Failed to load bookings");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return items;

    const now = new Date();
    return items.filter((a) => {
      const when = pickWhen(a);
      const st = normStatus(a.status);

      const definitelyPast = ["COMPLETED", "CANCELLED", "REJECTED"].includes(st);
      if (filter === "PAST") return definitelyPast || (when ? when < now : false);

      // UPCOMING:
      if (definitelyPast) return false;
      return when ? when >= now : true; // if unknown date, keep in upcoming
    });
  }, [items, filter]);

  const prettyWhen = (a: AppointmentRow) => {
    const when = pickWhen(a);
    if (!when) return "Date not set";
    return when.toLocaleString();
  };

  const openBooking = (a: AppointmentRow) => {
    // You don't have booking-details.tsx yet, so we show a simple alert for now
    Alert.alert("Booking", `${pickLawyerName(a)}\n${prettyWhen(a)}\nStatus: ${normStatus(a.status)}`);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>My bookings</Text>
        <TouchableOpacity onPress={load} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = f === filter;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, active && styles.filterChipActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.9}
            >
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading bookings...</Text>
        </View>
      ) : err ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={20} color={theme.danger} />
          <Text style={[styles.muted, { color: theme.danger }]}>{err}</Text>
          <Text style={styles.mutedSmall}>If you see “Not Found”, update APPOINTMENTS_ENDPOINT in this file.</Text>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(user)/lawyers")}
            activeOpacity={0.9}
          >
            <Text style={styles.primaryBtnText}>Find a lawyer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x) => x._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="calendar-outline" size={20} color={theme.textSub} />
              <Text style={styles.muted}>No bookings found.</Text>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push("/(user)/lawyers")}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryBtnText}>Book a lawyer</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => openBooking(item)}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={styles.avatar}>
                  <Ionicons name="person" size={18} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{pickLawyerName(item)}</Text>
                  <Text style={styles.meta}>{prettyWhen(item)}</Text>
                </View>
                <View style={styles.statusChip}>
                  <Text style={styles.statusChipText}>{normStatus(item.status)}</Text>
                </View>
              </View>
              <Text style={styles.viewMore}>Tap to view →</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 16 },
    muted: { color: theme.textSub, fontWeight: "800", textAlign: "center" },
    mutedSmall: { color: theme.textSub, fontWeight: "700", textAlign: "center" },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      padding: 16,
      paddingBottom: 8,
    },
    title: { fontSize: 16 * s, fontWeight: "900", color: theme.text },
    iconBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
    },

    filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
    filterChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: "center",
    },
    filterChipActive: { backgroundColor: theme.blue, borderColor: theme.blue },
    filterText: { fontWeight: "900", color: theme.text, fontSize: 11 * s },
    filterTextActive: { color: "#fff" },

    card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12 },
    avatar: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#0F3D63", alignItems: "center", justifyContent: "center" },
    name: { color: theme.text, fontWeight: "900", fontSize: 14 * s },
    meta: { color: theme.textSub, fontWeight: "800", marginTop: 4 },

    statusChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.muted },
    statusChipText: { fontSize: 10 * s, fontWeight: "900", color: theme.text },

    viewMore: { marginTop: 10, color: theme.blue, fontWeight: "900" },

    primaryBtn: { marginTop: 12, backgroundColor: theme.blue, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14 },
    primaryBtnText: { color: "#fff", fontWeight: "900" },
  };
}