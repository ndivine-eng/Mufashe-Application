// app/(lawyer)/profile.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAppSettings } from "../lib/appSettings";

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const joinUrl = (base: string, path: string) =>
  `${String(base).replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

function safeJson(text: string) {
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { message: text };
  }
}

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");
  const res = await fetch(joinUrl(BASE_URL, path), {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const text = await res.text();
  const data = safeJson(text);
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

async function apiPatch(path: string, body: any) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");
  const res = await fetch(joinUrl(BASE_URL, path), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = safeJson(text);
  if (!res.ok) throw new Error(data?.message || "Request failed");
  return data;
}

const fmtMoney = (n: string | number) => {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString();
};

export default function LawyerProfile() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  // ✅ if lawyerId exists => user is viewing a lawyer profile (read-only)
  const params = useLocalSearchParams<{ lawyerId?: string }>();
  const lawyerId =
    typeof params.lawyerId === "string" && params.lawyerId.trim().length > 0
      ? params.lawyerId.trim()
      : undefined;

  const isReadOnlyView = Boolean(lawyerId);

  const [loading, setLoading] = useState(false);

  // display fields (used in BOTH modes)
  const [name, setName] = useState("");
  const [lawyerStatus, setLawyerStatus] = useState<"AVAILABLE" | "BUSY" | "OFFLINE">("OFFLINE");
  const [specialization, setSpecialization] = useState("");
  const [location, setLocation] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [bio, setBio] = useState("");

  const [yearsExperience, setYearsExperience] = useState("0");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [languages, setLanguages] = useState(""); // comma separated UI

  const [feeMin, setFeeMin] = useState("0");
  const [feeMax, setFeeMax] = useState("0");
  const [feeNegotiable, setFeeNegotiable] = useState(true);
  const [feeNote, setFeeNote] = useState("");

  // only meaningful for lawyers editing their profile
  const [reviewStatus, setReviewStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewNote, setReviewNote] = useState("");

  const profileComplete =
    specialization.trim().length >= 2 && location.trim().length >= 2 && bio.trim().length >= 20;

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);

      if (isReadOnlyView && lawyerId) {
        // ✅ USER VIEW: load a specific lawyer by id
        // Change this endpoint if your backend uses another route
        const res = await apiGet(`/lawyers/${lawyerId}`);

        // support multiple backend shapes:
        const u = res?.item || res?.lawyer || res?.user || res;

        setName(u?.name || u?.fullName || "");
        setLawyerStatus(String(u?.lawyerStatus || "OFFLINE").toUpperCase());
        setSpecialization(u?.specialization || "");
        setLocation(u?.location || "");
        setOfficeAddress(u?.officeAddress || "");
        setBio(u?.bio || "");

        setYearsExperience(String(u?.yearsExperience ?? 0));
        setLicenseNumber(u?.licenseNumber || "");
        setLanguages(Array.isArray(u?.languages) ? u.languages.join(", ") : u?.languages || "");

        setFeeMin(String(u?.feeMin ?? 0));
        setFeeMax(String(u?.feeMax ?? 0));
        setFeeNegotiable(Boolean(u?.feeNegotiable));
        setFeeNote(u?.feeNote || "");

        // do NOT show review fields in user view
        return;
      }

      // ✅ LAWYER EDIT VIEW: load the logged-in lawyer profile
      const res = await apiGet("/lawyers/me");
      const u = res?.user || res;

      setName(u?.name || u?.fullName || "");
      setLawyerStatus(String(u?.lawyerStatus || "OFFLINE").toUpperCase());
      setSpecialization(u?.specialization || "");
      setLocation(u?.location || "");
      setOfficeAddress(u?.officeAddress || "");
      setBio(u?.bio || "");

      setYearsExperience(String(u?.yearsExperience ?? 0));
      setLicenseNumber(u?.licenseNumber || "");
      setLanguages(Array.isArray(u?.languages) ? u.languages.join(", ") : "");

      setFeeMin(String(u?.feeMin ?? 0));
      setFeeMax(String(u?.feeMax ?? 0));
      setFeeNegotiable(Boolean(u?.feeNegotiable));
      setFeeNote(u?.feeNote || "");

      setReviewStatus(String(u?.profileReviewStatus || "PENDING").toUpperCase());
      setReviewNote(u?.profileReviewNote || "");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, [isReadOnlyView, lawyerId]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const save = useCallback(async () => {
    if (isReadOnlyView) return; // ✅ never save in read-only view

    try {
      if (!profileComplete) {
        Alert.alert(
          "Incomplete profile",
          "Please add specialization, location, and a longer bio (min 20 characters)."
        );
        return;
      }

      setLoading(true);

      const langs = languages
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      await apiPatch("/lawyers/me", {
        lawyerStatus,
        specialization,
        location,
        officeAddress,
        bio,
        yearsExperience: Number(yearsExperience) || 0,
        licenseNumber,
        languages: langs,
        feeMin: Number(feeMin) || 0,
        feeMax: Number(feeMax) || 0,
        feeNegotiable,
        feeNote,
      });

      Alert.alert("Saved ✅", "Profile saved. It is now pending admin review.");
      await loadProfile();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to update profile");
    } finally {
      setLoading(false);
    }
  }, [
    isReadOnlyView,
    profileComplete,
    lawyerStatus,
    specialization,
    location,
    officeAddress,
    bio,
    yearsExperience,
    licenseNumber,
    languages,
    feeMin,
    feeMax,
    feeNegotiable,
    feeNote,
    loadProfile,
  ]);

  const statusChip = useMemo(() => {
    if (reviewStatus === "APPROVED") return { bg: "#ECFDF3", border: "#A7F3D0", text: "#065F46" };
    if (reviewStatus === "REJECTED") return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
    return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
  }, [reviewStatus]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{isReadOnlyView ? "Lawyer Profile" : "My Lawyer Profile"}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={styles.card}>
          <Text style={styles.bigName}>{name || "Lawyer"}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {(specialization || "General") + (location ? ` • ${location}` : "")}
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>{lawyerStatus}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipText}>
                Fee: RWF {fmtMoney(feeMin)} - {fmtMoney(feeMax)}
              </Text>
            </View>
            {feeNegotiable ? (
              <View style={styles.chip}>
                <Text style={styles.chipText}>NEGOTIABLE</Text>
              </View>
            ) : null}
          </View>

          {isReadOnlyView && lawyerId ? (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push({ pathname: "/(user)/book-appointment", params: { lawyerId } })}
              activeOpacity={0.9}
            >
              <Text style={styles.primaryBtnText}>Book appointment</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Review status (ONLY for lawyers editing their own profile) */}
        {!isReadOnlyView ? (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Profile review</Text>
            <View style={[styles.reviewChip, { backgroundColor: statusChip.bg, borderColor: statusChip.border }]}>
              <Text style={[styles.reviewChipText, { color: statusChip.text }]}>{reviewStatus}</Text>
            </View>
            {reviewStatus === "REJECTED" && reviewNote ? (
              <Text style={styles.reviewNote}>Admin note: {reviewNote}</Text>
            ) : reviewStatus === "PENDING" ? (
              <Text style={styles.reviewNote}>After saving, admin must approve before users can see your profile.</Text>
            ) : (
              <Text style={styles.reviewNote}>Your profile is visible to users.</Text>
            )}
          </View>
        ) : null}

        {/* DETAILS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Professional details</Text>

          {/* READ-ONLY VIEW */}
          {isReadOnlyView ? (
            <>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Office: </Text>
                {officeAddress || "—"}
              </Text>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Experience: </Text>
                {yearsExperience || "0"} years
              </Text>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>License: </Text>
                {licenseNumber || "—"}
              </Text>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Languages: </Text>
                {languages || "—"}
              </Text>

              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Bio</Text>
              <Text style={styles.readParagraph}>{bio || "No bio provided."}</Text>
            </>
          ) : (
            /* EDIT VIEW (lawyer only) */
            <>
              <Text style={styles.label}>Specialization</Text>
              <TextInput
                style={styles.input}
                value={specialization}
                onChangeText={setSpecialization}
                placeholder="Family Law, Land Law..."
                placeholderTextColor={theme.textSub}
              />

              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.input}
                value={location}
                onChangeText={setLocation}
                placeholder="Kigali, Huye..."
                placeholderTextColor={theme.textSub}
              />

              <Text style={styles.label}>Office address</Text>
              <TextInput
                style={styles.input}
                value={officeAddress}
                onChangeText={setOfficeAddress}
                placeholder="KG 123 St, Kigali"
                placeholderTextColor={theme.textSub}
              />

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Years of experience</Text>
                  <TextInput
                    style={styles.input}
                    value={yearsExperience}
                    onChangeText={setYearsExperience}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textSub}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>License number</Text>
                  <TextInput
                    style={styles.input}
                    value={licenseNumber}
                    onChangeText={setLicenseNumber}
                    placeholder="Optional"
                    placeholderTextColor={theme.textSub}
                  />
                </View>
              </View>

              <Text style={styles.label}>Languages (comma separated)</Text>
              <TextInput
                style={styles.input}
                value={languages}
                onChangeText={setLanguages}
                placeholder="Kinyarwanda, English"
                placeholderTextColor={theme.textSub}
              />

              <Text style={styles.label}>Bio</Text>
              <TextInput
                style={[styles.input, { height: 120, textAlignVertical: "top" }]}
                value={bio}
                onChangeText={setBio}
                multiline
                placeholder="Write a clear bio (experience, focus areas, services)."
                placeholderTextColor={theme.textSub}
              />

              {!profileComplete ? (
                <View style={styles.warnBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                  <Text style={styles.warnText}>
                    Complete specialization, location, and bio (20+ chars) to look professional.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* PRICING (read-only shows text, edit shows inputs) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pricing</Text>

          {isReadOnlyView ? (
            <>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Range: </Text>
                RWF {fmtMoney(feeMin)} - {fmtMoney(feeMax)}
              </Text>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Negotiable: </Text>
                {feeNegotiable ? "Yes" : "No"}
              </Text>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Note: </Text>
                {feeNote || "—"}
              </Text>
            </>
          ) : (
            <>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Min fee (RWF)</Text>
                  <TextInput style={styles.input} value={feeMin} onChangeText={setFeeMin} keyboardType="numeric" />
                  <Text style={styles.hint}>Preview: {fmtMoney(feeMin)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Max fee (RWF)</Text>
                  <TextInput style={styles.input} value={feeMax} onChangeText={setFeeMax} keyboardType="numeric" />
                  <Text style={styles.hint}>Preview: {fmtMoney(feeMax)}</Text>
                </View>
              </View>

              <Text style={styles.label}>Negotiable?</Text>
              <View style={styles.row}>
                <TouchableOpacity
                  style={[styles.pill, feeNegotiable && styles.pillActive]}
                  onPress={() => setFeeNegotiable(true)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.pillText, feeNegotiable && { color: "#fff" }]}>YES</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, !feeNegotiable && styles.pillActive]}
                  onPress={() => setFeeNegotiable(false)}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.pillText, !feeNegotiable && { color: "#fff" }]}>NO</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.label}>Fee note (optional)</Text>
              <TextInput
                style={styles.input}
                value={feeNote}
                onChangeText={setFeeNote}
                placeholder="Depends on case complexity / negotiable"
                placeholderTextColor={theme.textSub}
              />
            </>
          )}
        </View>

        {/* SAVE (only for lawyer edit mode) */}
        {!isReadOnlyView ? (
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.7 }]}
            onPress={save}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save profile</Text>}
          </TouchableOpacity>
        ) : loading ? (
          <View style={{ paddingVertical: 10 }}>
            <ActivityIndicator />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: { flex: 1, backgroundColor: theme.bg, padding: 16 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
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

    card: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
    },

    bigName: { color: theme.text, fontWeight: "900", fontSize: 16 * s },
    meta: { color: theme.textSub, fontWeight: "800", marginTop: 4 },

    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
    },
    chipText: { fontSize: 10 * s, fontWeight: "900", color: theme.text },

    primaryBtn: {
      marginTop: 12,
      backgroundColor: theme.blue,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
    },
    primaryBtnText: { color: "#fff", fontWeight: "900", fontSize: 13 * s },

    reviewCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
    },
    reviewTitle: { fontWeight: "900", color: theme.text, marginBottom: 8 },
    reviewChip: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },
    reviewChipText: { fontWeight: "900", fontSize: 11 * s },
    reviewNote: { marginTop: 8, color: theme.textSub, fontWeight: "700" },

    sectionTitle: { fontWeight: "900", color: theme.text, marginBottom: 8 },

    label: { marginTop: 10, fontSize: 11 * s, color: theme.textSub, fontWeight: "900" },
    input: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      padding: 12,
      backgroundColor: theme.card,
      color: theme.text,
      fontWeight: "700",
    },
    hint: { marginTop: 6, color: theme.textSub, fontWeight: "700" },

    row: { flexDirection: "row", gap: 10, marginTop: 10 },

    pill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      alignItems: "center",
    },
    pillActive: { backgroundColor: theme.blue, borderColor: theme.blue },
    pillText: { fontWeight: "900", color: theme.text, fontSize: 12 * s },

    warnBox: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.danger,
      backgroundColor: `${theme.danger}10`,
    },
    warnText: { flex: 1, color: theme.danger, fontWeight: "800" },

    readLine: { color: theme.text, fontWeight: "800", marginTop: 8 },
    readLabel: { color: theme.textSub, fontWeight: "900" },
    readParagraph: { marginTop: 8, color: theme.text, fontWeight: "700", lineHeight: 18 },

    saveBtn: {
      backgroundColor: theme.blue,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 4,
    },
    saveText: { color: "#fff", fontWeight: "900", fontSize: 14 * s },
  };
}