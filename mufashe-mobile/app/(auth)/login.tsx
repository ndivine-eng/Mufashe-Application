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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { loginUser } from "../lib/auth";

export default function LoginScreen() {
  // ===============================
  // STATE
  // ===============================
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ===============================
  // VALIDATION
  // ===============================
  const canSubmit = useMemo(() => {
    return identifier.trim().length >= 3 && password.length >= 6 && !loading;
  }, [identifier, password, loading]);

  // ===============================
  // LOGIN HANDLER
  // ===============================
  const onLogin = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);
      setError("");

      const emailOrPhone = identifier.trim();

      // ✅ Call backend login
      const result = await loginUser({
        emailOrPhone,
        password,
      });

      // ✅ Role-based navigation
      const role = String(result?.user?.role || "").toLowerCase();

      if (role === "admin") {
        router.replace("/(user)/admin-dashboard");
      } else {
        router.replace("/(user)/dashboard");
      }
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.message ||
          "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* ===============================
            HEADER / LOGO
        =============================== */}
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

        {/* ===============================
            IDENTIFIER INPUT
        =============================== */}
        <Text style={styles.label}>EMAIL / PHONE / NAME</Text>
        <View style={styles.inputWrap}>
          <Feather name="user" size={16} color="#6B7280" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="email, phone, or username"
            placeholderTextColor="#9CA3AF"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
          />
        </View>

        {/* ===============================
            PASSWORD INPUT
        =============================== */}
        <Text style={[styles.label, { marginTop: 14 }]}>PASSWORD</Text>
        <View style={styles.inputWrap}>
          <Feather name="lock" size={16} color="#6B7280" style={styles.icon} />
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />

          <TouchableOpacity
            onPress={() => setShowPass((v) => !v)}
            activeOpacity={0.8}
          >
            <Feather
              name={showPass ? "eye-off" : "eye"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {/* ===============================
            ERROR
        =============================== */}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* ===============================
            LOGIN BUTTON
        =============================== */}
        <TouchableOpacity
          style={[styles.primaryBtn, !canSubmit && styles.primaryDisabled]}
          onPress={onLogin}
          disabled={!canSubmit}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Login</Text>
          )}
        </TouchableOpacity>

        {/* ===============================
            REGISTER LINK
        =============================== */}
        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Don't have an account?</Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/Register")}>
            <Text style={styles.bottomLink}> Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ===============================
// STYLES
// ===============================
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 10 },

  header: { alignItems: "center", marginTop: 6, marginBottom: 10 },
  logoBox: {
    width: 86,
    height: 86,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { width: 60, height: 60 },
  tagline: { marginTop: 10, color: "#64748B", fontWeight: "600", fontSize: 13 },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
  },

  label: {
    fontSize: 11,
    color: "#6B7280",
    fontWeight: "800",
    letterSpacing: 0.7,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F9FAFB",
    marginTop: 8,
  },

  icon: { marginRight: 8 },

  input: { flex: 1, fontSize: 14, color: "#111827" },

  error: {
    marginTop: 8,
    color: "#DC2626",
    fontWeight: "700",
    fontSize: 12,
  },

  primaryBtn: {
    backgroundColor: "#0F3D63",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 18,
  },

  primaryDisabled: { opacity: 0.5 },

  primaryText: {
    color: "#ffffff",
    fontWeight: "900",
    fontSize: 15,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 16,
  },

  bottomText: { color: "#6B7280", fontWeight: "600" },
  bottomLink: { color: "#16A34A", fontWeight: "900" },
});