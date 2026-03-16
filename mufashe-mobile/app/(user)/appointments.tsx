// app/(user)/appointments.tsx
// This file implements the Appointments screen of the Mufashe mobile app, where users can view their booked appointments with lawyers. It fetches the user's appointments from the backend API, displays them in a list, and allows users to filter by upcoming or past appointments. Users can tap on an appointment to view its details in an alert dialog. The screen also handles loading states, error states, and provides options to refresh the list or book a new appointment if there are no existing bookings.
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

const APPOINTMENT_ENDPOINTS = [
  "/appointments/mine",
  "/appointments/my",
  "/bookings/mine",
  "/bookings/my",
  "/appointments",
  "/bookings",
];

type AppointmentRow = {
  _id: string;
  lawyerId?: string;
  lawyer?: {
    _id?: string;
    name?: string;
    email?: string;
    phone?: string;
    specialization?: string;
  };
  lawyerName?: string;
  startsAt?: string;
  scheduledAt?: string;
  startAt?: string;
  endAt?: string;
  date?: string;
  time?: string;
  reason?: string;
  notes?: string;
  topic?: string;
  caseDescription?: string;
  durationMin?: number;
  duration?: number;
  status?: string;
  createdAt?: string;
};

async function getToken() {
  const token =
    (await AsyncStorage.getItem("token")) ||
    (await AsyncStorage.getItem("@auth_token")) ||
    (await AsyncStorage.getItem("authToken"));

  return token;
}

async function apiGet(path: string) {
  const token = await getToken();

  if (!token) {
    router.replace("/(auth)/login");
    throw new Error("Please login first.");
  }

  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  const rawText = await res.text();

  let data: any = {};
  try {
    data = rawText ? JSON.parse(rawText) : {};
  } catch {
    data = { message: "Invalid server response" };
  }

  if (!res.ok) {
    const message = data?.message || data?.error || `Request failed (${res.status})`;
    const error: any = new Error(message);
    error.status = res.status;
    throw error;
  }

  return data;
}

function extractList(res: any): AppointmentRow[] {
  const list =
    res?.items ||
    res?.data ||
    res?.appointments ||
    res?.bookings ||
    res?.results ||
    [];

  return Array.isArray(list) ? list : [];
}

function pickLawyerName(a: AppointmentRow) {
  return a.lawyerName || a.lawyer?.name || "Lawyer";
}

function pickWhen(a: AppointmentRow) {
  const raw = a.startsAt || a.scheduledAt || a.startAt || a.date || "";

  if (raw) {
    const dt = new Date(raw);
    if (!Number.isNaN(dt.getTime())) return dt;
  }

  if (a.date && a.time) {
    const dt2 = new Date(`${a.date} ${a.time}`);
    if (!Number.isNaN(dt2.getTime())) return dt2;
  }

  return null;
}

function pickDuration(a: AppointmentRow) {
  return a.durationMin || a.duration || 30;
}

function normStatus(s?: string) {
  return String(s || "PENDING").toUpperCase();
}

function formatStatus(status?: string) {
  const s = normStatus(status);
  if (s === "APPROVED") return "Approved";
  if (s === "REJECTED") return "Rejected";
  if (s === "CANCELLED") return "Cancelled";
  if (s === "COMPLETED") return "Completed";
  if (s === "CONFIRMED") return "Confirmed";
  if (s === "PENDING") return "Pending";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function formatWhen(a: AppointmentRow) {
  const when = pickWhen(a);
  if (!when) return "Date not set";

  try {
    return when.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return when.toLocaleString();
  }
}

function statusColors(status: string, theme: any) {
  const s = normStatus(status);

  if (s === "APPROVED" || s === "CONFIRMED") {
    return {
      bg: "#DCFCE7",
      border: "#86EFAC",
      text: "#166534",
    };
  }

  if (s === "PENDING") {
    return {
      bg: "#FEF3C7",
      border: "#FCD34D",
      text: "#92400E",
    };
  }

  if (s === "REJECTED" || s === "CANCELLED") {
    return {
      bg: "#FEE2E2",
      border: "#FCA5A5",
      text: "#991B1B",
    };
  }

  if (s === "COMPLETED") {
    return {
      bg: "#E0E7FF",
      border: "#A5B4FC",
      text: "#3730A3",
    };
  }

  return {
    bg: theme.muted,
    border: theme.border,
    text: theme.text,
  };
}

const FILTERS = ["ALL", "UPCOMING", "PAST"] as const;
type Filter = (typeof FILTERS)[number];

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

      let found: AppointmentRow[] = [];
      let success = false;
      let lastError: any = null;

      for (const endpoint of APPOINTMENT_ENDPOINTS) {
        try {
          const res = await apiGet(endpoint);
          const list = extractList(res);

          found = list;
          success = true;
          break;
        } catch (e: any) {
          lastError = e;

          if (e?.status === 401) {
            throw new Error("Your session expired. Please login again.");
          }

          if (e?.status === 403) {
            throw new Error("You are not allowed to view bookings.");
          }

          continue;
        }
      }

      if (!success) {
        throw new Error(lastError?.message || "Failed to load bookings.");
      }

      setItems(found);
    } catch (e: any) {
      setErr(e?.message || "Failed to load bookings.");
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

      if (filter === "PAST") {
        return definitelyPast || (when ? when < now : false);
      }

      if (definitelyPast) return false;
      return when ? when >= now : true;
    });
  }, [items, filter]);

  const openBooking = useCallback((a: AppointmentRow) => {
    const lawyer = pickLawyerName(a);
    const when = formatWhen(a);
    const status = formatStatus(a.status);
    const details =
      a.reason || a.notes || a.topic || a.caseDescription || "No details provided";
    const duration = pickDuration(a);

    Alert.alert(
      "Booking details",
      `Lawyer: ${lawyer}\nBooked time: ${when}\nDuration: ${duration} min\nStatus: ${status}\nDetails: ${details}`
    );
  }, []);

  const renderEmptyText = useMemo(() => {
    if (filter === "UPCOMING") return "No upcoming bookings yet.";
    if (filter === "PAST") return "No past bookings yet.";
    return "You have no bookings yet.";
  }, [filter]);

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
          <Ionicons name="cloud-offline-outline" size={28} color={theme.textSub} />
          <Text style={styles.emptyTitle}>Could not load bookings</Text>
          <Text style={styles.muted}>{err}</Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={load} activeOpacity={0.9}>
            <Text style={styles.primaryBtnText}>Try again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => router.push("/(user)/lawyers")}
            activeOpacity={0.9}
          >
            <Text style={styles.secondaryBtnText}>Find a lawyer</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(x, index) => x._id || String(index)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="calendar-outline" size={24} color={theme.blue} />
              </View>
              <Text style={styles.emptyTitle}>{renderEmptyText}</Text>
              <Text style={styles.muted}>
                When you book a lawyer, your appointments will appear here.
              </Text>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push("/(user)/lawyers")}
                activeOpacity={0.9}
              >
                <Text style={styles.primaryBtnText}>Book a lawyer</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => {
            const colors = statusColors(item.status || "PENDING", theme);

            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => openBooking(item)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={18} color="#fff" />
                  </View>

                  <View style={styles.cardMain}>
                    <Text style={styles.name}>{pickLawyerName(item)}</Text>
                    <Text style={styles.meta}>Booked time: {formatWhen(item)}</Text>
                    <Text style={styles.meta}>Duration: {pickDuration(item)} min</Text>

                    {!!(item.reason || item.notes || item.topic || item.caseDescription) && (
                      <Text style={styles.reason} numberOfLines={2}>
                        {item.reason || item.notes || item.topic || item.caseDescription}
                      </Text>
                    )}
                  </View>

                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.statusChipText, { color: colors.text }]}>
                      {formatStatus(item.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBottom}>
                  <Text style={styles.viewMore}>Tap to view details</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.blue} />
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      padding: 20,
    },

    muted: {
      color: theme.textSub,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 20,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },

    title: {
      fontSize: 16 * s,
      fontWeight: "900",
      color: theme.text,
    },

    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
    },

    filterRow: {
      flexDirection: "row",
      gap: 8,
      paddingHorizontal: 16,
      paddingTop: 6,
      paddingBottom: 10,
    },

    filterChip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      alignItems: "center",
    },

    filterChipActive: {
      backgroundColor: theme.blue,
      borderColor: theme.blue,
    },

    filterText: {
      fontWeight: "900",
      color: theme.text,
      fontSize: 11 * s,
    },

    filterTextActive: {
      color: "#fff",
    },

    listContent: {
      padding: 16,
      gap: 12,
      paddingBottom: 100,
    },

    listContentEmpty: {
      flexGrow: 1,
    },

    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },

    emptyTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 16 * s,
      textAlign: "center",
    },

    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
    },

    cardTop: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
    },

    cardMain: {
      flex: 1,
    },

    avatar: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: "#0F3D63",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 2,
    },

    name: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 14 * s,
    },

    meta: {
      color: theme.textSub,
      fontWeight: "800",
      marginTop: 4,
      lineHeight: 18,
    },

    reason: {
      marginTop: 6,
      color: theme.textSub,
      fontWeight: "600",
      lineHeight: 18,
    },

    statusChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      alignSelf: "flex-start",
    },

    statusChipText: {
      fontSize: 10 * s,
      fontWeight: "900",
    },

    cardBottom: {
      marginTop: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    viewMore: {
      color: theme.blue,
      fontWeight: "900",
    },

    primaryBtn: {
      marginTop: 12,
      backgroundColor: theme.blue,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      minWidth: 150,
      alignItems: "center",
    },

    primaryBtnText: {
      color: "#fff",
      fontWeight: "900",
    },

    secondaryBtn: {
      marginTop: 2,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      minWidth: 150,
      alignItems: "center",
    },

    secondaryBtnText: {
      color: theme.text,
      fontWeight: "900",
    },
  };
}