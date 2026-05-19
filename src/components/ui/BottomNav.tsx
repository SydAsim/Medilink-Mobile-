import React from "react";
import { StyleSheet, View, Text, Pressable, Platform } from "react-native";
import { router } from "expo-router";
import {
  Heart,
  Stethoscope,
  Truck,
  TrendingUp,
} from "lucide-react-native";
import { useTheme } from "../../context/ThemeContext";

interface BottomNavProps {
  activeTab: "patient" | "doctor" | "emergency" | "ciro";
}

export default function BottomNav({ activeTab }: BottomNavProps) {
  const { isDark } = useTheme();

  const activeColor = "#2563eb";
  const inactiveColor = isDark ? "#64748b" : "#94a3b8";
  
  const bgColor = isDark ? "#0f172a" : "#ffffff";
  const borderColor = isDark ? "#1e293b" : "#f1f5f9";
  const activeBg = isDark ? "#1e3a8a" : "#eff6ff";

  const tabs = [
    {
      id: "patient" as const,
      label: "Patient Portal",
      path: "/patient",
      Icon: Heart,
    },
    {
      id: "doctor" as const,
      label: "Doctor Hub",
      path: "/doctor",
      Icon: Stethoscope,
    },
    {
      id: "emergency" as const,
      label: "Emergency Dispatch",
      path: "/emergency",
      Icon: Truck,
    },
    {
      id: "ciro" as const,
      label: "CIRO Intelligence",
      path: "/ciro",
      Icon: TrendingUp,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderTopColor: borderColor }]}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const color = isActive ? activeColor : inactiveColor;
        const Icon = tab.Icon;

        return (
          <Pressable
            key={tab.id}
            onPress={() => router.replace(tab.path as any)}
            style={styles.tab}
          >
            <View style={[
              styles.iconContainer,
              isActive && { backgroundColor: activeBg }
            ]}>
              <Icon size={20} color={color} strokeWidth={isActive ? 2.5 : 2} />
            </View>
            <Text style={[
              styles.label, 
              { color },
              isActive && { fontWeight: "800" }
            ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingVertical: 10,
    paddingBottom: Platform.OS === "ios" ? 22 : 12,
    justifyContent: "space-around",
    alignItems: "center",
    height: 75,
  },
  tab: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  label: {
    fontSize: 9,
    textAlign: "center",
    lineHeight: 11,
    fontWeight: "600",
  },
});
