import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  Modal,
  TextInput,
  Linking,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function ProfileScreen() {
  const { theme, scale } = useAppSettings();
  const t = useT();

  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const ACCENT = theme?.primary || "#8B5CF6";
  const TEXT = theme?.text || "#1F2937";

  const [loadingUser, setLoadingUser] = useState(true);
  const [user, setUser] = useState<StoredUser | null>(null);

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const loadUserAndPhoto = useCallback(async () => {
    try {
      setLoadingUser(true);

      const raw = await AsyncStorage.getItem("user");
      const u: StoredUser | null = raw ? JSON.parse(raw) : null;
      setUser(u);

      if (u) {
        setEditName(u.name || u.fullName || u.username || "");
        setEditEmail(u.email || "");
        setEditPhone(u.phone || "");
      } else {
        setEditName("");
        setEditEmail("");
        setEditPhone("");
      }

      const photoKey = getUserPhotoKey(u);
      if (!photoKey) {
        setPhotoUri(null);
        return;
      }

      const savedPhoto = await AsyncStorage.getItem(photoKey);
      setPhotoUri(savedPhoto || null);
    } catch (error) {
      console.log("Failed to load profile:", error);
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
        Alert.alert(
          t("notLoggedInTitle") || "Not logged in",
          t("notLoggedInMsg") || "Please log in first."
        );
        return;
      }

      setPhotoLoading(true);

      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        Alert.alert(
          t("permissionTitle") || "Permission needed",
          t("permissionMsg") || "Please allow photo access."
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      const photoKey = getUserPhotoKey(user);
      if (!photoKey) return;

      await AsyncStorage.setItem(photoKey, uri);
      setPhotoUri(uri);
    } catch (error) {
      console.log("Pick photo error:", error);
      Alert.alert(
        t("uploadFailedTitle") || "Upload failed",
        t("uploadFailedMsg") || "Unable to update profile photo."
      );
    } finally {
      setPhotoLoading(false);
    }
  }, [user, t]);

  const onRemovePhoto = useCallback(async () => {
    try {
      if (!user) return;

      Alert.alert(
        "Remove photo",
        "Are you sure you want to remove your profile photo?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              const photoKey = getUserPhotoKey(user);
              if (!photoKey) return;

              await AsyncStorage.removeItem(photoKey);
              setPhotoUri(null);
            },
          },
        ]
      );
    } catch (error) {
      console.log("Remove photo error:", error);
      Alert.alert("Error", "Failed to remove photo.");
    }
  }, [user]);

  const openEditProfile = useCallback(() => {
    if (!user) {
      Alert.alert("Not logged in", "Please log in first.");
      return;
    }
    setEditName(user.name || user.fullName || user.username || "");
    setEditEmail(user.email || "");
    setEditPhone(user.phone || "");
    setEditVisible(true);
  }, [user]);

  const onSaveProfile = useCallback(async () => {
    try {
      if (!user) {
        Alert.alert("Not logged in", "Please log in first.");
        return;
      }

      const trimmedName = editName.trim();
      const trimmedEmail = editEmail.trim();
      const trimmedPhone = editPhone.trim();

      if (!trimmedName) {
        Alert.alert("Missing name", "Please enter your name.");
        return;
      }

      setSavingProfile(true);

      const updatedUser: StoredUser = {
        ...user,
        name: trimmedName,
        fullName: trimmedName,
        email: trimmedEmail || user.email || "",
        phone: trimmedPhone || "",
        emailOrPhone: trimmedEmail || trimmedPhone || user.emailOrPhone || "",
      };

      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      setEditVisible(false);

      Alert.alert("Success", "Profile updated successfully.");
    } catch (error) {
      console.log("Save profile error:", error);
      Alert.alert("Error", "Failed to save profile changes.");
    } finally {
      setSavingProfile(false);
    }
  }, [editEmail, editName, editPhone, user]);

  const onSecurityPress = useCallback(() => {
    Alert.alert(
      "Security",
      "Security settings can be connected to your backend change-password or account protection screen.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Go to Settings",
          onPress: () => router.push("/(user)/settings"),
        },
      ]
    );
  }, []);

  const openExternalLink = useCallback(async (url: string, fallbackTitle: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert("Unavailable", `${fallbackTitle} link is not available.`);
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.log("Open link error:", error);
      Alert.alert("Error", `Could not open ${fallbackTitle}.`);
    }
  }, []);

  const onHelpPress = useCallback(() => {
    Alert.alert(
      "Help center",
      "Choose how you want to get help.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Email support",
          onPress: () => openExternalLink("mailto:support@mufashe.com", "email"),
        },
        {
          text: "Call support",
          onPress: () => openExternalLink("tel:+250788000000", "call"),
        },
      ]
    );
  }, [openExternalLink]);

  const onPrivacyTermsPress = useCallback(() => {
    Alert.alert(
      "Privacy & Terms",
      "Open legal information.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Privacy Policy",
          onPress: () => openExternalLink("https://example.com/privacy", "privacy policy"),
        },
        {
          text: "Terms of Use",
          onPress: () => openExternalLink("https://example.com/terms", "terms of use"),
        },
      ]
    );
  }, [openExternalLink]);

  const onSignOut = useCallback(async () => {
    try {
      Alert.alert(
        t("signOut") || "Sign out",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign out",
            style: "destructive",
            onPress: async () => {
              const photoKey = getUserPhotoKey(user);

              await AsyncStorage.removeItem("token");
              await AsyncStorage.removeItem("user");

              if (photoKey) {
                await AsyncStorage.removeItem(photoKey);
              }

              setUser(null);
              setPhotoUri(null);

              router.replace("/(auth)/login");
            },
          },
        ]
      );
    } catch (error) {
      console.log("Sign out error:", error);
      Alert.alert("Error", "Failed to sign out.");
    }
  }, [t, user]);

  const displayName = pickDisplayName(user);
  const contact = pickContact(user);
  const initials = getInitials(displayName);
  const roleLabel = user?.role ? String(user.role).toUpperCase() : "USER";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
            <Ionicons name="chevron-back" size={20} color={TEXT} />
          </TouchableOpacity>

          <Text style={styles.topTitle}>{t("profile") || "Profile"}</Text>

          <TouchableOpacity
            onPress={() => router.push("/(user)/settings")}
            style={styles.iconBtn}
            activeOpacity={0.9}
          >
            <Ionicons name="settings-outline" size={20} color={TEXT} />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarOuter}>
                <View style={styles.avatarCircle}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarInitials}>{initials}</Text>
                  )}
                </View>
              </View>

              <TouchableOpacity style={styles.cameraBtn} onPress={onPickPhoto} activeOpacity={0.9}>
                {photoLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="camera-outline" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.heroTextWrap}>
              {loadingUser ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color={ACCENT} />
                  <Text style={styles.loadingText}>{t("loading") || "Loading..."}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{displayName}</Text>
                    <View style={styles.roleBadge}>
                      <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                    </View>
                  </View>

                  {!!contact && <Text style={styles.contactText}>{contact}</Text>}

                  <View style={styles.metaRow}>
                    <View style={styles.metaPill}>
                      <Ionicons name="shield-checkmark-outline" size={14} color={ACCENT} />
                      <Text style={styles.metaPillText}>Verified account</Text>
                    </View>

                    <View style={styles.metaPill}>
                      <Ionicons name="location-outline" size={14} color={ACCENT} />
                      <Text style={styles.metaPillText}>Kigali, Rwanda</Text>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.secondaryAction} onPress={onPickPhoto} activeOpacity={0.9}>
              <Ionicons name="image-outline" size={18} color={ACCENT} />
              <Text style={styles.secondaryActionText}>Change photo</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryAction} onPress={openEditProfile} activeOpacity={0.9}>
              <Ionicons name="create-outline" size={18} color={ACCENT} />
              <Text style={styles.secondaryActionText}>Edit profile</Text>
            </TouchableOpacity>
          </View>

          {photoUri ? (
            <TouchableOpacity style={styles.removeActionFull} onPress={onRemovePhoto} activeOpacity={0.9}>
              <Ionicons name="trash-outline" size={18} color={theme?.danger || "#DC2626"} />
              <Text style={styles.removeActionText}>{t("removePhoto") || "Remove photo"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.quickActionsRow}>
          <TouchableOpacity
            style={[styles.quickCard, styles.quickPrimary]}
            activeOpacity={0.92}
            onPress={() => router.push("/(user)/history")}
          >
            <Ionicons name="time-outline" size={24} color="#fff" />
            <Text style={styles.quickPrimaryText}>{t("myQuestions") || "My questions"}</Text>
            <Text style={styles.quickPrimarySub}>View previous activity</Text>
          </TouchableOpacity>

          <View style={styles.quickColumn}>
            <TouchableOpacity
              style={styles.quickMiniCard}
              activeOpacity={0.92}
              onPress={() => router.push("/(user)/settings")}
            >
              <Ionicons name="settings-outline" size={20} color={ACCENT} />
              <Text style={styles.quickMiniText}>Settings</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickMiniCard}
              activeOpacity={0.92}
              onPress={() => router.push("/(user)/library")}
            >
              <Ionicons name="library-outline" size={20} color={ACCENT} />
              <Text style={styles.quickMiniText}>Library</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("account") || "Account"}</Text>
        </View>

        <View style={styles.card}>
          <RowNav
            icon="person-outline"
            title={t("personalInfo") || "Personal info"}
            subtitle={t("updateDetails") || "Update your details"}
            onPress={openEditProfile}
            theme={theme}
            styles={styles}
          />
          <Divider styles={styles} />
          <RowNav
            icon="shield-checkmark-outline"
            title={t("security") || "Security"}
            subtitle={t("securityDesc") || "Password and account protection"}
            onPress={onSecurityPress}
            theme={theme}
            styles={styles}
          />
          <Divider styles={styles} />
          <RowNav
            icon="time-outline"
            title={t("myQuestions") || "My questions"}
            subtitle={t("viewHistory") || "View consultation history"}
            onPress={() => router.push("/(user)/history")}
            theme={theme}
            styles={styles}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Support</Text>
        </View>

        <View style={styles.card}>
          <RowNav
            icon="help-circle-outline"
            title="Help center"
            subtitle="Get guidance on using Mufashe"
            onPress={onHelpPress}
            theme={theme}
            styles={styles}
          />
          <Divider styles={styles} />
          <RowNav
            icon="document-text-outline"
            title="Privacy & terms"
            subtitle="Read policies and app information"
            onPress={onPrivacyTermsPress}
            theme={theme}
            styles={styles}
          />
        </View>

        <TouchableOpacity style={styles.signOut} onPress={onSignOut} activeOpacity={0.92}>
          <Ionicons name="log-out-outline" size={18} color={theme?.danger || "#DC2626"} />
          <Text style={styles.signOutText}>{t("signOut") || "Sign out"}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Mufashe • Version 1.0</Text>
      </ScrollView>

      <Modal visible={editVisible} animationType="slide" transparent onRequestClose={() => setEditVisible(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalKeyboardWrap}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit profile</Text>
                <TouchableOpacity onPress={() => setEditVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={TEXT} />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Full name</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter your full name"
                placeholderTextColor={theme?.chevron || "#A1A1AA"}
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Email</Text>
              <TextInput
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Enter your email"
                placeholderTextColor={theme?.chevron || "#A1A1AA"}
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text style={styles.inputLabel}>Phone</Text>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="Enter your phone number"
                placeholderTextColor={theme?.chevron || "#A1A1AA"}
                style={styles.input}
                keyboardType="phone-pad"
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalSecondaryBtn}
                  onPress={() => setEditVisible(false)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.modalSecondaryText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.modalPrimaryBtn}
                  onPress={onSaveProfile}
                  activeOpacity={0.9}
                  disabled={savingProfile}
                >
                  {savingProfile ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.modalPrimaryText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

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
  const ACCENT = theme?.primary || "#8B5CF6";

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.rowLeft}>
        <View style={styles.iconBox}>
          <Ionicons name={icon} size={18} color={ACCENT} />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          {!!subtitle && <Text style={styles.rowSub}>{subtitle}</Text>}
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme?.chevron || "#A1A1AA"} />
    </TouchableOpacity>
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
  const DIVIDER = theme?.divider || "#EEEAF6";
  const CHEVRON = theme?.chevron || "#A1A1AA";
  const MODAL_BACKDROP = "rgba(0,0,0,0.35)";

  return {
    safe: {
      flex: 1,
      backgroundColor: BG,
    },

    container: {
      paddingHorizontal: 18,
      paddingTop: 8,
      paddingBottom: 30,
    },

    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 16,
    },

    iconBtn: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: CARD_BG,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },

    topTitle: {
      fontSize: 16 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.2,
    },

    heroCard: {
      backgroundColor: CARD_BG,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: BORDER,
      padding: 18,
      marginBottom: 18,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },

    heroTop: {
      flexDirection: "row",
      alignItems: "center",
    },

    avatarWrap: {
      position: "relative",
      marginRight: 14,
    },

    avatarOuter: {
      width: 98,
      height: 98,
      borderRadius: 49,
      backgroundColor: ACCENT_SOFT,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: `${ACCENT}25`,
    },

    avatarCircle: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: MUTED,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    },

    avatarImage: {
      width: "100%",
      height: "100%",
    },

    avatarInitials: {
      fontSize: 28 * s,
      fontWeight: "900",
      color: ACCENT,
      letterSpacing: -0.3,
    },

    cameraBtn: {
      position: "absolute",
      right: 2,
      bottom: 2,
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: ACCENT,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: CARD_BG,
    },

    heroTextWrap: {
      flex: 1,
    },

    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },

    loadingText: {
      color: TEXT_SUB,
      fontWeight: "700",
      fontSize: 13 * s,
    },

    nameRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
    },

    name: {
      fontSize: 22 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.3,
    },

    roleBadge: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: ACCENT_SOFT,
      borderWidth: 1,
      borderColor: `${ACCENT}20`,
    },

    roleBadgeText: {
      fontSize: 10 * s,
      fontWeight: "900",
      color: ACCENT,
      letterSpacing: 0.5,
    },

    contactText: {
      marginTop: 6,
      fontSize: 13 * s,
      color: TEXT_SUB,
      fontWeight: "700",
    },

    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },

    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: MUTED,
      borderWidth: 1,
      borderColor: BORDER,
    },

    metaPillText: {
      fontSize: 11 * s,
      color: TEXT_SUB,
      fontWeight: "800",
    },

    heroActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 16,
    },

    secondaryAction: {
      flex: 1,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: MUTED,
      borderWidth: 1,
      borderColor: BORDER,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 12,
    },

    secondaryActionText: {
      fontSize: 13 * s,
      color: TEXT,
      fontWeight: "900",
    },

    removeActionFull: {
      marginTop: 10,
      minHeight: 48,
      borderRadius: 16,
      backgroundColor: DANGER_BG,
      borderWidth: 1,
      borderColor: DANGER_BG,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 12,
    },

    removeActionText: {
      fontSize: 13 * s,
      color: DANGER,
      fontWeight: "900",
    },

    quickActionsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 20,
    },

    quickCard: {
      borderRadius: 20,
      borderWidth: 1,
      borderColor: BORDER,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    quickPrimary: {
      flex: 1.2,
      backgroundColor: ACCENT,
      padding: 16,
      justifyContent: "space-between",
      minHeight: 132,
      borderColor: ACCENT,
    },

    quickPrimaryText: {
      marginTop: 12,
      fontSize: 16 * s,
      color: "#fff",
      fontWeight: "900",
    },

    quickPrimarySub: {
      marginTop: 6,
      fontSize: 12 * s,
      color: "rgba(255,255,255,0.84)",
      fontWeight: "700",
      lineHeight: 17,
    },

    quickColumn: {
      flex: 1,
      gap: 10,
    },

    quickMiniCard: {
      flex: 1,
      backgroundColor: CARD_BG,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: BORDER,
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      minHeight: 61,
      paddingHorizontal: 12,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    quickMiniText: {
      fontSize: 12 * s,
      color: TEXT,
      fontWeight: "900",
    },

    sectionHeader: {
      marginBottom: 10,
      marginTop: 2,
    },

    sectionTitle: {
      fontSize: 18 * s,
      fontWeight: "900",
      color: TEXT,
      letterSpacing: -0.2,
    },

    card: {
      borderWidth: 1,
      borderColor: BORDER,
      borderRadius: 20,
      backgroundColor: CARD_BG,
      overflow: "hidden",
      marginBottom: 18,
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },

    row: {
      paddingHorizontal: 14,
      paddingVertical: 15,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },

    rowLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      flex: 1,
      paddingRight: 10,
    },

    iconBox: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: ACCENT_SOFT,
      alignItems: "center",
      justifyContent: "center",
    },

    rowTitle: {
      fontSize: 13.5 * s,
      fontWeight: "900",
      color: TEXT,
    },

    rowSub: {
      marginTop: 4,
      fontSize: 11.3 * s,
      color: TEXT_SUB,
      fontWeight: "700",
      lineHeight: 16,
    },

    divider: {
      height: 1,
      backgroundColor: DIVIDER,
      marginLeft: 64,
    },

    signOut: {
      marginTop: 2,
      borderRadius: 18,
      backgroundColor: DANGER_BG,
      paddingVertical: 15,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: DANGER_BG,
      flexDirection: "row",
      gap: 10,
    },

    signOutText: {
      color: DANGER,
      fontWeight: "900",
      fontSize: 13.5 * s,
    },

    version: {
      marginTop: 14,
      textAlign: "center",
      color: CHEVRON,
      fontSize: 11 * s,
      fontWeight: "700",
    },

    modalBackdrop: {
      flex: 1,
      backgroundColor: MODAL_BACKDROP,
      justifyContent: "flex-end",
    },

    modalKeyboardWrap: {
      width: "100%",
    },

    modalCard: {
      backgroundColor: CARD_BG,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 24,
      borderWidth: 1,
      borderColor: BORDER,
    },

    modalHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 14,
    },

    modalTitle: {
      fontSize: 18 * s,
      fontWeight: "900",
      color: TEXT,
    },

    modalCloseBtn: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: MUTED,
      alignItems: "center",
      justifyContent: "center",
    },

    inputLabel: {
      marginBottom: 6,
      marginTop: 10,
      fontSize: 12.5 * s,
      fontWeight: "800",
      color: TEXT,
    },

    input: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: MUTED,
      paddingHorizontal: 14,
      color: TEXT,
      fontSize: 14 * s,
      fontWeight: "700",
    },

    modalActions: {
      flexDirection: "row",
      gap: 10,
      marginTop: 20,
    },

    modalSecondaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: BORDER,
      backgroundColor: MUTED,
      alignItems: "center",
      justifyContent: "center",
    },

    modalSecondaryText: {
      color: TEXT,
      fontWeight: "900",
      fontSize: 13 * s,
    },

    modalPrimaryBtn: {
      flex: 1,
      minHeight: 48,
      borderRadius: 14,
      backgroundColor: ACCENT,
      alignItems: "center",
      justifyContent: "center",
    },

    modalPrimaryText: {
      color: "#fff",
      fontWeight: "900",
      fontSize: 13 * s,
    },
  };
}