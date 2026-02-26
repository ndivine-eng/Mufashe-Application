import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";

type StoredUser = {
  id?: string;
  name?: string;
  fullName?: string;
  username?: string;
  email?: string;
  emailOrPhone?: string;
  phone?: string;
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
  const userKey = u.id || u.email || u.emailOrPhone;
  if (!userKey) return null;
  // Keep it safe for AsyncStorage key (remove spaces & weird chars)
  const safeKey = String(userKey).replace(/\s+/g, "_");
  return `profile_photo_uri_${safeKey}`;
}

export default function ProfileScreen() {
  const [pushEnabled, setPushEnabled] = useState(true);
  const [lang, setLang] = useState<"English" | "Kinyarwanda">("English");

  const [loadingUser, setLoadingUser] = useState(true);
  const [user, setUser] = useState<StoredUser | null>(null);

  // photo persists per-user
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const loadUserAndPhoto = useCallback(async () => {
    try {
      setLoadingUser(true);

      //  must match your login/register/google storage key
      const raw = await AsyncStorage.getItem("user");
      const u: StoredUser | null = raw ? JSON.parse(raw) : null;
      setUser(u);

      // Load user-specific photo
      const photoKey = getUserPhotoKey(u);
      if (!photoKey) {
        setPhotoUri(null);
      } else {
        const savedPhoto = await AsyncStorage.getItem(photoKey);
        setPhotoUri(savedPhoto || null);
      }
    } catch {
      setUser(null);
      setPhotoUri(null);
    } finally {
      setLoadingUser(false);
    }
  }, []);

  //  refresh each time screen is focused
  useFocusEffect(
    useCallback(() => {
      loadUserAndPhoto();
    }, [loadUserAndPhoto])
  );

  const onPickPhoto = async () => {
    try {
      if (!user) {
        Alert.alert("Not logged in", "Please login first to set a profile photo.");
        return;
      }

      setPhotoLoading(true);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert("Permission needed", "Please allow photo access to upload a profile picture.");
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
      if (!photoKey) {
        Alert.alert("Error", "Could not identify your account to save the photo.");
        return;
      }

      await AsyncStorage.setItem(photoKey, uri);
      setPhotoUri(uri);
    } catch {
      Alert.alert("Upload failed", "Could not select a photo. Try again.");
    } finally {
      setPhotoLoading(false);
    }
  };

  const onRemovePhoto = async () => {
    if (!user) return;

    const photoKey = getUserPhotoKey(user);
    if (!photoKey) return;

    await AsyncStorage.removeItem(photoKey);
    setPhotoUri(null);
  };

  const onSignOut = async () => {
    try {
      //  Only clear session
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");

      //  DO NOT delete photo here
      // (photo is stored per-user, it will come back after login)
    } finally {
      router.replace("/(auth)/login");
    }
  };

  const displayName = pickDisplayName(user);
  const contact = pickContact(user);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn}>
            <Text style={styles.iconText}>‹</Text>
          </TouchableOpacity>

          <Text style={styles.topTitle}>User Profile</Text>

          <TouchableOpacity onPress={() => router.push("/(user)/settings")} style={styles.iconBtn}>
            <Text style={styles.iconText}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Avatar section */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarCircle}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarIcon}>👤</Text>
              )}
            </View>

            {/* Edit button overlay */}
            <TouchableOpacity style={styles.editBtn} onPress={onPickPhoto} activeOpacity={0.85}>
              <Text style={styles.editIcon}>{photoLoading ? "…" : "✎"}</Text>
            </TouchableOpacity>
          </View>

          {/* Remove photo */}
          {photoUri ? (
            <TouchableOpacity onPress={onRemovePhoto} activeOpacity={0.85}>
              <Text style={styles.removePhoto}>Remove photo</Text>
            </TouchableOpacity>
          ) : null}

          {loadingUser ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
              <ActivityIndicator size="small" />
              <Text style={styles.meta}>Loading profile...</Text>
            </View>
          ) : (
            <>
              <Text style={styles.name}>{displayName}</Text>
              {contact ? <Text style={styles.meta}>{contact}</Text> : null}
              <Text style={styles.meta}>📍 Kigali, Rwanda</Text>
            </>
          )}
        </View>

        {/* Account settings */}
        <Text style={styles.sectionLabel}>ACCOUNT SETTINGS</Text>

        <View style={styles.card}>
          <RowItem icon="👤" title="Personal Information" onPress={() => alert("Personal Info (later)")} />
          <Divider />
          <RowItem
            icon="📄"
            title="Linked Legal Documents"
            subtitle="3 Documents Verified"
            onPress={() => alert("Linked Documents (later)")}
          />
          <Divider />
          <RowItem icon="🛡️" title="Account Security" onPress={() => alert("Security (later)")} />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionLabel}>PREFERENCES</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🌐</Text>
              <View>
                <Text style={styles.rowTitle}>Language Preference</Text>
              </View>
            </View>

            <View style={styles.langPills}>
              <TouchableOpacity
                onPress={() => setLang("English")}
                style={[styles.pill, lang === "English" && styles.pillActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillText, lang === "English" && styles.pillTextActive]}>
                  English
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLang("Kinyarwanda")}
                style={[styles.pill, lang === "Kinyarwanda" && styles.pillActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillText, lang === "Kinyarwanda" && styles.pillTextActive]}>
                  Kinyarwanda
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Divider />

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Text style={styles.rowIcon}>🔔</Text>
              <View>
                <Text style={styles.rowTitle}>Push Notifications</Text>
              </View>
            </View>

            <Switch value={pushEnabled} onValueChange={setPushEnabled} />
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOut} onPress={onSignOut} activeOpacity={0.9}>
          <Text style={styles.signOutText}>⎋  Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Mufashe v1.4.2 (2023)</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function RowItem({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.row} activeOpacity={0.85}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowIcon}>{icon}</Text>
        <View>
          <Text style={styles.rowTitle}>{title}</Text>
          {subtitle ? <Text style={styles.rowSub}>{subtitle}</Text> : null}
        </View>
      </View>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 22 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: { fontSize: 16, fontWeight: "800" },
  topTitle: { fontSize: 14, fontWeight: "900", color: "#111827" },

  profileHeader: { alignItems: "center", marginTop: 12, marginBottom: 18 },
  avatarWrap: { position: "relative", marginBottom: 10 },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarIcon: { fontSize: 34 },
  avatarImage: { width: "100%", height: "100%" },

  editBtn: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  editIcon: { color: "#ffffff", fontWeight: "900", fontSize: 12 },

  removePhoto: { marginTop: 6, fontSize: 12, color: "#DC2626", fontWeight: "800" },

  name: { fontSize: 18, fontWeight: "900", color: "#111827", marginTop: 6 },
  meta: { fontSize: 12, color: "#6B7280", marginTop: 4, fontWeight: "600" },

  sectionLabel: {
    marginTop: 14,
    marginBottom: 10,
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "900",
    letterSpacing: 0.6,
  },

  card: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    overflow: "hidden",
  },

  row: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    textAlign: "center",
    textAlignVertical: "center",
    paddingTop: 8,
    fontSize: 14,
  },
  rowTitle: { fontSize: 13, fontWeight: "900", color: "#111827" },
  rowSub: { fontSize: 11, color: "#16A34A", marginTop: 2, fontWeight: "800" },
  chev: { fontSize: 18, color: "#9CA3AF", fontWeight: "800" },

  divider: { height: 1, backgroundColor: "#E5E7EB" },

  langPills: { flexDirection: "row", gap: 8 },
  pill: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#ffffff",
  },
  pillActive: {
    borderColor: "#2563EB",
    backgroundColor: "#E8F0FF",
  },
  pillText: { fontSize: 11, fontWeight: "800", color: "#6B7280" },
  pillTextActive: { color: "#2563EB" },

  signOut: {
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: "#FEE2E2",
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  signOutText: { color: "#DC2626", fontWeight: "900" },

  version: { marginTop: 12, textAlign: "center", color: "#9CA3AF", fontSize: 11, fontWeight: "700" },
});
