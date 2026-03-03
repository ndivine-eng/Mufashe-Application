import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const joinUrl = (base: string, path: string) => `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");
  const res = await fetch(joinUrl(BASE_URL, path), { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

async function apiPatch(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");
  const res = await fetch(joinUrl(BASE_URL, path), { method: "PATCH", headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

type Notif = {
  _id: string;
  title: string;
  body?: string;
  type: string;
  readAt?: string | null;
  createdAt?: string;
};

export default function Notifications() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet("/notifications/my");
      setItems(res?.items || []);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRefresh = useCallback(async () => {
    try { setRefreshing(true); await load(); } finally { setRefreshing(false); }
  }, [load]);

  const markRead = useCallback(async (id: string) => {
    try { await apiPatch(`/notifications/${id}/read`); await load(); } catch {}
  }, [load]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading...</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => x._id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          renderItem={({ item }) => {
            const unread = !item.readAt;
            return (
              <TouchableOpacity style={[styles.card, unread && styles.unread]} activeOpacity={0.9} onPress={() => markRead(item._id)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Ionicons name="notifications-outline" size={18} color={theme.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    {item.body ? <Text style={styles.cardBody}>{item.body}</Text> : null}
                  </View>
                  {unread ? <View style={styles.dot} /> : null}
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<View style={styles.center}><Text style={styles.muted}>No notifications.</Text></View>}
        />
      )}
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: { flex: 1, backgroundColor: theme.bg },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    muted: { color: theme.textSub, fontWeight: "800" },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, paddingBottom: 8 },
    title: { fontSize: 16 * s, fontWeight: "900", color: theme.text },
    iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" },

    card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12 },
    unread: { borderColor: theme.blue },
    cardTitle: { fontWeight: "900", color: theme.text },
    cardBody: { marginTop: 4, color: theme.textSub, fontWeight: "700" },
    dot: { width: 10, height: 10, borderRadius: 99, backgroundColor: theme.blue },
  };
}