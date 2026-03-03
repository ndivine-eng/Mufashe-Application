import React, { useMemo, useState, useRef, useEffect } from "react";
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
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { registerUser } from "../lib/auth";
import { useAppSettings } from "../lib/appSettings";

export default function RegisterScreen() {
  const { theme, scale } = useAppSettings();
  const styles = useMemo(() => StyleSheet.create(makeStyles(theme, scale)), [theme, scale]);
  const insets = useSafeAreaInsets();

  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState(""); // email OR phone
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ keyboard padding so bottom fields stay visible
  const [kbHeight, setKbHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvent as any, (e) => {
      setKbHeight(e?.endCoordinates?.height ?? 0);
      // small nudge so focused field shows
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    });

    const hideSub = Keyboard.addListener(hideEvent as any, () => setKbHeight(0));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const passwordsMatch = confirm.length === 0 ? true : confirm === password;

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

      await registerUser({
        name: fullName.trim(),
        emailOrPhone: identifier.trim(),
        password,
      });

      router.replace("/(user)/dashboard");
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
        >
          <ScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.container,
              // ✅ extra space when keyboard open so button/fields are not covered
              { paddingBottom: 22 + kbHeight },
            ]}
          >
            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} activeOpacity={0.9}>
                <Ionicons name="chevron-back" size={20} color={theme.text} />
              </TouchableOpacity>

              <Text style={styles.topTitle}>Create Account</Text>

              <View style={{ width: 38 }} />
            </View>

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

            {/* Form */}
            <View style={styles.form}>
              <FieldLabel label="FULL NAME" styles={styles} />
              <InputRow
                icon="id-card-outline"
                placeholder="Your names"
                value={fullName}
                onChangeText={setFullName}
                theme={theme}
                styles={styles}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <FieldLabel label="EMAIL OR PHONE NUMBER" styles={styles} />
              <InputRow
                icon="person-outline"
                placeholder="name@example.com or 07xx xxx xxx"
                value={identifier}
                onChangeText={setIdentifier}
                theme={theme}
                styles={styles}
                autoCapitalize="none"
                keyboardType="default"
                returnKeyType="next"
              />

              <FieldLabel label="PASSWORD" styles={styles} />
              <InputRow
                icon="lock-closed-outline"
                placeholder="Minimum 6 characters"
                value={password}
                onChangeText={setPassword}
                theme={theme}
                styles={styles}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                returnKeyType="next"
                right={
                  <TouchableOpacity onPress={() => setShowPass((v) => !v)} style={styles.eyeBtn} activeOpacity={0.8}>
                    <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color={theme.textSub} />
                  </TouchableOpacity>
                }
              />

              <FieldLabel label="CONFIRM PASSWORD" styles={styles} />
              <InputRow
                icon="checkmark-circle-outline"
                placeholder="Re-enter password"
                value={confirm}
                onChangeText={setConfirm}
                theme={theme}
                styles={styles}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                returnKeyType="done"
                right={
                  <TouchableOpacity
                    onPress={() => setShowConfirm((v) => !v)}
                    style={styles.eyeBtn}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={18} color={theme.textSub} />
                  </TouchableOpacity>
                }
              />

              {!passwordsMatch ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                  <Text style={styles.errorText}>Passwords do not match.</Text>
                </View>
              ) : null}

              {error ? (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={16} color={theme.danger} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.primaryBtn, !canSubmit && styles.primaryDisabled]}
                onPress={onSignup}
                disabled={!canSubmit}
                activeOpacity={0.9}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Create Account</Text>}
              </TouchableOpacity>

              {/* Bottom link */}
              <View style={styles.bottomRow}>
                <Text style={styles.bottomText}>Already have an account?</Text>
                <TouchableOpacity onPress={() => router.replace("/(auth)/login")} activeOpacity={0.9}>
                  <Text style={styles.bottomLink}> Login</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

/* ---------- Small components ---------- */

function FieldLabel({ label, styles }: { label: string; styles: any }) {
  return <Text style={styles.label}>{label}</Text>;
}

function InputRow(props: {
  icon: keyof typeof Ionicons.glyphMap;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: any;
  styles: any;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: any;
  right?: React.ReactNode;
  returnKeyType?: any;
}) {
  const { icon, placeholder, value, onChangeText, theme, styles, right, ...rest } = props;

  return (
    <View style={styles.inputWrap}>
      <View style={styles.inputIconBox}>
        <Ionicons name={icon} size={18} color={theme.textSub} />
      </View>

      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.textSub}
        value={value}
        onChangeText={onChangeText}
        autoCorrect={false}
        {...rest}
      />

      {right ? right : null}
    </View>
  );
}

/* ---------- Styles ---------- */

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
    container: { flexGrow: 1, paddingHorizontal: 22, paddingTop: 8 },

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

    form: { marginTop: 8 },

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
      marginTop: 10,
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