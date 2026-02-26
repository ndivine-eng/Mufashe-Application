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
import { registerUser } from "../lib/auth";

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState(""); // email OR phone
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return (
      fullName.trim().length >= 2 &&
      identifier.trim().length >= 3 &&
      password.length >= 6 &&
      confirm === password &&
      !loading
    );
  }, [fullName, identifier, password, confirm, loading]);

  const onSignup = async () => {
    if (!canSubmit) return;

    try {
      setLoading(true);
      setError("");

      const emailOrPhone = identifier.trim();

      await registerUser({
        name: fullName.trim(),
        emailOrPhone,
        password,
      });

      router.replace("/(user)/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Logo */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Image
              source={require("../../assets/images/splash-icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.tagline}>Create your MUFASHE account</Text>
        </View>

        <Text style={styles.title}>Sign Up</Text>

        {/* Full Name */}
        <Text style={styles.label}>FULL NAME</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>🪪</Text>
          <TextInput
            style={styles.input}
            placeholder="Your names"
            placeholderTextColor="#9CA3AF"
            value={fullName}
            onChangeText={setFullName}
          />
        </View>

        {/* Email / Phone */}
        <Text style={[styles.label, { marginTop: 14 }]}>EMAIL OR PHONE NUMBER</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>👤</Text>
          <TextInput
            style={styles.input}
            placeholder="name@example.com or 07xx xxx xxx"
            placeholderTextColor="#9CA3AF"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="default"
          />
        </View>

        {/* Password */}
        <Text style={[styles.label, { marginTop: 14 }]}>PASSWORD</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>🔒</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum 6 characters"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPass}
          />
          <TouchableOpacity
            onPress={() => setShowPass((v) => !v)}
            style={styles.eyeBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.eyeText}>{showPass ? "🙈" : "👁️"}</Text>
          </TouchableOpacity>
        </View>

        {/* Confirm */}
        <Text style={[styles.label, { marginTop: 14 }]}>CONFIRM PASSWORD</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.inputIcon}>✅</Text>
          <TextInput
            style={styles.input}
            placeholder="Re-enter password"
            placeholderTextColor="#9CA3AF"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPass}
          />
        </View>

        {confirm.length > 0 && confirm !== password ? (
          <Text style={styles.error}>Passwords do not match.</Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Sign up button */}
        <TouchableOpacity
          style={[styles.primaryBtn, !canSubmit && styles.primaryDisabled]}
          onPress={onSignup}
          disabled={!canSubmit}
          activeOpacity={0.9}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>Create Account</Text>
          )}
        </TouchableOpacity>

        {/* Bottom link */}
        <View style={styles.bottomRow}>
          <Text style={styles.bottomText}>Already have an account?</Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.bottomLink}> Login</Text>
          </TouchableOpacity>
        </View>

        {/* Back */}
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

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

  label: { fontSize: 11, color: "#6B7280", fontWeight: "800", letterSpacing: 0.7 },

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
  inputIcon: { marginRight: 8, fontSize: 14 },
  input: { flex: 1, fontSize: 14, color: "#111827" },

  eyeBtn: { paddingLeft: 10, paddingVertical: 2 },
  eyeText: { fontSize: 16 },

  error: { marginTop: 8, color: "#DC2626", fontWeight: "700", fontSize: 12 },

  primaryBtn: {
    backgroundColor: "#0F3D63",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 18,
    shadowColor: "#000",
    shadowOpacity: 0.10,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: "#ffffff", fontWeight: "900", fontSize: 15 },

  bottomRow: { flexDirection: "row", justifyContent: "center", marginTop: 16 },
  bottomText: { color: "#6B7280", fontWeight: "600" },
  bottomLink: { color: "#16A34A", fontWeight: "900" },

  backLink: { alignSelf: "center", marginTop: 14 },
  backText: { color: "#9CA3AF", fontWeight: "700" },
});
