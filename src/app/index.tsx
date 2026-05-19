import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  useColorScheme,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Heart,
  Stethoscope,
  ShieldAlert,
  Sun,
  Moon,
  Activity
} from "lucide-react-native";

const { width } = Dimensions.get("window");

import { useTheme } from "../context/ThemeContext";

export default function RoleSelectionScreen() {
  const { isDark, toggleTheme } = useTheme();

  // Colors mapping matching slate-950 and light styling
  const colors = {
    backgroundStart: isDark ? "#020617" : "#f8fafc",
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#475569",
    brandMedi: isDark ? "#f8fafc" : "#0f172a",
    brandLink: "#f97316", // Solid orange matching the reference
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.backgroundStart }]}>
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* Top Header Row with Custom Theme Switcher */}
        <View style={styles.topRow}>
          <Pressable
            onPress={toggleTheme}
            style={[styles.themeToggle, { backgroundColor: isDark ? "#1e293b" : "#e2e8f0" }]}
          >
            <View style={[styles.toggleCircle, { 
              backgroundColor: "#ffffff", 
              transform: [{ translateX: isDark ? 22 : 0 }] 
            }]} />
            <View style={styles.toggleIcons}>
              <Sun size={12} color={isDark ? "#94a3b8" : "#f59e0b"} />
              <Moon size={12} color={isDark ? "#38bdf8" : "#94a3b8"} style={{ marginLeft: 8 }} />
            </View>
          </Pressable>
        </View>

        {/* Squircle Logo Center */}
        <View style={styles.logoCenter}>
          <View style={styles.logoRedBox}>
            <Activity size={32} color="#ffffff" strokeWidth={2.5} />
            <View style={styles.logoPulseDot} />
          </View>
        </View>

        {/* Hero Branding */}
        <View style={styles.brandContainer}>
          <Text style={[styles.brandTitle, { color: colors.brandMedi }]}>
            Medi<Text style={{ color: colors.brandLink }}>Link</Text>
          </Text>
          <Text style={[styles.heroHeading, { color: colors.textPrimary }]}>
            AI-powered emergency medical response.
          </Text>
          <Text style={[styles.heroSubheading, { color: colors.textSecondary }]}>
            Every second counts.
          </Text>
        </View>

        {/* Interactive Pathway Cards (Redesigned with Solid Pastel Backgrounds) */}
        <View style={styles.cardsContainer}>
          
          {/* CARD 1: Patient Portal (Pastel Blue) */}
          <Pressable
            onPress={() => router.push("/patient")}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: isDark ? "#172554" : "#bfdbfe",
                borderColor: isDark ? "#1e40af" : "#93c5fd",
                opacity: pressed ? 0.95 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              }
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Heart 
                size={22} 
                color={isDark ? "#60a5fa" : "#1d4ed8"} 
                strokeWidth={2.5} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.cardTitle, { color: isDark ? "#dbeafe" : "#1e3a8a" }]}>
                Patient Portal
              </Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: isDark ? "#93c5fd" : "#1e3a8a" }]}>
              Report an emergency & get AI-powered triage instantly.
            </Text>
            <View style={styles.enterBtn}>
              <Text style={[styles.enterBtnText, { color: isDark ? "#172554" : "#1e3a8a" }]}>
                Enter Dashboard →
              </Text>
            </View>
          </Pressable>

          {/* CARD 2: Doctor Hub (Pastel Green) */}
          <Pressable
            onPress={() => router.push("/doctor")}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: isDark ? "#062f21" : "#bbf7d0",
                borderColor: isDark ? "#065f46" : "#86efac",
                opacity: pressed ? 0.95 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              }
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <Stethoscope 
                size={22} 
                color={isDark ? "#34d399" : "#047857"} 
                strokeWidth={2.5} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.cardTitle, { color: isDark ? "#d1fae5" : "#064e3b" }]}>
                Doctor Hub
              </Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: isDark ? "#6ee7b7" : "#064e3b" }]}>
              Review cases, AI analysis & coordinate patient care.
            </Text>
            <View style={styles.enterBtn}>
              <Text style={[styles.enterBtnText, { color: isDark ? "#062f21" : "#064e3b" }]}>
                Enter Dashboard →
              </Text>
            </View>
          </Pressable>

          {/* CARD 3: Emergency Dispatch (Pastel Orange) */}
          <Pressable
            onPress={() => router.push("/emergency")}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: isDark ? "#431407" : "#fed7aa",
                borderColor: isDark ? "#9a3412" : "#fdba74",
                opacity: pressed ? 0.95 : 1,
                transform: [{ scale: pressed ? 0.99 : 1 }],
              }
            ]}
          >
            <View style={styles.cardHeaderRow}>
              <ShieldAlert 
                size={22} 
                color={isDark ? "#fb923c" : "#c2410c"} 
                strokeWidth={2.5} 
                style={{ marginRight: 8 }} 
              />
              <Text style={[styles.cardTitle, { color: isDark ? "#ffedd5" : "#7c2d12" }]}>
                Emergency Dispatch
              </Text>
            </View>
            <Text style={[styles.cardSubtitle, { color: isDark ? "#fdba74" : "#7c2d12" }]}>
              Coordinate ambulances, track locations & manage response.
            </Text>
            <View style={styles.enterBtn}>
              <Text style={[styles.enterBtnText, { color: isDark ? "#431407" : "#7c2d12" }]}>
                Enter Dashboard →
              </Text>
            </View>
          </Pressable>

        </View>

        {/* Footer */}
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          MediLink Emergency Response Platform — Built for Hackathon 2026
        </Text>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 10,
    height: 30,
  },
  themeToggle: {
    width: 48,
    height: 24,
    borderRadius: 12,
    padding: 2,
    position: "relative",
    justifyContent: "center",
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleIcons: {
    flexDirection: "row",
    position: "absolute",
    left: 6,
    alignItems: "center",
    pointerEvents: "none",
  },
  logoCenter: {
    alignItems: "center",
    marginTop: 20,
    marginBottom: 15,
  },
  logoRedBox: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: "#dc2626", // Deep clinical red
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#dc2626",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  logoPulseDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22c55e", // Pulse indicator dot
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 25,
  },
  brandTitle: {
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.5,
  },
  heroHeading: {
    fontSize: 14,
    fontWeight: "700",
    marginTop: 8,
    textAlign: "center",
  },
  heroSubheading: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
  cardsContainer: {
    gap: 16,
    width: "100%",
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    marginBottom: 14,
  },
  enterBtn: {
    alignSelf: "flex-start",
    backgroundColor: "#ffffff", // Pure white button matching screenshot
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  enterBtnText: {
    fontSize: 12,
    fontWeight: "800",
  },
  footerText: {
    fontSize: 10.5,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 35,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
});
