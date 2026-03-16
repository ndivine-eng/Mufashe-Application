// app/(user)/book-appointment.tsx
// This file implements the Book Appointment screen of the Mufashe mobile app, allowing users to schedule a consultation with a lawyer. It includes form fields for selecting a date and time, specifying the duration of the appointment, providing a case title and description, and submitting the booking request to the backend API. The screen also handles loading states, input validation, and displays a summary of the booking details before submission.  
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";

const joinUrl = (base: string, path: string) =>
  `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

const CREATE_APPOINTMENT_ENDPOINTS = [
  "/appointments",
  "/bookings",
];

async function getToken() {
  const token =
    (await AsyncStorage.getItem("token")) ||
    (await AsyncStorage.getItem("@auth_token")) ||
    (await AsyncStorage.getItem("authToken"));

  return token;
}

async function apiPost(path: string, body: any) {
  const token = await getToken();

  if (!token) {
    router.replace("/(auth)/login");
    throw new Error("Please login first.");
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
    data = { message: "Invalid server response" };
  }

  if (!res.ok) {
    const error: any = new Error(
      data?.message || data?.error || `Request failed (${res.status})`
    );
    error.status = res.status;
    throw error;
  }

  return data;
}

function clampDuration(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 30;
  return Math.max(15, Math.min(180, Math.round(n)));
}

function formatDateTime(date: Date) {
  try {
    return date.toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return date.toLocaleString();
  }
}

export default function BookAppointment() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const params = useLocalSearchParams<{
    lawyerId?: string | string[];
    lawyerName?: string | string[];
  }>();

  const resolvedLawyerId = useMemo(() => {
    const raw = params?.lawyerId;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.lawyerId]);

  const resolvedLawyerName = useMemo(() => {
    const raw = params?.lawyerName;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [params?.lawyerName]);

  const [date, setDate] = useState(new Date(Date.now() + 60 * 60 * 1000));
  const [showPicker, setShowPicker] = useState(false);

  const [durationMin, setDurationMin] = useState("30");
  const [topic, setTopic] = useState("");
  const [caseDescription, setCaseDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedDuration = useMemo(() => clampDuration(durationMin), [durationMin]);

  const canSubmit = useMemo(() => {
    return !!resolvedLawyerId && caseDescription.trim().length >= 10 && !loading;
  }, [resolvedLawyerId, caseDescription, loading]);

  const buildPayloads = useCallback(() => {
    const startsAtIso = date.toISOString();
    const duration = normalizedDuration;
    const trimmedTopic = topic.trim();
    const trimmedDescription = caseDescription.trim();

    return [
      {
        lawyerId: resolvedLawyerId,
        startsAt: startsAtIso,
        durationMin: duration,
        topic: trimmedTopic,
        caseDescription: trimmedDescription,
      },
      {
        lawyerId: resolvedLawyerId,
        scheduledAt: startsAtIso,
        durationMin: duration,
        topic: trimmedTopic,
        caseDescription: trimmedDescription,
      },
      {
        lawyerId: resolvedLawyerId,
        date: startsAtIso,
        duration: duration,
        title: trimmedTopic,
        description: trimmedDescription,
      },
      {
        lawyer: resolvedLawyerId,
        scheduledAt: startsAtIso,
        durationMin: duration,
        reason: trimmedTopic || "Legal consultation",
        notes: trimmedDescription,
      },
    ];
  }, [date, normalizedDuration, topic, caseDescription, resolvedLawyerId]);

  const onSubmit = useCallback(async () => {
    if (!resolvedLawyerId) {
      Alert.alert("Missing lawyer", "Please go back and select a lawyer again.");
      return;
    }

    if (caseDescription.trim().length < 10) {
      Alert.alert("More details needed", "Please describe your case with a bit more detail.");
      return;
    }

    if (date.getTime() < Date.now() + 5 * 60 * 1000) {
      Alert.alert("Invalid time", "Please choose a future date and time.");
      return;
    }

    try {
      setLoading(true);

      let success = false;
      let lastError: any = null;

      const payloads = buildPayloads();

      for (const endpoint of CREATE_APPOINTMENT_ENDPOINTS) {
        for (const payload of payloads) {
          try {
            await apiPost(endpoint, payload);
            success = true;
            break;
          } catch (e: any) {
            lastError = e;
            if (e?.status === 401) {
              throw new Error("Your session expired. Please login again.");
            }
          }
        }
        if (success) break;
      }

      if (!success) {
        throw new Error(lastError?.message || "Failed to create appointment.");
      }

      Alert.alert(
        "Request sent",
        "Your booking request was submitted successfully.",
        [
          {
            text: "OK",
            onPress: () => router.replace("/(user)/appointments"),
          },
        ]
      );
    } catch (e: any) {
      Alert.alert("Booking failed", e?.message || "Failed to create appointment.");
    } finally {
      setLoading(false);
    }
  }, [resolvedLawyerId, caseDescription, date, buildPayloads]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>

        <Text style={styles.title}>Book appointment</Text>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.card}>
          {!resolvedLawyerId ? (
            <View style={styles.warnBox}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
              <Text style={styles.warnText}>
                Missing lawyer information. Please go back and select a lawyer again.
              </Text>
            </View>
          ) : null}

          <View style={styles.infoCard}>
            <View style={styles.infoIcon}>
              <Ionicons name="person-outline" size={18} color={theme.blue} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoLabel}>Selected lawyer</Text>
              <Text style={styles.infoValue}>
                {resolvedLawyerName || "Lawyer selected"}
              </Text>
            </View>
          </View>

          <Text style={styles.label}>DATE & TIME</Text>
          <TouchableOpacity
            style={styles.pickerBtn}
            onPress={() => setShowPicker(true)}
            activeOpacity={0.9}
          >
            <Ionicons name="calendar-outline" size={18} color={theme.text} />
            <Text style={styles.pickerText}>{formatDateTime(date)}</Text>
          </TouchableOpacity>

          {showPicker ? (
            <DateTimePicker
              value={date}
              mode="datetime"
              minimumDate={new Date()}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(_, selected) => {
                if (Platform.OS !== "ios") setShowPicker(false);
                if (selected) setDate(selected);
              }}
            />
          ) : null}

          <Text style={styles.helperText}>
            Choose a time at least a few minutes in the future.
          </Text>

          <Text style={styles.label}>DURATION (minutes)</Text>
          <TextInput
            style={styles.input}
            value={durationMin}
            onChangeText={setDurationMin}
            keyboardType="numeric"
            placeholder="30"
            placeholderTextColor={theme.textSub}
          />
          <Text style={styles.helperText}>
            Allowed range: 15 to 180 minutes.
          </Text>

          <Text style={styles.label}>CASE TITLE (optional)</Text>
          <TextInput
            style={styles.input}
            value={topic}
            onChangeText={setTopic}
            placeholder="e.g. Land dispute"
            placeholderTextColor={theme.textSub}
          />

          <Text style={styles.label}>CASE DESCRIPTION</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={caseDescription}
            onChangeText={setCaseDescription}
            placeholder="Explain your case clearly..."
            placeholderTextColor={theme.textSub}
            multiline
          />

          <Text style={styles.counterText}>
            {caseDescription.trim().length}/10 minimum characters
          </Text>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryTitle}>Booking summary</Text>
            <Text style={styles.summaryText}>
              Date: {formatDateTime(date)}
            </Text>
            <Text style={styles.summaryText}>
              Duration: {normalizedDuration} minutes
            </Text>
            <Text style={styles.summaryText}>
              Lawyer: {resolvedLawyerName || "Selected lawyer"}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryBtnDisabled]}
            onPress={onSubmit}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Submit request</Text>
            )}
          </TouchableOpacity>
        </View>
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

    scrollContent: {
      padding: 16,
      paddingTop: 6,
      paddingBottom: 32,
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
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
    },

    card: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 18,
      padding: 14,
      gap: 10,
    },

    label: {
      fontSize: 11 * s,
      color: theme.textSub,
      fontWeight: "900",
      marginTop: 6,
    },

    infoCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.muted,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 2,
    },

    infoIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: `${theme.blue}15`,
    },

    infoLabel: {
      color: theme.textSub,
      fontWeight: "800",
      fontSize: 11 * s,
    },

    infoValue: {
      color: theme.text,
      fontWeight: "900",
      marginTop: 3,
      fontSize: 13 * s,
    },

    pickerBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.card,
    },

    pickerText: {
      color: theme.text,
      fontWeight: "800",
      flex: 1,
    },

    input: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.card,
      color: theme.text,
      fontWeight: "700",
    },

    textArea: {
      height: 120,
      textAlignVertical: "top",
    },

    helperText: {
      color: theme.textSub,
      fontWeight: "700",
      fontSize: 11 * s,
      marginTop: -2,
    },

    counterText: {
      color: theme.textSub,
      fontWeight: "700",
      fontSize: 11 * s,
      textAlign: "right",
      marginTop: -2,
    },

    summaryBox: {
      marginTop: 8,
      padding: 12,
      borderRadius: 14,
      backgroundColor: theme.muted,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 4,
    },

    summaryTitle: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 12 * s,
      marginBottom: 2,
    },

    summaryText: {
      color: theme.textSub,
      fontWeight: "700",
      lineHeight: 18,
    },

    primaryBtn: {
      marginTop: 8,
      backgroundColor: theme.blue,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 50,
    },

    primaryBtnDisabled: {
      opacity: 0.6,
    },

    primaryText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 14 * s,
    },

    warnBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: `${theme.danger}10`,
    },

    warnText: {
      flex: 1,
      color: theme.danger,
      fontWeight: "800",
      lineHeight: 18,
    },
  };
}