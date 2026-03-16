// app/(lawyer)/dashboard.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

const joinUrl = (base: string, path: string) =>
  `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

const APPOINTMENT_ENDPOINTS = [
  "/appointments/my",
  "/appointments/mine",
  "/bookings/my",
  "/bookings/mine",
  "/appointments",
  "/bookings",
];

type StoredUser = {
  _id?: string;
  id?: string;
  role?: string;
  name?: string;
  email?: string;
};

type Appointment = {
  _id: string;
  status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "COMPLETED" | string;
  startsAt?: string;
  scheduledAt?: string;
  startAt?: string;
  date?: string;
  time?: string;
  durationMin?: number;
  duration?: number;
  topic?: string;
  reason?: string;
  caseDescription?: string;
  notes?: string;
  user?: {
    _id?: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
  };
  client?: {
    _id?: string;
    name?: string;
    email?: string | null;
    phone?: string | null;
  };
  createdAt?: string;
};

type FilterType = "ALL" | "PENDING" | "APPROVED" | "REJECTED" | "PAST";
const FILTERS: FilterType[] = ["ALL", "PENDING", "APPROVED", "REJECTED", "PAST"];

async function getToken() {
  const token =
    (await AsyncStorage.getItem("token")) ||
    (await AsyncStorage.getItem("@auth_token")) ||
    (await AsyncStorage.getItem("authToken"));

  return token;
}

async function getStoredUser() {
  const raw =
    (await AsyncStorage.getItem("user")) ||
    (await AsyncStorage.getItem("@user")) ||
    (await AsyncStorage.getItem("authUser"));

  if (!raw) return null;

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return null;
  }
}

async function apiGet(path: string) {
  const token = await getToken();
  if (!token) throw new Error("Missing token");

  const res = await fetch(joinUrl(BASE_URL, path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: "Invalid server response" };
  }

  if (!res.ok) {
    const error: any = new Error(data?.message || data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }

  return data;
}

async function apiPatch(path: string, body?: any) {
  const token = await getToken();
  if (!token) throw new Error("Missing token");

  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });

  const text = await res.text();
  let data: any = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: "Invalid server response" };
  }

  if (!res.ok) {
    const error: any = new Error(data?.message || data?.error || `Request failed (${res.status})`);
    error.status = res.status;
    throw error;
  }

  return data;
}

function extractAppointments(res: any): Appointment[] {
  const list =
    res?.items ||
    res?.data ||
    res?.appointments ||
    res?.bookings ||
    res?.results ||
    [];

  return Array.isArray(list) ? list : [];
}

function getUserName(a: Appointment) {
  return a.user?.name || a.client?.name || "User";
}

function getUserEmail(a: Appointment) {
  return a.user?.email || a.client?.email || "";
}

function getUserPhone(a: Appointment) {
  return a.user?.phone || a.client?.phone || "";
}

function getStatus(a: Appointment) {
  return String(a.status || "PENDING").toUpperCase();
}

function getWhen(a: Appointment) {
  const raw = a.startsAt || a.scheduledAt || a.startAt || a.date || "";
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }

  if (a.date && a.time) {
    const d2 = new Date(`${a.date} ${a.time}`);
    if (!Number.isNaN(d2.getTime())) return d2;
  }

  return null;
}

function getDuration(a: Appointment) {
  return a.durationMin || a.duration || 30;
}

function getTopic(a: Appointment) {
  return a.topic || a.reason || "";
}

function getDescription(a: Appointment) {
  return a.caseDescription || a.notes || "";
}

function formatDate(a: Appointment) {
  const d = getWhen(a);
  if (!d) return "Date not set";

  try {
    return d.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return d.toLocaleString();
  }
}

function sortAppointments(list: Appointment[]) {
  return [...list].sort((a, b) => {
    const sa = getStatus(a);
    const sb = getStatus(b);

    if (sa === "PENDING" && sb !== "PENDING") return -1;
    if (sb === "PENDING" && sa !== "PENDING") return 1;

    const da = getWhen(a)?.getTime() || 0;
    const db = getWhen(b)?.getTime() || 0;

    return db - da;
  });
}

function statusColors(status: string, theme: any) {
  const s = String(status).toUpperCase();

  if (s === "APPROVED") {
    return { bg: "#DCFCE7", border: "#86EFAC", text: "#166534" };
  }
  if (s === "PENDING") {
    return { bg: "#FEF3C7", border: "#FCD34D", text: "#92400E" };
  }
  if (s === "REJECTED") {
    return { bg: "#FEE2E2", border: "#FCA5A5", text: "#991B1B" };
  }
  if (s === "CANCELLED") {
    return { bg: "#F3F4F6", border: "#D1D5DB", text: "#374151" };
  }
  if (s === "COMPLETED") {
    return { bg: "#E0E7FF", border: "#A5B4FC", text: "#3730A3" };
  }

  return { bg: theme.muted, border: theme.border, text: theme.text };
}

export default function LawyerDashboard() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const [name, setName] = useState("Lawyer");
  const [items, setItems] = useState<Appointment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("ALL");

  const protectAndLoad = useCallback(async () => {
    try {
      setErr(null);
      setLoading(true);

      const user = await getStoredUser();
      const role = String(user?.role || "").toLowerCase();

      if (role && role !== "lawyer") {
        router.replace("/(user)/dashboard");
        return;
      }

      setName(user?.name || "Lawyer");

      let found: Appointment[] = [];
      let success = false;
      let lastError: any = null;

      for (const endpoint of APPOINTMENT_ENDPOINTS) {
        try {
          const res = await apiGet(endpoint);
          const all = extractAppointments(res);
          found = all;
          success = true;
          break;
        } catch (e: any) {
          lastError = e;

          if (e?.status === 401) {
            throw new Error("Your session expired. Please login again.");
          }

          continue;
        }
      }

      if (!success) {
        throw new Error(lastError?.message || "Failed to load appointments");
      }

      setItems(sortAppointments(found));
    } catch (e: any) {
      setErr(e?.message || "Failed to load appointments");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      protectAndLoad();
    }, [protectAndLoad])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await protectAndLoad();
    } finally {
      setRefreshing(false);
    }
  }, [protectAndLoad]);

  const updateAppointmentStatus = useCallback(
    async (id: string, action: "approve" | "reject") => {
      try {
        setWorkingId(id);

        const possiblePaths =
          action === "approve"
            ? [
                `/appointments/${id}/approve`,
                `/bookings/${id}/approve`,
                `/appointments/${id}`,
                `/bookings/${id}`,
              ]
            : [
                `/appointments/${id}/reject`,
                `/bookings/${id}/reject`,
                `/appointments/${id}`,
                `/bookings/${id}`,
              ];

        let success = false;
        let lastError: any = null;

        for (const path of possiblePaths) {
          try {
            if (path.endsWith(`/${id}`)) {
              await apiPatch(path, {
                status: action === "approve" ? "APPROVED" : "REJECTED",
              });
            } else {
              await apiPatch(path, {});
            }
            success = true;
            break;
          } catch (e: any) {
            lastError = e;
            continue;
          }
        }

        if (!success) {
          throw new Error(lastError?.message || `Failed to ${action} booking`);
        }

        await protectAndLoad();

        Alert.alert(
          action === "approve" ? "Booking approved" : "Booking rejected",
          action === "approve"
            ? "The booking request has been approved."
            : "The booking request has been rejected."
        );
      } catch (e: any) {
        Alert.alert("Error", e?.message || "Something went wrong");
      } finally {
        setWorkingId(null);
      }
    },
    [protectAndLoad]
  );

  const approve = useCallback(
    (id: string) => {
      Alert.alert("Approve booking", "Approve this booking request?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve",
          onPress: () => updateAppointmentStatus(id, "approve"),
        },
      ]);
    },
    [updateAppointmentStatus]
  );

  const reject = useCallback(
    (id: string) => {
      Alert.alert("Reject booking", "Reject this booking request?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: () => updateAppointmentStatus(id, "reject"),
        },
      ]);
    },
    [updateAppointmentStatus]
  );

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("@auth_token");
    await AsyncStorage.removeItem("authToken");
    await AsyncStorage.removeItem("user");
    await AsyncStorage.removeItem("@user");
    await AsyncStorage.removeItem("authUser");
    router.replace("/(auth)/login");
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === "ALL") return items;

    const now = new Date();

    if (filter === "PAST") {
      return items.filter((a) => {
        const when = getWhen(a);
        const status = getStatus(a);
        return status === "COMPLETED" || status === "CANCELLED" || (when ? when < now : false);
      });
    }

    return items.filter((a) => getStatus(a) === filter);
  }, [items, filter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((a) => getStatus(a) === "PENDING").length,
      approved: items.filter((a) => getStatus(a) === "APPROVED").length,
      rejected: items.filter((a) => getStatus(a) === "REJECTED").length,
    };
  }, [items]);

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" />
        <Text style={styles.muted}>Loading dashboard...</Text>
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
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={styles.title}>Lawyer Dashboard</Text>
            <Text style={styles.sub}>Hi, {name}</Text>
          </View>

          <View style={styles.topActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/(lawyer)/profile")}
              activeOpacity={0.9}
            >
              <Ionicons name="person-outline" size={18} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/(lawyer)/notifications")}
              activeOpacity={0.9}
            >
              <Ionicons name="notifications-outline" size={18} color={theme.text} />
            </TouchableOpacity>

            <TouchableOpacity style={styles.iconBtn} onPress={logout} activeOpacity={0.9}>
              <Ionicons name="log-out-outline" size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.approved}</Text>
            <Text style={styles.statLabel}>Approved</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.rejected}</Text>
            <Text style={styles.statLabel}>Rejected</Text>
          </View>
        </View>

        {err ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
            <Text style={styles.errorText}>{err}</Text>
          </View>
        ) : null}

        <Text style={styles.section}>Booking requests</Text>

        <View style={styles.filterRow}>
          {FILTERS.map((f) => {
            const active = filter === f;
            return (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setFilter(f)}
                activeOpacity={0.9}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredItems.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="calendar-outline" size={22} color={theme.blue} />
            </View>
            <Text style={styles.emptyTitle}>No bookings yet</Text>
            <Text style={styles.emptyText}>
              New appointment requests from users will appear here.
            </Text>
          </View>
        ) : (
          filteredItems.map((a) => {
            const pending = getStatus(a) === "PENDING";
            const colors = statusColors(getStatus(a), theme);
            const isWorking = workingId === a._id;

            return (
              <View key={a._id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={18} color="#fff" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{getUserName(a)}</Text>
                    <Text style={styles.meta}>
                      {formatDate(a)} • {getDuration(a)} min
                    </Text>
                    {!!getUserEmail(a) && <Text style={styles.contact}>{getUserEmail(a)}</Text>}
                    {!!getUserPhone(a) && <Text style={styles.contact}>{getUserPhone(a)}</Text>}
                  </View>

                  <View
                    style={[
                      styles.chip,
                      {
                        backgroundColor: colors.bg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: colors.text }]}>
                      {getStatus(a)}
                    </Text>
                  </View>
                </View>

                {!!getTopic(a) && (
                  <Text style={styles.topic}>Topic: {getTopic(a)}</Text>
                )}

                {!!getDescription(a) && (
                  <Text style={styles.desc}>{getDescription(a)}</Text>
                )}

                {pending ? (
                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.approveBtn, isWorking && styles.btnDisabled]}
                      onPress={() => approve(a._id)}
                      activeOpacity={0.9}
                      disabled={isWorking}
                    >
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Approve</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.rejectBtn, isWorking && styles.btnDisabled]}
                      onPress={() => reject(a._id)}
                      activeOpacity={0.9}
                      disabled={isWorking}
                    >
                      {isWorking ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnText}>Reject</Text>
                      )}
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
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
    },

    container: {
      padding: 16,
      paddingTop: 14,
      paddingBottom: 30,
    },

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 16,
    },

    muted: {
      color: theme.textSub,
      fontWeight: "800",
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    topActions: {
      flexDirection: "row",
      gap: 10,
    },

    title: {
      fontSize: 16 * s,
      fontWeight: "900",
      color: theme.text,
    },

    sub: {
      color: theme.textSub,
      fontWeight: "800",
      marginTop: 2,
    },

    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },

    statsRow: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },

    statCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },

    statValue: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 15 * s,
    },

    statLabel: {
      color: theme.textSub,
      fontWeight: "700",
      marginTop: 4,
      fontSize: 11 * s,
    },

    section: {
      marginTop: 2,
      marginBottom: 10,
      fontWeight: "900",
      color: theme.text,
      fontSize: 14 * s,
    },

    filterRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 12,
    },

    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
    },

    filterChipActive: {
      backgroundColor: theme.blue,
      borderColor: theme.blue,
    },

    filterChipText: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 11 * s,
    },

    filterChipTextActive: {
      color: "#fff",
    },

    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 16,
      backgroundColor: `${theme.danger}10`,
      borderWidth: 1,
      borderColor: theme.danger,
      marginBottom: 12,
    },

    errorText: {
      flex: 1,
      color: theme.danger,
      fontWeight: "800",
    },

    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
      marginBottom: 12,
    },

    cardHead: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 10,
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

    cardTitle: {
      fontWeight: "900",
      color: theme.text,
      fontSize: 14 * s,
    },

    meta: {
      marginTop: 4,
      color: theme.textSub,
      fontWeight: "800",
      lineHeight: 18,
    },

    contact: {
      marginTop: 3,
      color: theme.textSub,
      fontWeight: "700",
      lineHeight: 17,
    },

    topic: {
      marginTop: 10,
      color: theme.text,
      fontWeight: "800",
      lineHeight: 18,
    },

    desc: {
      marginTop: 6,
      color: theme.textSub,
      fontWeight: "700",
      lineHeight: 20,
    },

    chip: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },

    chipText: {
      fontWeight: "900",
      fontSize: 10 * s,
    },

    actionRow: {
      flexDirection: "row",
      gap: 10,
      marginTop: 14,
    },

    approveBtn: {
      flex: 1,
      backgroundColor: "#16A34A",
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 46,
    },

    rejectBtn: {
      flex: 1,
      backgroundColor: "#DC2626",
      paddingVertical: 12,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 46,
    },

    btnDisabled: {
      opacity: 0.7,
    },

    btnText: {
      color: "#fff",
      fontWeight: "900",
    },

    empty: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 34,
      paddingHorizontal: 18,
      gap: 10,
    },

    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.muted,
    },

    emptyTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 15 * s,
      textAlign: "center",
    },

    emptyText: {
      color: theme.textSub,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: 20,
    },
  };
}