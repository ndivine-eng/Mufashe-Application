// app/(user)/profile.tsx
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { useAppSettings } from "../lib/appSettings";
import { useT } from "../lib/i18n";

type StoredUser = {
  id?: string;
  _id?: string;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  emailOrPhone?: string;
  phone?: string;
  role?: string;
};

function pickDisplayName(u: StoredUser | null) {
  if (!u) return "Guest";
  return (
    u.name?.trim() ||
    u.fullName?.trim() ||
    u.username?.trim() ||
    (u.email ? u.email.split("@")[0] : "") ||
    u.emailOrPhone?.trim() ||
    "User"
  );
}

function pickContact(u: StoredUser | null) {
  if (!u) return "";
  return u.emailOrPhone?.trim() || u.email?.trim() || u.phone?.trim() || "";
}

function getUserPhotoKey(u: StoredUser | null) {
  if (!u) return null;
  const userKey = u.id || u._id || u.email || u.emailOrPhone;
  if (!userKey) return null;
  const safeKey = String(userKey).replace(/\s+/g, "_");
  return `profile_photo_uri_${safeKey}`;
}

export default function ProfileScreen() {
  const { theme, scale } = useAppSettings();
  const t = useT();

  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [loadingUser, setLoadingUser] = useState(true);
  const [user, setUser] = useState<StoredUser | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const loadUserAndPhoto = useCallback(async () => {
    try {
      setLoadingUser(true);

      const raw = await AsyncStorage.getItem("user");
      const u: StoredUser | null = raw ? JSON.parse(raw) : null;
      setUser(u);

      const photoKey = getUserPhotoKey(u);
      if (!photoKey) {
        setPhotoUri(null);
        return;
      }

      const savedPhoto = await AsyncStorage.getItem(photoKey);
      setPhotoUri(savedPhoto || null);
    } catch {
      setUser(null);
      setPhotoUri(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadUserAndPhoto();
    }, [loadUserAndPhoto])
  );

  const onPickPhoto = useCallback(async () => {
    try {
      if (!user) {
        Alert.alert(t("notLoggedInTitle"), t("notLoggedInMsg"));
        return;
      }

      setPhotoLoading(true);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(t("permissionTitle"), t("permissionMsg"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      const photoKey = getUserPhotoKey(user);
      if (!photoKey) return;

      await AsyncStorage.setItem(photoKey, uri);
      setPhotoUri(uri);
    } catch {
      Alert.alert(t("uploadFailedTitle"), t("uploadFailedMsg"));
    } finally {
      setPhotoLoading(false);
    }
  }, [user, t]);

  const onRemovePhoto = useCallback(async () => {
    if (!user) return;
    const photoKey = getUserPhotoKey(user);
    if (!photoKey) return;

    await AsyncStorage.removeItem(photoKey);
    setPhotoUri(null);
  }, [user]);

  const onSignOut = useCallback(async () => {
    await AsyncStorage.removeItem("token");
    await AsyncStorage.removeItem("user");
    router.replace("/(auth)/login");
  }, []);

  const displayName = pickDisplayName(user);
  const contact = pickContact(user);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>

          <Text style={styles.topTitle}>{t("profile")}</Text>

          <TouchableOpacity onPress={() => router.push("/(user)/settings")} style={styles.iconBtn} activeOpacity={0.9}>
            <Ionicons name="settings-outline" size={20} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <Ionicons name="person" size={34} color={theme.textSub} />
              )}
            </View>

            <TouchableOpacity style={styles.editBtn} onPress={onPickPhoto} activeOpacity={0.85}>
              {photoLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="camera-outline" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          </View>

          {photoUri ? (
            <TouchableOpacity onPress={onRemovePhoto} activeOpacity={0.85}>
              <Text style={styles.removePhoto}>{t("removePhoto")}</Text>
            </TouchableOpacity>
          ) : null}

          {loadingUser ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" />
              <Text style={styles.meta}>{t("loading")}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.name}>{displayName}</Text>
              {contact ? <Text style={styles.meta}>{contact}</Text> : null}

              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={theme.textSub} />
                <Text style={styles.meta}>Kigali, Rwanda</Text>
              </View>
            </>
          )}
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>{t("account")}</Text>
        <View style={styles.card}>
          <RowNav
            icon="person-outline"
            title={t("personalInfo")}
            subtitle={t("updateDetails")}
            onPress={() => Alert.alert(t("comingSoonTitle"), t("comingSoonPersonalInfo"))}
            theme={theme}
            styles={styles}
          />
          <Divider styles={styles} />
          <RowNav
            icon="shield-checkmark-outline"
            title={t("security")}
            subtitle={t("securityDesc")}
            onPress={() => Alert.alert(t("comingSoonTitle"), t("comingSoonSecurity"))}
            theme={theme}
            styles={styles}
          />
          <Divider styles={styles} />
          <RowNav
            icon="time-outline"
            title={t("myQuestions")}
            subtitle={t("viewHistory")}
            onPress={() => router.push("/(user)/history")}
            theme={theme}
            styles={styles}
          />
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOut} onPress={onSignOut} activeOpacity={0.9}>
          <Ionicons name="log-out-outline" size={18} color={theme.danger} />
          <Text style={styles.signOutText}>{t("signOut")}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Mufashe • Version 1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */

function Divider({ styles }: { styles: any }) {
  return <View style={styles.divider} />;
}

function RowNav({
  icon,
  title,
  subtitle,
  onPress,
  styles,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  styles: any;
  theme: any;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={theme.text} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.chevron} />
    </TouchableOpacity>
  );
}

/* ---------- Styles ---------- */

function makeStyles(theme: any, s: number) {
  return {
    safe: { flex: 1, backgroundColor: theme.bg },
    container: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22 },

    topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
    iconBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" },
    topTitle: { fontSize: 14 * s, fontWeight: "900", color: theme.text },

    profileHeader: { alignItems: "center", marginTop: 12, marginBottom: 18 },
    avatarWrap: { position: "relative", marginBottom: 10 },

    avatarCircle: {
      width: 92,
      height: 92,
      borderRadius: 46,
      backgroundColor: theme.muted,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    avatarImage: { width: "100%", height: "100%" },

    editBtn: {
      position: "absolute",
      right: -2,
      bottom: -2,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: theme.blue,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: theme.bg,
    },

    removePhoto: { marginTop: 6, fontSize: 12 * s, color: theme.danger, fontWeight: "800" },

    loadingRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
    name: { fontSize: 18 * s, fontWeight: "900", color: theme.text, marginTop: 6 },
    meta: { fontSize: 12 * s, color: theme.textSub, marginTop: 4, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },

    sectionLabel: {
      marginTop: 14,
      marginBottom: 10,
      fontSize: 11 * s,
      color: theme.textSub,
      fontWeight: "900",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },

    card: { borderWidth: 1, borderColor: theme.border, borderRadius: 16, backgroundColor: theme.card, overflow: "hidden" },

    row: { paddingHorizontal: 14, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1, paddingRight: 10 },

    iconBox: { width: 34, height: 34, borderRadius: 12, backgroundColor: theme.muted, alignItems: "center", justifyContent: "center" },
    rowTitle: { fontSize: 13 * s, fontWeight: "900", color: theme.text },
    rowSub: { marginTop: 3, fontSize: 11.2 * s, color: theme.textSub, fontWeight: "700" },

    divider: { height: 1, backgroundColor: theme.divider },

    signOut: {
      marginTop: 16,
      borderRadius: 14,
      backgroundColor: theme.dangerBg,
      paddingVertical: 14,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.dangerBg,
      flexDirection: "row",
      gap: 10,
    },
    signOutText: { color: theme.danger, fontWeight: "900", fontSize: 13 * s },

    version: { marginTop: 12, textAlign: "center", color: theme.chevron, fontSize: 11 * s, fontWeight: "700" },
  };
}