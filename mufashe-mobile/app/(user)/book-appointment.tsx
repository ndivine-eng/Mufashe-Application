// app/(user)/book-appointment.tsx
import React, { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const joinUrl = (base: string, path: string) =>
  `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

async function apiPost(path: string, body: any) {
  const token = await AsyncStorage.getItem("token");
  if (!token) {
    // force login
    router.replace("/(auth)/login");
    throw new Error("Missing token");
  }

  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

export default function BookAppointment() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const params = useLocalSearchParams<{ lawyerId?: string | string[] }>();
  const resolvedLawyerId = useMemo(() => {
    const raw = params?.lawyerId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.lawyerId]);

  const [date, setDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState(false);

  const [durationMin, setDurationMin] = useState("30");
  const [topic, setTopic] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => !!resolvedLawyerId && caseDescription.trim().length >= 10 && !loading,
    [resolvedLawyerId, caseDescription, loading]
  );

  const onSubmit = useCallback(async () => {
    if (!canSubmit) return;

    // ✅ prevent past time (allow 5 min buffer)
    if (date.getTime() < Date.now() + 5 * 60 * 1000) {
      Alert.alert("Invalid time", "Please choose a future date/time.");
      return;
    }

    try {
      setLoading(true);

      await apiPost("/appointments", {
        lawyerId: resolvedLawyerId,
        startsAt: date.toISOString(),
        durationMin: Math.max(15, Number(durationMin) || 30), // min 15 minutes
        topic: topic.trim(),
        caseDescription: caseDescription.trim(),
      });

      Alert.alert("Request sent ✅", "Your booking request is pending lawyer approval.");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to create appointment");
    } finally {
      setLoading(false);
    }
  }, [canSubmit, resolvedLawyerId, date, durationMin, topic, caseDescription]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Booking</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          {!resolvedLawyerId ? (
            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
              <Text style={styles.warnText}>Missing lawyerId. Go back and select a lawyer again.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>DATE & TIME</Text>
          <TouchableOpacity style={styles.pickerBtn} onPress={() => setShowPicker(true)} activeOpacity={0.9}>
            <Ionicons name="calendar-outline" size={18} color={theme.text} />
            <Text style={styles.pickerText}>{date.toLocaleString()}</Text>
          </TouchableOpacity>

          {showPicker ? (
            <DateTimePicker
              value={date}
              mode="datetime"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                setShowPicker(false);
                if (selected) setDate(selected);
              }}
            />
          ) : null}

          <Text style={styles.label}>DURATION (minutes)</Text>
          <TextInput
            style={styles.input}
            value={durationMin}
            onChangeText={setDurationMin}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor={theme.textSub}
          />

          <Text style={styles.label}>CASE TITLE (optional)</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Land dispute..."
            placeholderTextColor={theme.textSub}
          />

          <Text style={styles.label}>CASE DESCRIPTION</Text>
          <TextInput
            style={[styles.input, { height: 120, textAlignVertical: "top" }]}
            value={caseDescription}
            onChangeText={setCaseDescription}
            placeholder="Explain your case clearly..."
            placeholderTextColor={theme.textSub}
            multiline
          />

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Submit request</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
    title: { fontSize: 16 * s, fontWeight: "900", color: theme.text },
    iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" },

    card: { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14, gap: 10 },
    label: { fontSize: 11 * s, color: theme.textSub, fontWeight: "900", marginTop: 6 },

    pickerBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, backgroundColor: theme.card },
    pickerText: { color: theme.text, fontWeight: "800" },

    input: { borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 12, backgroundColor: theme.card, color: theme.text, fontWeight: "700" },

    primaryBtn: { marginTop: 8, backgroundColor: theme.blue, paddingVertical: 14, borderRadius: 14, alignItems: "center" },
    primaryText: { color: "#fff", fontWeight: "900", fontSize: 14 * s },

    warnBox: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: theme.danger, backgroundColor: `${theme.danger}10` },
    warnText: { flex: 1, color: theme.danger, fontWeight: "800" },
  };
}