// app/(lawyer)/profile.tsx
// This file implements the Lawyer Profile screen of the Mufashe mobile app. It allows lawyers to view and edit their profile information, including their specialization, location, bio, experience, languages, and pricing. The screen fetches the lawyer's profile data from the backend API and displays it in a user-friendly format. Lawyers can update their profile information and save it back to the server. The screen also shows the profile review status by admin and any related notes. If a lawyer is viewing another lawyer's profile, they can see the details but cannot edit them, and they have the option to book an appointment with that lawyer. 
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
  RefreshControl,
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

async function getToken() {
  const token =
    (await AsyncStorage.getItem("token")) ||
    (await AsyncStorage.getItem("@auth_token")) ||
    (await AsyncStorage.getItem("authToken"));

  return token;
}

async function apiGet(path: string) {
  const token = await getToken();
  if (!token) throw new Error("Please login first.");

  const res = await fetch(joinUrl(BASE_URL, path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await res.text();
  const data = safeJson(text);

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }

  return data;
}

async function apiPatch(path: string, body: any) {
  const token = await getToken();
  if (!token) throw new Error("Please login first.");

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

  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }

  return data;
}

const fmtMoney = (n: string | number) => {
  const v = Number(n || 0);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString();
};

const clampNonNegative = (value: string) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
};

const normalizeStatus = (value?: string) => {
  const s = String(value || "OFFLINE").toUpperCase();
  if (s === "AVAILABLE" || s === "BUSY" || s === "OFFLINE") return s;
  return "OFFLINE";
};

const normalizeReviewStatus = (value?: string) => {
  const s = String(value || "PENDING").toUpperCase();
  if (s === "APPROVED" || s === "REJECTED" || s === "PENDING") return s;
  return "PENDING";
};

export default function LawyerProfile() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const params = useLocalSearchParams<{ lawyerId?: string | string[] }>();
  const lawyerIdRaw = params?.lawyerId;
  const lawyerId =
    typeof lawyerIdRaw === "string"
      ? lawyerIdRaw.trim()
      : Array.isArray(lawyerIdRaw)
      ? String(lawyerIdRaw[0] || "").trim()
      : "";

  const isReadOnlyView = Boolean(lawyerId);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [name, setName] = useState("");
  const [lawyerStatus, setLawyerStatus] = useState<"AVAILABLE" | "BUSY" | "OFFLINE">("OFFLINE");
  const [specialization, setSpecialization] = useState("");
  const [location, setLocation] = useState("");
  const [officeAddress, setOfficeAddress] = useState("");
  const [bio, setBio] = useState("");

  const [yearsExperience, setYearsExperience] = useState("0");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [languages, setLanguages] = useState("");

  const [feeMin, setFeeMin] = useState("0");
  const [feeMax, setFeeMax] = useState("0");
  const [feeNegotiable, setFeeNegotiable] = useState(true);
  const [feeNote, setFeeNote] = useState("");

  const [reviewStatus, setReviewStatus] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [reviewNote, setReviewNote] = useState("");

  const [error, setError] = useState<string | null>(null);

  const profileComplete =
    specialization.trim().length >= 2 &&
    location.trim().length >= 2 &&
    bio.trim().length >= 20;

  const reviewChipColors = useMemo(() => {
    if (reviewStatus === "APPROVED") {
      return { bg: "#ECFDF3", border: "#A7F3D0", text: "#065F46" };
    }
    if (reviewStatus === "REJECTED") {
      return { bg: "#FEF2F2", border: "#FECACA", text: "#991B1B" };
    }
    return { bg: "#FFFBEB", border: "#FDE68A", text: "#92400E" };
  }, [reviewStatus]);

  const loadProfile = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      if (isReadOnlyView && lawyerId) {
        const res = await apiGet(`/lawyers/${lawyerId}`);
        const u = res?.item || res?.lawyer || res?.user || res;

        setName(u?.name || u?.fullName || "");
        setLawyerStatus(normalizeStatus(u?.lawyerStatus) as "AVAILABLE" | "BUSY" | "OFFLINE");
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
        return;
      }

      const res = await apiGet("/lawyers/me");
      const u = res?.item || res?.lawyer || res?.user || res;

      setName(u?.name || u?.fullName || "");
      setLawyerStatus(normalizeStatus(u?.lawyerStatus) as "AVAILABLE" | "BUSY" | "OFFLINE");
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

      setReviewStatus(
        normalizeReviewStatus(u?.profileReviewStatus) as "PENDING" | "APPROVED" | "REJECTED"
      );
      setReviewNote(u?.profileReviewNote || "");
    } catch (e: any) {
      const msg = e?.message || "Failed to load profile";
      setError(msg);
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  }, [isReadOnlyView, lawyerId]);

  React.useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadProfile();
    } finally {
      setRefreshing(false);
    }
  }, [loadProfile]);

  const save = useCallback(async () => {
    if (isReadOnlyView) return;

    if (!profileComplete) {
      Alert.alert(
        "Incomplete profile",
        "Please add specialization, location, and a longer bio of at least 20 characters."
      );
      return;
    }

    const exp = clampNonNegative(yearsExperience);
    const minFee = clampNonNegative(feeMin);
    const maxFee = clampNonNegative(feeMax);

    if (maxFee < minFee) {
      Alert.alert("Invalid pricing", "Maximum fee cannot be less than minimum fee.");
      return;
    }

    try {
      setLoading(true);

      const langs = languages
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean);

      await apiPatch("/lawyers/me", {
        lawyerStatus,
        specialization: specialization.trim(),
        location: location.trim(),
        officeAddress: officeAddress.trim(),
        bio: bio.trim(),
        yearsExperience: exp,
        licenseNumber: licenseNumber.trim(),
        languages: langs,
        feeMin: minFee,
        feeMax: maxFee,
        feeNegotiable,
        feeNote: feeNote.trim(),
      });

      Alert.alert("Saved", "Profile updated successfully.");
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

  const openBooking = useCallback(() => {
    if (!lawyerId) return;

    router.push({
      pathname: "/(user)/book-appointment",
      params: {
        lawyerId,
        lawyerName: name || "Lawyer",
      },
    });
  }, [lawyerId, name]);

  const readableSpecialization = specialization || "General";
  const readableLocation = location || "Location not set";
  const readableOffice = officeAddress || "—";
  const readableBio = bio || "No bio provided.";
  const readableLicense = licenseNumber || "—";
  const readableLanguages = languages || "—";
  const readableYears = `${clampNonNegative(yearsExperience)} years`;

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="arrow-back" size={18} color={theme.text} />
        </TouchableOpacity>

        <Text style={styles.title}>
          {isReadOnlyView ? "Lawyer Profile" : "My Lawyer Profile"}
        </Text>

        <TouchableOpacity onPress={loadProfile} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="refresh-outline" size={18} color={theme.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 18 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : null}

        {error ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.bigName}>{name || "Lawyer"}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {`${readableSpecialization}${location ? ` • ${readableLocation}` : ""}`}
          </Text>

          <View style={styles.chipWrap}>
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

          {isReadOnlyView ? (
            <TouchableOpacity style={styles.primaryBtn} onPress={openBooking} activeOpacity={0.9}>
              <Text style={styles.primaryBtnText}>Book appointment</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {!isReadOnlyView ? (
          <View style={styles.reviewCard}>
            <Text style={styles.reviewTitle}>Profile review</Text>

            <View
              style={[
                styles.reviewChip,
                {
                  backgroundColor: reviewChipColors.bg,
                  borderColor: reviewChipColors.border,
                },
              ]}
            >
              <Text style={[styles.reviewChipText, { color: reviewChipColors.text }]}>
                {reviewStatus}
              </Text>
            </View>

            {reviewStatus === "REJECTED" && reviewNote ? (
              <Text style={styles.reviewNote}>Admin note: {reviewNote}</Text>
            ) : reviewStatus === "PENDING" ? (
              <Text style={styles.reviewNote}>
                After saving, admin approval may be required before users can see your profile.
              </Text>
            ) : (
              <Text style={styles.reviewNote}>Your profile is visible to users.</Text>
            )}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Professional details</Text>

          {isReadOnlyView ? (
            <>
              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Office: </Text>
                {readableOffice}
              </Text>

              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Experience: </Text>
                {readableYears}
              </Text>

              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>License: </Text>
                {readableLicense}
              </Text>

              <Text style={styles.readLine}>
                <Text style={styles.readLabel}>Languages: </Text>
                {readableLanguages}
              </Text>

              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Bio</Text>
              <Text style={styles.readParagraph}>{readableBio}</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>Professional status</Text>
              <View style={styles.row}>
                {(["AVAILABLE", "BUSY", "OFFLINE"] as const).map((s) => {
                  const active = lawyerStatus === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.pill, active && styles.pillActive]}
                      onPress={() => setLawyerStatus(s)}
                      activeOpacity={0.9}
                    >
                      <Text style={[styles.pillText, active && { color: "#fff" }]}>{s}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

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
                placeholder="Write a clear bio describing your experience, focus areas, and services."
                placeholderTextColor={theme.textSub}
              />

              {!profileComplete ? (
                <View style={styles.warnBox}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                  <Text style={styles.warnText}>
                    Add specialization, location, and a bio of at least 20 characters.
                  </Text>
                </View>
              ) : null}
            </>
          )}
        </View>

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
                  <TextInput
                    style={styles.input}
                    value={feeMin}
                    onChangeText={setFeeMin}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textSub}
                  />
                  <Text style={styles.hint}>Preview: {fmtMoney(feeMin)}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Max fee (RWF)</Text>
                  <TextInput
                    style={styles.input}
                    value={feeMax}
                    onChangeText={setFeeMax}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textSub}
                  />
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

        {!isReadOnlyView ? (
          <TouchableOpacity
            style={[styles.saveBtn, loading && { opacity: 0.7 }]}
            onPress={save}
            disabled={loading}
            activeOpacity={0.9}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save profile</Text>
            )}
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  return {
    screen: {
      flex: 1,
      backgroundColor: theme.bg,
      padding: 16,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
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

    loadingBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      paddingVertical: 16,
    },

    loadingText: {
      color: theme.textSub,
      fontWeight: "800",
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
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
    },

    bigName: {
      color: theme.text,
      fontWeight: "900",
      fontSize: 16 * s,
    },

    meta: {
      color: theme.textSub,
      fontWeight: "800",
      marginTop: 4,
    },

    chipWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },

    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
    },

    chipText: {
      fontSize: 10 * s,
      fontWeight: "900",
      color: theme.text,
    },

    primaryBtn: {
      marginTop: 12,
      backgroundColor: theme.blue,
      paddingVertical: 12,
      borderRadius: 14,
      alignItems: "center",
    },

    primaryBtnText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 13 * s,
    },

    reviewCard: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.card,
      borderRadius: 16,
      padding: 12,
      marginBottom: 12,
    },

    reviewTitle: {
      fontWeight: "900",
      color: theme.text,
      marginBottom: 8,
    },

    reviewChip: {
      alignSelf: "flex-start",
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
    },

    reviewChipText: {
      fontWeight: "900",
      fontSize: 11 * s,
    },

    reviewNote: {
      marginTop: 8,
      color: theme.textSub,
      fontWeight: "700",
      lineHeight: 18,
    },

    sectionTitle: {
      fontWeight: "900",
      color: theme.text,
      marginBottom: 8,
    },

    label: {
      marginTop: 10,
      fontSize: 11 * s,
      color: theme.textSub,
      fontWeight: "900",
    },

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

    hint: {
      marginTop: 6,
      color: theme.textSub,
      fontWeight: "700",
    },

    row: {
      flexDirection: "row",
      gap: 10,
      marginTop: 10,
    },

    pill: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.muted,
      alignItems: "center",
    },

    pillActive: {
      backgroundColor: theme.blue,
      borderColor: theme.blue,
    },

    pillText: {
      fontWeight: "900",
      color: theme.text,
      fontSize: 12 * s,
    },

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

    warnText: {
      flex: 1,
      color: theme.danger,
      fontWeight: "800",
      lineHeight: 18,
    },

    readLine: {
      color: theme.text,
      fontWeight: "800",
      marginTop: 8,
      lineHeight: 18,
    },

    readLabel: {
      color: theme.textSub,
      fontWeight: "900",
    },

    readParagraph: {
      marginTop: 8,
      color: theme.text,
      fontWeight: "700",
      lineHeight: 20,
    },

    saveBtn: {
      backgroundColor: theme.blue,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 4,
    },

    saveText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 14 * s,
    },
  };
}