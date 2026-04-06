//app/(user)/legal.tsx
// This screen provides users with important information about data collection, usage, and legal disclaimers related to the Mufashe app. It ensures transparency and helps users understand their rights and how their data is handled.

import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

export default function LegalScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>

        {/* HEADER */}
        <View style={styles.header}>
          <Ionicons name="chevron-back" size={22} onPress={() => router.back()} />
          <Text style={styles.title}>Privacy & Legal</Text>
        </View>

        {/* SECTION 1 */}
        <Text style={styles.sectionTitle}>1. Data Collection</Text>
        <Text style={styles.text}>
          Mufashe collects only necessary information such as your questions and basic account details.
          We do not collect sensitive personal data without your consent.
        </Text>

        {/* SECTION 2 */}
        <Text style={styles.sectionTitle}>2. Use of Data</Text>
        <Text style={styles.text}>
          Your data is used to provide accurate legal information and improve system performance.
        </Text>

        {/* SECTION 3 */}
        <Text style={styles.sectionTitle}>3. AI Disclaimer</Text>
        <Text style={styles.text}>
          Mufashe provides AI-generated legal information and does not replace professional legal advice.
          Always consult a qualified lawyer for important decisions.
        </Text>

        {/* SECTION 4 */}
        <Text style={styles.sectionTitle}>4. User Rights</Text>
        <Text style={styles.text}>
          You have the right to access, update, or delete your data at any time.
        </Text>

        {/* SECTION 5 */}
        <Text style={styles.sectionTitle}>5. Data Protection</Text>
        <Text style={styles.text}>
          We use secure storage and authentication systems to protect your data from unauthorized access.
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#fff" },
  container: { padding: 20 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },

  title: {
    fontSize: 18,
    fontWeight: "bold",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 15,
  },

  text: {
    fontSize: 14,
    color: "#555",
    marginTop: 5,
    lineHeight: 20,
  },
});