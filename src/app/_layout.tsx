import { Stack } from "expo-router";
import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "../context/ThemeContext";
import { subscribeToScheduledTasks, executeScheduledTask, addIntelligenceLog } from "../services/ciroService";
import { sendEmergencyReminder } from "../services/notificationService";

function RootLayoutContent() {
  const { isDark } = useTheme();

  useEffect(() => {
    let activeTasks: any[] = [];

    const unsub = subscribeToScheduledTasks((tasks) => {
      activeTasks = tasks;
      checkAndRunTasks();
    });

    const checkAndRunTasks = async () => {
      const now = Date.now();
      const readyTasks = activeTasks.filter(t => t.status === "pending" && t.scheduledFor <= now);

      for (const task of readyTasks) {
        task.status = "executed"; // prevent double-run locally
        console.log(`🎯 CIRO Mobile Warden: Targeted time reached for ${task.data.name}. Dispatching now.`);
        try {
          await executeScheduledTask(task.id);
          const result = await sendEmergencyReminder(task.targetPhone, task.targetEmail, task.data);
          const status = (result.email?.success || result.whatsapp?.success) ? "SUCCESS" : "FAILED";
          await addIntelligenceLog({
            agentName: "StrategistAgent",
            thought: `SURGICAL_DISPATCH: Target time reached. Medicine [${task.data.name}] sent to ${task.targetPhone}.`,
            confidence: 1.0,
            action: status === "SUCCESS" ? "TASK_EXECUTED" : "NOTIFICATION_FAILED"
          });
        } catch (e) {
          console.error("Mobile warden dispatch error:", e);
        }
      }
    };

    const interval = setInterval(checkAndRunTasks, 1000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={isDark ? "#020617" : "#f8fafc"}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="patient" />
        <Stack.Screen name="doctor" />
        <Stack.Screen name="emergency" />
        <Stack.Screen name="ciro" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
