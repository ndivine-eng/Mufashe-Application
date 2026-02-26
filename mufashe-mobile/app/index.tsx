import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, SafeAreaView } from "react-native";
import { router } from "expo-router";

export default function Landing() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        {/* Top logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require("../assets/images/splash-icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Middle card */}
        <View style={styles.heroCard}>
          <View style={styles.badge}>
            <Text style={styles.badgeIcon}>⚙️</Text>
          </View>
          <Text style={styles.badgeText}>AI JUSTICE ASSISTANT</Text>
          <View style={styles.badgeLine} />
        </View>

        {/* Text content */}
        <Text style={styles.title}>Your Rights, Simplified</Text>
        <Text style={styles.kny}>Uburenganzira bwawe, mu buryo bworoshye</Text>

        <Text style={styles.desc}>
          Mufashe uses advanced AI to help you navigate Rwandan law, understand your legal rights,
          and access justice instantly.
        </Text>

        {/* Buttons */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/(user)/dashboard")}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/(auth)/login")}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryText}>Login</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerIcon}>🛡️</Text>
          <Text style={styles.footerText}>Secure and confidential legal advice</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffffff" },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18 },

  logoWrap: { alignItems: "center", marginTop: 6, marginBottom: 14 },
  logo: { width: 120, height: 120 },

  heroCard: {
    height: 120,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    // subtle shadow (iOS + Android)
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E5EEF8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  badgeIcon: { fontSize: 16 },
  badgeText: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: "#0F3D63",
    fontWeight: "700",
    marginBottom: 6,
  },
  badgeLine: { width: 22, height: 3, borderRadius: 3, backgroundColor: "#16A34A" },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
    marginBottom: 6,
  },
  kny: {
    fontSize: 13,
    color: "#16A34A",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 14,
  },
  desc: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
    paddingHorizontal: 10,
  },

  primaryBtn: {
    backgroundColor: "#0F3D63",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  primaryText: { color: "#ffffff", fontWeight: "800", fontSize: 15 },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 12,
    backgroundColor: "#ffffff",
  },
  secondaryText: { color: "#0F3D63", fontWeight: "800", fontSize: 15 },

  footer: {
    marginTop: 18,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  footerIcon: { fontSize: 12 },
  footerText: { fontSize: 12, color: "#6B7280", fontWeight: "600" },
});
