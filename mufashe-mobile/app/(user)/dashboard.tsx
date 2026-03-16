// app/(user)/dashboard.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import BottomNav from "../../components/BottomNav";
import { useAppSettings } from "../lib/appSettings";
import { useT } from "../lib/i18n";

type StoredUser = {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string | null;
  phone?: string | null;
  emailOrPhone?: string;
  role?: string;
};

type RecentQuestion = {
  _id: string;
  question: string;
  category?: string | null;
  status?: "PENDING" | "APPROVED" | "REJECTED";
  createdAt?: string;
  updatedAt?: string;
};

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:5000/api";
const RECENT_CACHE_KEY = "@mufashe_recent_questions_cache_v1";

function joinUrl(base: string, path: string) {
  const b = base.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

function pickDisplayName(u: StoredUser | null) {
  if (!u) return "Guest";
  const directName = u.name?.trim() || u.fullName?.trim() || u.username?.trim();
  if (directName) return directName;
  if (u.email) return u.email.includes("@") ? u.email.split("@")[0] : u.email;
  if (u.emailOrPhone) return u.emailOrPhone.trim();
  if (u.phone) return u.phone;
  return "User";
}

function getUserPhotoKey(u: StoredUser | null) {
  if (!u) return null;
  const userKey = u.id || u._id || u.email || u.emailOrPhone;
  if (!userKey) return null;
  const safeKey = String(userKey).replace(/\s+/g, "_");
  return `profile_photo_uri_${safeKey}`;
}

function safeCategoryLabel(cat?: string | null) {
  return String(cat || "OTHER").toUpperCase();
}

async function apiGet(path: string) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Missing token");

  const url = joinUrl(BASE_URL, path);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });

  if (res.status === 401 || res.status === 403) {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    throw new Error("Session expired. Please login again.");
  }

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

export default function Dashboard() {
  const { theme, scale } = useAppSettings();
  const t = useT();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const ACCENT = theme?.primary || "#8B5CF6";
  const ACCENT_SOFT = theme?.primarySoft || "#F3E8FF";
  const CARD_BG = theme?.card || "#FFFFFF";
  const TEXT = theme?.text || "#1F2937";
  const TEXT_SUB = theme?.textSub || "#6B7280";
  const BORDER = theme?.border || "#E5E7EB";
  const MUTED = theme?.muted || "#F8F5FF";

  const categories = useMemo(
    () => [
      {
        key: "family",
        title: t("family"),
        subtitle: "Marriage, children",
        icon: "people-outline",
        color: "#A855F7",
      },
      {
        key: "land",
        title: t("land"),
        subtitle: "Property, ownership",
        icon: "map-outline",
        color: "#7C3AED",
      },
      {
        key: "labor",
        title: t("labor"),
        subtitle: "Jobs, contracts",
        icon: "briefcase-outline",
        color: "#9333EA",
      },
      {
        key: "civil",
        title: t("business"),
        subtitle: "Rights, disputes",
        icon: "shield-checkmark-outline",
        color: "#8B5CF6",
      },
    ],
    [t]
  );

  const [displayName, setDisplayName] = useState("...");
  const [loadingUser, setLoadingUser] = useState(true);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const [recent, setRecent] = useState<RecentQuestion[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recentError, setRecentError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const prettyMeta = useCallback(
    (dateStr?: string) => {
      if (!dateStr) return "";
      const d = new Date(dateStr);
      const now = new Date();
      const oneDay = 24 * 60 * 60 * 1000;

      const sameDay =
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
      if (sameDay) return t("today");

      const y = new Date(now.getTime() - oneDay);
      const isYesterday =
        d.getDate() === y.getDate() &&
        d.getMonth() === y.getMonth() &&
        d.getFullYear() === y.getFullYear();
      if (isYesterday) return t("yesterday");

      return d.toLocaleDateString();
    },
    [t]
  );

  const loadCachedRecent = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(RECENT_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.items)) {
        setRecent(parsed.items);
        if (parsed?.ts) setLastUpdated(new Date(parsed.ts).toLocaleString());
      }
    } catch {}
  }, []);

  const saveRecentCache = useCallback(async (items: RecentQuestion[]) => {
    try {
      const payload = { items, ts: Date.now() };
      await AsyncStorage.setItem(RECENT_CACHE_KEY, JSON.stringify(payload));
      setLastUpdated(new Date(payload.ts).toLocaleString());
    } catch {}
  }, []);

  const loadRecent = useCallback(
    async (showSpinner = true) => {
      try {
        setRecentError(null);
        if (showSpinner) setLoadingRecent(true);

        const res = await apiGet("/questions/recent?limit=5");
        const items: RecentQuestion[] = res?.items || [];
        setRecent(items);
        await saveRecentCache(items);
      } catch (e: any) {
        const msg = e?.message || "Failed to load recent questions";
        setRecentError(msg);
        if (String(msg).toLowerCase().includes("login")) {
          router.replace("/(auth)/login");
          return;
        }
      } finally {
        if (showSpinner) setLoadingRecent(false);
      }
    },
    [saveRecentCache]
  );

  const loadAndProtect = useCallback(async () => {
    try {
      setLoadingUser(true);

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/(auth)/login");
        return;
      }

      const rawUser = await AsyncStorage.getItem("user");
      const user: StoredUser | null = rawUser ? JSON.parse(rawUser) : null;

      if (!user) {
        await AsyncStorage.removeItem("token");
        router.replace("/(auth)/login");
        return;
      }

      const role = String(user.role || "user").toLowerCase();
      if (role === "admin") {
        router.replace("/(user)/admin-dashboard");
        return;
      }
      if (role === "lawyer") {
        router.replace("/(lawyer)/dashboard");
        return;
      }

      setDisplayName(pickDisplayName(user));

      const photoKey = getUserPhotoKey(user);
      if (photoKey) {
        const savedPhoto = await AsyncStorage.getItem(photoKey);
        setPhotoUri(savedPhoto || null);
      } else {
        setPhotoUri(null);
      }

      await loadCachedRecent();
      await loadRecent(true);
    } catch {
      router.replace("/(auth)/login");
    } finally {
      setLoadingUser(false);
    }
  }, [loadCachedRecent, loadRecent]);

  useFocusEffect(
    useCallback(() => {
      loadAndProtect();
    }, [loadAndProtect])
  );

  const onRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadRecent(false);
    } finally {
      setRefreshing(false);
    }
  }, [loadRecent]);

  if (loadingUser) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
      >
        {/* Top Header */}
        <View style={styles.header}>
          <View style={styles.headerTextWrap}>
            <Text style={styles.greeting}>{t("hi", { name: displayName })}</Text>
            <Text style={styles.heroSubtext}>{t("askLearnHelp")}</Text>
          </View>

          <TouchableOpacity
            style={styles.profileButton}
            onPress={() => router.push("/(user)/profile")}
            activeOpacity={0.9}
          >
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.profileImage} />
            ) : (
              <Ionicons name="person-outline" size={22} color={ACCENT} />
            )}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={() => router.push("/(user)/consult")}
          style={styles.searchBar}
        >
          <Ionicons name="search-outline" size={22} color={TEXT_SUB} />
          <TextInput
            style={styles.searchInput}
            placeholder={t("askLegalQuestion")}
            placeholderTextColor={TEXT_SUB}
            editable={false}
          />
          <View style={styles.searchMic}>
            <Ionicons name="mic-outline" size={20} color={ACCENT} />
          </View>
        </TouchableOpacity>

        {/* Main actions like screenshot */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.mainActionCard, styles.mainActionPrimary]}
            onPress={() => router.push("/(user)/consult")}
            activeOpacity={0.92}
          >
            <Ionicons name="help-circle-outline" size={26} color="#fff" />
            <Text style={styles.mainActionPrimaryText}>{t("ask")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainActionCard}
            onPress={() => router.push("/(user)/history")}
            activeOpacity={0.92}
          >
            <Ionicons name="time-outline" size={24} color={ACCENT} />
            <Text style={styles.mainActionText}>{t("history")}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.mainActionCard}
            onPress={() => router.push("/(user)/library")}
            activeOpacity={0.92}
          >
            <Ionicons name="library-outline" size={24} color={ACCENT} />
            <Text style={styles.mainActionText}>{t("library")}</Text>
          </TouchableOpacity>
        </View>

        {/* Lawyer Services */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lawyer services</Text>
          <TouchableOpacity onPress={() => router.push("/(user)/lawyers")} activeOpacity={0.8}>
            <Text style={styles.seeAllText}>See all</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.servicesRow}>
          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/(user)/lawyers")}
            activeOpacity={0.92}
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: ACCENT_SOFT }]}>
              <Ionicons name="people-outline" size={28} color={ACCENT} />
            </View>
            <Text style={styles.serviceTitle}>Lawyers</Text>
            <Text style={styles.serviceSub}>Find verified lawyers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() => router.push("/(user)/appointments")}
            activeOpacity={0.92}
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: "#EEF2FF" }]}>
              <Ionicons name="calendar-outline" size={28} color="#6366F1" />
            </View>
            <Text style={styles.serviceTitle}>My bookings</Text>
            <Text style={styles.serviceSub}>Track appointments</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceCard}
            onPress={() =>
              Alert.alert("How it works", "Book a verified lawyer and wait for approval notification.")
            }
            activeOpacity={0.92}
          >
            <View style={[styles.serviceIconWrap, { backgroundColor: "#FEF3C7" }]}>
              <Ionicons name="information-circle-outline" size={28} color="#D97706" />
            </View>
            <Text style={styles.serviceTitle}>How it works</Text>
            <Text style={styles.serviceSub}>Understand the process</Text>
          </TouchableOpacity>
        </View>

        {/* Categories */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("categories")}</Text>
          <TouchableOpacity
            onPress={() => router.push("/(user)/library")}
            activeOpacity={0.8}
          >
            <Text style={styles.seeAllText}>Browse</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.categoryGrid}>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.key}
              style={styles.categoryCard}
              activeOpacity={0.92}
              onPress={() => router.push({ pathname: "/(user)/library", params: { category: c.key } })}
            >
              <View style={[styles.categoryIconBox, { backgroundColor: `${c.color}18` }]}>
                <Ionicons name={c.icon as any} size={28} color={c.color} />
              </View>

              <Text style={styles.categoryTitle}>{c.title}</Text>
              <Text style={styles.categorySubtitle}>{c.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent */}
        <View style={[styles.sectionHeader, { marginTop: 4 }]}>
          <View style={styles.sectionHeaderLeft}>
            <Text style={styles.sectionTitle}>{t("recent")}</Text>
            {lastUpdated ? <Text style={styles.updatedText}>• {lastUpdated}</Text> : null}
          </View>

          <TouchableOpacity onPress={() => loadRecent(true)} activeOpacity={0.8} style={styles.refreshButton}>
            <Ionicons name="refresh-outline" size={18} color={ACCENT} />
          </TouchableOpacity>
        </View>

        {recentError ? (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle-outline" size={20} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.errorTitle}>Error</Text>
              <Text style={styles.errorText}>{recentError}</Text>
            </View>
            <TouchableOpacity style={styles.retryBtn} onPress={() => loadRecent(true)} activeOpacity={0.92}>
              <Text style={styles.retryText}>{t("retry")}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.recentList}>
          {loadingRecent ? (
            <View style={styles.emptyStateCard}>
              <ActivityIndicator color={ACCENT} />
              <Text style={styles.emptyStateText}>{t("loadingRecent")}</Text>
            </View>
          ) : recent.length === 0 ? (
            <View style={styles.emptyStateCard}>
              <Ionicons name="chatbubble-ellipses-outline" size={22} color={TEXT_SUB} />
              <Text style={styles.emptyStateText}>{t("noRecent")}</Text>
            </View>
          ) : (
            recent.map((r) => (
              <TouchableOpacity
                key={r._id}
                style={styles.recentCard}
                activeOpacity={0.92}
                onPress={() => router.push({ pathname: "/(user)/question-details", params: { id: r._id } })}
              >
                <View style={styles.recentIconCircle}>
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={ACCENT} />
                </View>

                <View style={styles.recentContent}>
                  <Text style={styles.recentTitle} numberOfLines={1}>
                    {r.question}
                  </Text>

                  <View style={styles.recentBottomRow}>
                    <View style={styles.categoryChip}>
                      <Text style={styles.categoryChipText}>{safeCategoryLabel(r.category)}</Text>
                    </View>

                    <Text style={styles.recentMeta}>{prettyMeta(r.updatedAt || r.createdAt)}</Text>
                  </View>
                </View>

                <Ionicons name="chevron-forward" size={18} color="#B4B4C4" />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Emergency */}
        <View style={styles.emergencyCard}>
          <View style={styles.emergencyLeft}>
            <View style={styles.emergencyIcon}>
              <Ionicons name="alert-circle" size={20} color="#fff" />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.emergencyTitle}>{t("urgentHelp")}</Text>
              <Text style={styles.emergencySubtitle}>{t("nationalLegalAid")}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.callButton}
            onPress={() => Alert.alert("Call", "Add legal aid number later.")}
            activeOpacity={0.92}
          >
            <Ionicons name="call-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={{ height: 26 }} />
      </ScrollView>

      <TouchableOpacity
        style={styles.floatingNotify}
        onPress={() => router.push("/(user)/notifications")}
        activeOpacity={0.9}
      >
        <Ionicons name="notifications-outline" size={22} color="#fff" />
      </TouchableOpacity>

      <BottomNav />
    </View>
  );
}

function makeStyles(theme: any, s: number) {
  const ACCENT = theme?.primary || "#8B5CF6";
  const ACCENT_SOFT = theme?.primarySoft || "#F3E8FF";
  const CARD_BG = theme?.card || "#FFFFFF";
  const BG = theme?.bg || "#F8F6FC";
  const TEXT = theme?.text || "#1F2937";
  const TEXT_SUB = theme?.textSub || "#6B7280";
  const BORDER = theme?.border || "#E7E5EF";
  const MUTED = theme?.muted || "#F3F1FA";
  const DANGER = theme?.danger || "#DC2626";
  const DANGER_BG = theme?.dangerBg || "#FEE2E2";

  return {
    screen: {
      flex: 1,
      backgroundColor: BG,
    },

    container: {
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 100,
    },

    center: {
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      marginTop: 12,
      color: TEXT_SUB,
      fontWeight: "800",
      fontSize: 14 * s,
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 18,
    },

    headerTextWrap: {
      flex: 1,
      paddingRight: 12,
    },

    greeting: {
      fontSize: 28 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.4,
    },

    heroSubtext: {
      marginTop: 4,
      fontSize: 13 * s,
      color: TEXT_SUB,
      fontWeight: "600",
    },

    profileButton: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    profileImage: {
      width: "100%",
      height: "100%",
    },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "#FFFFFF",
      borderRadius: 20,
      paddingLeft: 14,
      paddingRight: 10,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: BORDER,
      marginBottom: 18,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    searchInput: {
      flex: 1,
      fontSize: 15 * s,
      color: TEXT,
      marginLeft: 10,
      fontWeight: "600",
    },

    searchMic: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: ACCENT_SOFT,
      alignItems: "center",
      justifyContent: "center",
    },

    actionsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 22,
    },

    mainActionCard: {
      flex: 1,
      minHeight: 82,
      borderRadius: 18,
      backgroundColor: CARD_BG,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    mainActionPrimary: {
      backgroundColor: ACCENT,
      borderColor: ACCENT,
    },

    mainActionText: {
      fontSize: 14 * s,
      fontWeight: "900",
      color: TEXT,
    },

    mainActionPrimaryText: {
      fontSize: 14 * s,
      fontWeight: "900",
      color: "#fff",
    },

    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
      marginTop: 2,
    },

    sectionHeaderLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flex: 1,
    },

    sectionTitle: {
      fontSize: 18 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.2,
    },

    seeAllText: {
      color: ACCENT,
      fontSize: 13 * s,
      fontWeight: "800",
    },

    updatedText: {
      color: TEXT_SUB,
      fontSize: 11 * s,
      fontWeight: "700",
    },

    refreshButton: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
    },

    servicesRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 22,
    },

    serviceCard: {
      flex: 1,
      backgroundColor: CARD_BG,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      paddingVertical: 16,
      paddingHorizontal: 12,
      alignItems: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    serviceIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },

    serviceTitle: {
      fontSize: 14 * s,
      fontWeight: "900",
      color: TEXT,
      textAlign: "center",
    },

    serviceSub: {
      fontSize: 11 * s,
      color: TEXT_SUB,
      textAlign: "center",
      marginTop: 4,
      lineHeight: 15,
    },

    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 20,
    },

    categoryCard: {
      width: "48%",
      backgroundColor: CARD_BG,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
      minHeight: 132,
      justifyContent: "space-between",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    categoryIconBox: {
      width: 54,
      height: 54,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },

    categoryTitle: {
      fontSize: 15 * s,
      fontWeight: "900",
      color: TEXT,
    },

    categorySubtitle: {
      marginTop: 4,
      fontSize: 11 * s,
      color: TEXT_SUB,
      fontWeight: "600",
      lineHeight: 15,
    },

    errorCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 14,
      borderRadius: 16,
      backgroundColor: DANGER_BG,
      borderWidth: 1,
      borderColor: DANGER_BG,
      marginBottom: 12,
    },

    errorTitle: {
      color: DANGER,
      fontWeight: "900",
      fontSize: 13 * s,
    },

    errorText: {
      color: DANGER,
      fontWeight: "700",
      marginTop: 2,
      fontSize: 12 * s,
    },

    retryBtn: {
      backgroundColor: DANGER,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 12,
    },

    retryText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 12 * s,
    },

    recentList: {
      gap: 10,
      marginBottom: 18,
    },

    recentCard: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: CARD_BG,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    recentIconCircle: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: ACCENT_SOFT,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    recentContent: {
      flex: 1,
      marginRight: 8,
    },

    recentTitle: {
      fontSize: 14 * s,
      fontWeight: "800",
      color: TEXT,
      marginBottom: 8,
    },

    recentBottomRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },

    recentMeta: {
      fontSize: 11 * s,
      color: TEXT_SUB,
      fontWeight: "700",
    },

    categoryChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: MUTED,
      borderWidth: 1,
      borderColor: BORDER,
      alignSelf: "flex-start",
    },

    categoryChipText: {
      fontSize: 10 * s,
      fontWeight: "900",
      color: ACCENT,
      letterSpacing: 0.4,
    },

    emptyStateCard: {
      minHeight: 84,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: CARD_BG,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 10,
    },

    emptyStateText: {
      color: TEXT_SUB,
      fontWeight: "800",
      fontSize: 13 * s,
    },

    emergencyCard: {
      backgroundColor: CARD_BG,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 14,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      marginBottom: 6,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    emergencyLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
    },

    emergencyIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: "#EF4444",
      alignItems: "center",
      justifyContent: "center",
    },

    emergencyTitle: {
      fontSize: 14 * s,
      fontWeight: "900",
      color: TEXT,
    },

    emergencySubtitle: {
      fontSize: 12 * s,
      color: TEXT_SUB,
      marginTop: 3,
      fontWeight: "600",
    },

    callButton: {
      width: 48,
      height: 48,
      borderRadius: 16,
      backgroundColor: "#EF4444",
      alignItems: "center",
      justifyContent: "center",
    },

    floatingNotify: {
      position: "absolute",
      right: 18,
      bottom: 88,
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: ACCENT,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 5 },
      elevation: 6,
    },
  };
}