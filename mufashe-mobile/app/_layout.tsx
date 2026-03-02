// app/_layout.tsx
import React from "react";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { AppSettingsProvider, useAppSettings } from "./lib/appSettings";

export const unstable_settings = {
  anchor: "(tabs)",
};

function InnerLayout() {
  const { settings } = useAppSettings();

  const navTheme = settings.themeMode === "dark" ? DarkTheme : DefaultTheme;
  const statusStyle = settings.themeMode === "dark" ? "light" : "dark";

  return (
    <ThemeProvider value={navTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>

      <StatusBar style={statusStyle} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AppSettingsProvider>
      <InnerLayout />
    </AppSettingsProvider>
  );
}