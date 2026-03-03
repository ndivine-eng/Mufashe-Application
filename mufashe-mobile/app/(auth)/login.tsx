// app/(auth)/login.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { loginUser } from "../lib/auth";
import { useAppSettings } from "../lib/appSettings";

export default function LoginScreen() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return identifier.trim().length >= 3 && password.length >= 6 && !loading;
  }, [identifier, password, loading]);

  const onLogin = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);
      setError("");

      const emailOrPhone = identifier.trim();

      const result = await loginUser({ emailOrPhone, password });

      const role = String(result?.user?.role || "").toLowerCase();
      if (role === "admin") router.replace("/(user)/admin-dashboard");
      else router.replace("/(user)/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.container}>
          {/* Top bar */}
          <View style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
              <Ionicons name="chevron-back" size={20} color={theme.text} />
            </TouchableOpacity>

            <Text style={styles.topTitle}>Login</Text>

            <View style={{ width: 38 }} />
          </View>

          {/* Header / Logo */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
              <Image
                source={require("../../assets/images/splash-icon.png")}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.tagline}>Empowering Justice through AI</Text>
          </View>

          <Text style={styles.title}>Secure Login</Text>

          {/* Identifier */}
          <Text style={styles.label}>EMAIL / PHONE / NAME</Text>
          <View style={styles.inputWrap}>
            <View style={styles.inputIconBox}>
              <Ionicons name="person-outline" size={18} color={theme.textSub} />
            </View>

            <TextInput
              style={styles.input}
              placeholder="email, phone, or username"
              placeholderTextColor={theme.textSub}
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />
          </View>

          {/* Password */}
          <Text style={styles.label}>PASSWORD</Text>
          <View style={styles.inputWrap}>
            <View style={styles.inputIconBox}>
              <Ionicons name="lock-closed-outline" size={18} color={theme.textSub} />
            </View>

            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.textSub}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPass}
            />

            <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn} activeOpacity={0.8}>
              <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={theme.textSub} />
            </TouchableOpacity>
          </View>

          {/* Error */}
          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.primaryBtn, !canSubmit && styles.primaryDisabled]}
            onPress={onLogin}
            disabled={!canSubmit}
            activeOpacity={0.9}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Login</Text>}
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.bottomRow}>
            <Text style={styles.bottomText}>Don't have an account?</Text>
            <TouchableOpacity onPress={() => router.push("/(auth)/Register")} activeOpacity={0.9}>
              <Text style={styles.bottomLink}> Sign Up</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(theme: any, s: number) {
  const bg = theme?.bg ?? "#ffffff";
  const card = theme?.card ?? bg;
  const border = theme?.border ?? "#E5E7EB";
  const muted = theme?.muted ?? "#F3F4F6";
  const text = theme?.text ?? "#111827";
  const textSub = theme?.textSub ?? "#6B7280";
  const blue = theme?.blue ?? "#0F3D63";
  const danger = theme?.danger ?? "#DC2626";

  return {
    safe: { flex: 1, backgroundColor: bg },
    container: { flex: 1, paddingHorizontal: 22, paddingTop: 8 },

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
      backgroundColor: muted,
      alignItems: "center",
      justifyContent: "center",
    },
    topTitle: { fontSize: 14 * s, fontWeight: "900", color: text },

    header: { alignItems: "center", marginTop: 6, marginBottom: 10 },
    logoBox: {
      width: 86,
      height: 86,
      borderRadius: 16,
      backgroundColor: muted,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: border,
    },
    logo: { width: 60, height: 60 },
    tagline: { marginTop: 10, color: textSub, fontWeight: "700", fontSize: 13 * s },

    title: {
      fontSize: 22 * s,
      fontWeight: "900",
      color: text,
      textAlign: "center",
      marginTop: 6,
      marginBottom: 14,
    },

    label: { marginTop: 12, fontSize: 11 * s, color: textSub, fontWeight: "900", letterSpacing: 0.7 },

    inputWrap: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      backgroundColor: card,
      marginTop: 8,
    },
    inputIconBox: {
      width: 34,
      height: 34,
      borderRadius: 12,
      backgroundColor: muted,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    input: { flex: 1, fontSize: 14 * s, color: text },

    eyeBtn: { paddingLeft: 10, paddingVertical: 2 },

    errorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      padding: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: danger,
      backgroundColor: `${danger}10`,
    },
    errorText: { flex: 1, color: danger, fontWeight: "800", fontSize: 12 * s },

    primaryBtn: {
      backgroundColor: blue,
      paddingVertical: 14,
      borderRadius: 14,
      alignItems: "center",
      marginTop: 18,
    },
    primaryDisabled: { opacity: 0.55 },
    primaryText: { color: "#ffffff", fontWeight: "900", fontSize: 15 * s },

    bottomRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
    bottomText: { color: textSub, fontWeight: "700" },
    bottomLink: { color: theme?.blue ?? "#2563EB", fontWeight: "900" },
  };
}