import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  Pressable,
  useColorScheme,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Activity,
  Bell,
  Sun,
  Moon,
  Shield,
  Zap,
  Globe,
  TrendingUp,
  MapPin,
  Cpu,
  Network,
  Terminal,
  FileText,
  Truck,
  Layers,
  Smartphone,
  CheckCircle,
  Wifi,
} from "lucide-react-native";

import Map from "../components/ui/Map";
import BottomNav from "../components/ui/BottomNav";

const { width } = Dimensions.get("window");

import { useTheme } from "../context/ThemeContext";
import { subscribeToAllCases } from "../services/caseService";
import { 
  subscribeToAllIntelligence, 
  subscribeToScheduledTasks, 
  executeScheduledTask, 
  addIntelligenceLog 
} from "../services/ciroService";
import { sendEmergencyReminder } from "../services/notificationService";
import type { PatientCase, IntelligenceLog, ScheduledTask } from "../types";

export default function CiroIntelligenceScreen() {
  const { isDark, toggleTheme } = useTheme();

  const [cases, setCases] = useState<PatientCase[]>([]);
  const [logs, setLogs] = useState<IntelligenceLog[]>([]);
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledTask[]>([]);

  // Pulse effect simulation state
  const [pulseTime, setPulseTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setPulseTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const unsubCases = subscribeToAllCases((data) => setCases(data));
    const unsubLogs = subscribeToAllIntelligence((data) => setLogs(data));
    const unsubTasks = subscribeToScheduledTasks((data) => setScheduledTasks(data));

    return () => {
      unsubCases();
      unsubLogs();
      unsubTasks();
    };
  }, []);

  const getAgentLogsText = (agentName: string) => {
    const filtered = logs.filter(log => log.agentName === agentName).slice(0, 5);
    if (filtered.length === 0) return "> Standing by for signals...";
    return filtered.map(log => {
      if (log.action) return `[${log.action}] ${log.thought}`;
      return `> ${log.thought}`;
    }).join("\n\n");
  };

  const getOrchestratorLogs = () => {
    const filtered = logs.filter((log) => log.agentName === "Orchestrator");
    const unique: IntelligenceLog[] = [];
    const seenThoughts = new Set<string>();

    for (const log of filtered) {
      const cleanThought = log.thought.trim().toLowerCase();
      if (!seenThoughts.has(cleanThought)) {
        seenThoughts.add(cleanThought);
        unique.push(log);
      }
    }
    return unique.slice(0, 4);
  };

  const orchestratorLogs = getOrchestratorLogs();

  const criticalCount = logs.filter(
    (l) => l.agentName === "TriageAgent" && l.action?.includes("CRITICAL")
  ).length;

  const handleForceTask = async (task: ScheduledTask) => {
    try {
      await executeScheduledTask(task.id);
      
      const targetEmail = task.targetEmail || "syedasim2021@gmail.com";
      const result = await sendEmergencyReminder(task.targetPhone, targetEmail, task.data);
      
      const status = (result.email?.success || result.whatsapp?.success) ? "SUCCESS" : "FAILED";
      
      await addIntelligenceLog({
        agentName: "Orchestrator",
        thought: `MANUAL_OVERRIDE: User forced dispatch for ${task.data.name}. Processing immediate transmission...`,
        confidence: 1.0,
        action: "TASK_EXECUTED"
      });

      Alert.alert(
        "Task Dispatched",
        `Medication reminder for ${task.data.name} has been manually forced and sent successfully to ${targetEmail}.`
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Execution Failed", "Failed to force dispatch the scheduled task.");
    }
  };

  const latestCase = cases[0];
  const mapLat = latestCase ? latestCase.latitude : 33.9748;
  const mapLng = latestCase ? latestCase.longitude : 71.4500;
  const mapAddress = latestCase ? (latestCase.address || "Locked GPS Coordinate") : "Triage Lockout Range G-10 Corridor";

  // Color Palette Definitions matching sleek high-fidelity style
  const colors = {
    background: isDark ? "#020617" : "#f8fafc",
    cardBg: isDark ? "#0f172a" : "#ffffff",
    cardBorder: isDark ? "#1e293b" : "#e2e8f0",
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#64748b",
    redAccent: "#ef4444",
    blueAccent: "#3b82f6",
    purpleAccent: "#8b5cf6",
    emeraldAccent: "#10b981",
    inputBg: isDark ? "#1e293b50" : "#f1f5f9",
    purpleLight: isDark ? "#2e1065" : "#f3e8ff",
    redLight: isDark ? "#450a0a" : "#fef2f2",
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Top Header Bar matching emergency screen top bar layout */}
      <View style={[styles.customTopHeader, { backgroundColor: colors.cardBg, borderBottomColor: colors.cardBorder }]}>
        <View style={styles.headerBrand}>
          <View style={styles.logoRedBox}>
            <Activity size={16} color="#ffffff" strokeWidth={2.5} />
          </View>
          <View style={styles.brandTextColumn}>
            <Text style={[styles.brandName, { color: colors.textPrimary }]}>MediLink</Text>
            <Text style={styles.brandSub}>EMERGENCY RESPONSE</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Pressable onPress={toggleTheme} style={styles.themeToggleBtn}>
            {isDark ? <Sun size={20} color="#f1f5f9" /> : <Moon size={20} color="#64748b" />}
          </Pressable>
          <Pressable style={styles.bellBtn}>
            <Bell size={20} color="#64748b" />
            <View style={styles.bellDot} />
          </Pressable>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>M</Text>
          </View>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Page Main Brand / Header Title matching Image 1 */}
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>
            CIRO <Text style={{ color: "#8b5cf6" }}>Intelligence</Text>
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            Autonomous Crisis Intelligence & Multi-Agent Response Orchestrator
          </Text>

          {/* Pulse Active Badge */}
          <View style={styles.pulseBadgeContainer}>
            <View style={styles.pulseIndicatorRow}>
              <View style={styles.livePulseDot} />
              <Text style={styles.pulseText}>
                SYSTEM PULSE SCANNING_ACTIVE // {pulseTime} AM
              </Text>
            </View>
            <Pressable style={[styles.globeIconBtn, { borderColor: colors.cardBorder, backgroundColor: colors.cardBg }]}>
              <Globe size={13} color={colors.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* 4 Premium Metric Grid Cards matching Image 1 */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricsRow}>
            {/* Card 1: Active Crises */}
            <View style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: colors.redAccent, borderLeftWidth: 4 }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#fef2f2" }]}>
                  <Activity size={14} color={colors.redAccent} />
                </View>
                <Text style={styles.metricLabel}>ACTIVE CRISES</Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>35</Text>
            </View>

            {/* Card 2: Signals Ingested */}
            <View style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: colors.blueAccent, borderLeftWidth: 4 }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#eff6ff" }]}>
                  <TrendingUp size={14} color={colors.blueAccent} />
                </View>
                <Text style={styles.metricLabel}>SIGNALS INGESTED</Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>656</Text>
            </View>
          </View>

          <View style={styles.metricsRow}>
            {/* Card 3: Agent Confidence */}
            <View style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: colors.purpleAccent, borderLeftWidth: 4 }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#f5f3ff" }]}>
                  <Shield size={14} color={colors.purpleAccent} />
                </View>
                <Text style={styles.metricLabel}>AGENT CONFIDENCE</Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>94.2%</Text>
            </View>

            {/* Card 4: System Uptime */}
            <View style={[styles.metricCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor: "#0ea5e9", borderLeftWidth: 4 }]}>
              <View style={styles.metricHeader}>
                <View style={[styles.metricIconWrap, { backgroundColor: "#f0f9ff" }]}>
                  <Zap size={14} color="#0ea5e9" />
                </View>
                <Text style={styles.metricLabel}>SYSTEM UPTIME</Text>
              </View>
              <Text style={[styles.metricValue, { color: colors.textPrimary }]}>99.99%</Text>
            </View>
          </View>
        </View>

        {/* Live GPS Map Card widget matching Image 1 */}
        <View style={[styles.mapSectionCard, { borderColor: colors.cardBorder }]}>
          <Map
            latitude={mapLat}
            longitude={mapLng}
            title={latestCase ? `Active Signal: ${latestCase.patientPhone}` : "Active Patient Signal Lock"}
            description={mapAddress}
          />
          {/* Coordinate overlay precisely styled like Image 1 */}
          <View style={styles.mapGpsOverlay}>
            <Text style={styles.mapGpsOverlayText}>LAT: {mapLat.toFixed(6)}</Text>
            <Text style={styles.mapGpsOverlayText}>LNG: {mapLng.toFixed(6)}</Text>
          </View>

          {/* Realtime Tracking Badge overlay */}
          <View style={styles.mapStatusOverlayBadge}>
            <View style={styles.statusBadgePulseDot} />
            <Text style={styles.statusBadgeText}>● REALTIME_GPS_TRACKING_ON</Text>
          </View>
        </View>

        {/* Signal Feed List matching Image 1 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Signal Feed</Text>
        </View>

        <View style={styles.signalList}>
          {cases.length === 0 ? (
            <View style={[styles.signalCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, padding: 20, alignItems: "center", justifyContent: "center" }]}>
              <Text style={[styles.signalName, { color: colors.textSecondary }]}>No Active Signals Detected</Text>
            </View>
          ) : (
            cases.slice(0, 3).map((c, i) => {
              const isCritical = c.severity === "critical" || c.severity === "high";
              const borderLeftColor = isCritical ? colors.redAccent : colors.blueAccent;
              const badgeBg = isCritical ? "#fee2e2" : "#e0f2fe";
              const badgeText = isCritical ? "#dc2626" : "#0369a1";

              return (
                <View key={c.id || i} style={[styles.signalCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, borderLeftColor, borderLeftWidth: 4 }]}>
                  <View style={[styles.signalIconCircle, { backgroundColor: isCritical ? "#fef2f2" : "#eff6ff" }]}>
                    <Layers size={13} color={isCritical ? colors.redAccent : colors.blueAccent} />
                  </View>
                  <View style={styles.signalDetails}>
                    <Text style={[styles.signalName, { color: colors.textPrimary }]}>
                      Signal: {c.address?.split(',')[0] || "Unknown Location"}
                    </Text>
                    <Text style={styles.signalSub}>Credibility: 98%  •  Source: Patient_Portal_Signal</Text>
                  </View>
                  <View style={[styles.badgePill, { backgroundColor: badgeBg }]}>
                    <Text style={[styles.badgePillText, { color: badgeText }]}>{c.severity.toUpperCase()}</Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Active Queue Section matching Image 1 */}
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Active Queue</Text>
        </View>

        <View style={styles.signalList}>
          {scheduledTasks.length === 0 ? (
            <View style={[styles.signalCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, padding: 20, alignItems: "center", justifyContent: "center" }]}>
              <Text style={[styles.signalName, { color: colors.textSecondary }]}>No Pending Tasks</Text>
            </View>
          ) : (
            scheduledTasks.slice(0, 3).map((task, i) => {
              const timeStr = new Date(task.scheduledFor).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isToday = new Date(task.scheduledFor).toDateString() === new Date().toDateString();

              return (
                <View key={task.id || i} style={[styles.activeQueueCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder, marginBottom: 8, width: "100%" }]}>
                  <View style={styles.queueCardHeader}>
                    <View style={styles.queueBadge}>
                      <Text style={styles.queueBadgeText}>QUEUED REMINDER</Text>
                    </View>
                    <View style={styles.queueTimeCol}>
                      <Text style={styles.queueTime}>{timeStr}</Text>
                      <Text style={styles.queueDay}>{isToday ? "TODAY" : "TOMORROW"}</Text>
                    </View>
                  </View>

                  <View style={styles.queueCardBody}>
                    <View style={[styles.queueIconBox, { backgroundColor: "#eff6ff" }]}>
                      <FileText size={16} color={colors.blueAccent} />
                    </View>
                    <View style={styles.queueTextCol}>
                      <Text style={[styles.queueMedName, { color: colors.textPrimary }]}>{task.data.name}</Text>
                      <Text style={[styles.queuePhone, { color: colors.textSecondary }]}>{task.targetPhone}</Text>
                    </View>
                    <Pressable onPress={() => handleForceTask(task)} style={styles.forceBtn}>
                      <Zap size={10} color="#3b82f6" />
                      <Text style={styles.forceBtnText}>FORCE</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* -------------------- IMAGE 2: THE ORCHESTRATOR MASTER CONTROL NODE -------------------- */}
        
        <View style={styles.orchestratorSpacerLine} />
        
        <View style={styles.orchestratorHero}>
          <View style={styles.orchestratorIconCircle}>
            <Network size={28} color="#8b5cf6" />
          </View>
          <Text style={styles.orchestratorTitle}>THE ORCHESTRATOR</Text>
          <Text style={styles.orchestratorSubtitle}>MASTER CONTROL NODE</Text>
        </View>

        {/* Dynamic Multi-Agent Control Streams Timeline List */}
        <View style={styles.orchestratorTimeline}>
          
          {/* Connector line 1 */}
          <View style={styles.verticalConnector} />

          {/* Node 1: Synthesizing Multi-Agent streams */}
          <View style={[styles.orchestratorCard, { backgroundColor: isDark ? "#2e106520" : "#f5f3ff", borderColor: "#c084fc" }]}>
            <View style={styles.orchestratorCardHeader}>
              <Text style={[styles.orchStreamLabel, { color: "#7e22ce" }]}>SYNTHESIZING MULTI-AGENT DATA STREAMS...</Text>
              <View style={styles.activeSynapseBadge}>
                <Text style={styles.activeSynapseBadgeText}>ACTIVE_SYNAPSE</Text>
              </View>
            </View>
            {orchestratorLogs.length === 0 ? (
              <View style={styles.orchInnerItem}>
                <Text style={[styles.orchBodyText, { color: colors.textSecondary }]}>&gt; Standing by for signals...</Text>
              </View>
            ) : (
              orchestratorLogs.map((log, i) => {
                const isCrisis = log.action?.includes("CRISIS") || log.action?.includes("UPGRADE");
                return (
                  <View key={log.id || i} style={[styles.orchInnerItem, i > 0 && { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: isDark ? "#4b5563" : "#d8b4fe", paddingTop: 8 }]}>
                    <View style={styles.orchIndicatorRow}>
                      {log.action && (
                        <View style={[styles.innerBadge, { backgroundColor: isCrisis ? "#ef4444" : log.action === "TASK_EXECUTED" ? "#8b5cf6" : "#3b82f6" }]}>
                          <Text style={styles.innerBadgeText}>{log.action}</Text>
                        </View>
                      )}
                      <Text style={styles.orchTimestamp}>
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={[styles.orchBodyText, { color: colors.textPrimary }, isCrisis && { color: "#ef4444", fontWeight: "bold" }]}>
                      {log.thought}
                    </Text>
                  </View>
                );
              })
            )}
          </View>

          {/* Connector line 2 */}
          <View style={styles.verticalConnector} />

          {/* Node 2: Intel Stream */}
          <View style={[styles.orchestratorCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.orchestratorCardHeader}>
              <View style={styles.agentHeadingRow}>
                <Terminal size={12} color="#10b981" />
                <Text style={[styles.agentStreamName, { color: colors.textPrimary }]}>INTEL_STREAM</Text>
              </View>
              <Text style={styles.streamSpecLabel}>Tx: 4.2GB/s</Text>
            </View>
            <View style={styles.agentDetailsBox}>
              <Text style={[styles.agentMainTitle, { color: "#10b981" }]}>IntelAgent Feed...</Text>
              <Text style={[styles.agentMainBody, { color: colors.textPrimary }]}>
                {getAgentLogsText("IntelAgent")}
              </Text>
            </View>
            <View style={styles.orchestratorCommandFooter}>
              <Text style={styles.orchCommandText}>
                <Zap size={8} color="#8b5cf6" /> ORCHESTRATOR COMMAND
              </Text>
              <Text style={[styles.orchCommandDesc, { color: colors.textPrimary }]}>
                "Focus all surveillance on the northwest corridor."
              </Text>
            </View>
          </View>

          {/* Connector line 3 */}
          <View style={styles.verticalConnector} />

          {/* Node 3: Log Supply */}
          <View style={[styles.orchestratorCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.orchestratorCardHeader}>
              <View style={styles.agentHeadingRow}>
                <Truck size={12} color={colors.blueAccent} />
                <Text style={[styles.agentStreamName, { color: colors.textPrimary }]}>LOG_SUPPLY</Text>
              </View>
              <Text style={styles.streamSpecLabel}>RESOURCES: 88%</Text>
            </View>
            <View style={styles.agentDetailsBox}>
              <Text style={[styles.agentMainTitle, { color: colors.blueAccent }]}>LogisticsAgent Routing...</Text>
              <Text style={[styles.agentMainBody, { color: colors.textPrimary }]}>
                {getAgentLogsText("LogisticsAgent")}
              </Text>
            </View>
            <View style={styles.orchestratorCommandFooter}>
              <Text style={styles.orchCommandText}>
                <Zap size={8} color="#8b5cf6" /> ORCHESTRATOR COMMAND
              </Text>
              <Text style={[styles.orchCommandDesc, { color: colors.textPrimary }]}>
                "Accelerate the deployment of Unit Alpha-4."
              </Text>
            </View>
          </View>

          {/* Connector line 4 */}
          <View style={styles.verticalConnector} />

          {/* Node 4: Triage Pulse (Red/alert box) */}
          <View style={[styles.orchestratorCard, { backgroundColor: isDark ? "#450a0a20" : "#fff5f5", borderColor: isDark ? "#7f1d1d50" : "#fca5a5" }]}>
            <View style={styles.orchestratorCardHeader}>
              <View style={styles.agentHeadingRow}>
                <Activity size={12} color="#dc2626" />
                <Text style={[styles.agentStreamName, { color: isDark ? colors.textPrimary : "#991b1b" }]}>TRIAGE_PULSE</Text>
              </View>
              <Text style={[styles.streamSpecLabel, { color: "#dc2626" }]}>CRITICAL: {criticalCount}</Text>
            </View>
            <View style={styles.agentDetailsBox}>
              <Text style={[styles.agentMainTitle, { color: "#dc2626" }]}>TriageAgent Vitals...</Text>
              <Text style={[styles.agentMainBody, { color: isDark ? colors.textPrimary : "#991b1b" }]}>
                {getAgentLogsText("TriageAgent")}
              </Text>
            </View>
            <View style={[styles.orchestratorCommandFooter, { backgroundColor: isDark ? "#7f1d1d30" : "#fee2e2" }]}>
              <Text style={[styles.orchCommandText, { color: "#dc2626" }]}>
                <Zap size={8} color="#dc2626" /> ORCHESTRATOR COMMAND
              </Text>
              <Text style={[styles.orchCommandDesc, { color: isDark ? colors.textPrimary : "#7f1d1d" }]}>
                "Escalate all critical cases to on-duty physicians immediately."
              </Text>
            </View>
          </View>

          {/* Connector line 5 */}
          <View style={styles.verticalConnector} />

          {/* Node 5: STRAT_ANALYSIS */}
          <View style={[styles.orchestratorCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.orchestratorCardHeader}>
              <View style={styles.agentHeadingRow}>
                <Smartphone size={12} color={colors.purpleAccent} />
                <Text style={[styles.agentStreamName, { color: colors.textPrimary }]}>STRAT_ANALYSIS</Text>
              </View>
              <Text style={styles.streamSpecLabel}>ACTIVE: {scheduledTasks.length}</Text>
            </View>
            <View style={styles.agentDetailsBox}>
              <Text style={[styles.agentMainTitle, { color: colors.purpleAccent }]}>StrategistAgent</Text>
              <Text style={[styles.agentMainBody, { color: colors.textPrimary }]}>
                {getAgentLogsText("StrategistAgent")}
              </Text>
            </View>
            <View style={styles.orchestratorCommandFooter}>
              <Text style={styles.orchCommandText}>
                <Zap size={8} color="#8b5cf6" /> ORCHESTRATOR COMMAND
              </Text>
              <Text style={[styles.orchCommandDesc, { color: colors.textPrimary }]}>
                "Maintain active tracking on EMS-09."
              </Text>
            </View>
          </View>

        </View>

      </ScrollView>

      {/* Bottom Nav bar active tab is ciro */}
      <BottomNav activeTab="ciro" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  customTopHeader: {
    flexDirection: "row",
    height: 60,
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoRedBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  brandTextColumn: {
    justifyContent: "center",
  },
  brandName: {
    fontSize: 14.5,
    fontWeight: "900",
  },
  brandSub: {
    fontSize: 8.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  themeToggleBtn: {
    padding: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  bellBtn: {
    position: "relative",
    padding: 4,
  },
  bellDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#dc2626",
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  scrollContent: {
    paddingBottom: 110,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 11.5,
    fontWeight: "500",
    marginTop: 6,
    lineHeight: 16,
  },
  pulseBadgeContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  pulseIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  livePulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#2563eb",
  },
  pulseText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563eb",
    letterSpacing: 0.3,
  },
  globeIconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  metricsContainer: {
    paddingHorizontal: 20,
    marginTop: 18,
    gap: 10,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  metricLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "900",
    marginTop: 8,
  },
  mapSectionCard: {
    marginHorizontal: 20,
    marginTop: 18,
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    position: "relative",
  },
  mapGpsOverlay: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  mapGpsOverlayText: {
    color: "#cbd5e1",
    fontSize: 8.5,
    fontWeight: "700",
    fontFamily: "monospace",
    lineHeight: 12,
  },
  mapStatusOverlayBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusBadgePulseDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#3b82f6",
  },
  statusBadgeText: {
    color: "#3b82f6",
    fontSize: 7.5,
    fontWeight: "800",
  },
  sectionHeaderRow: {
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14.5,
    fontWeight: "900",
  },
  signalList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  signalCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  signalIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  signalDetails: {
    flex: 1,
  },
  signalName: {
    fontSize: 11.5,
    fontWeight: "800",
  },
  signalSub: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 3,
    fontWeight: "600",
  },
  badgePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 8.5,
    fontWeight: "900",
  },
  activeQueueCard: {
    marginHorizontal: 20,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  queueCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 8,
    marginBottom: 10,
  },
  queueBadge: {
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  queueBadgeText: {
    color: "#2563eb",
    fontSize: 8,
    fontWeight: "800",
  },
  queueTimeCol: {
    alignItems: "flex-end",
  },
  queueTime: {
    fontSize: 10,
    fontWeight: "900",
    color: "#2563eb",
  },
  queueDay: {
    fontSize: 7.5,
    fontWeight: "800",
    color: "#64748b",
    marginTop: 1,
  },
  queueCardBody: {
    flexDirection: "row",
    alignItems: "center",
  },
  queueIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  queueTextCol: {
    flex: 1,
  },
  queueMedName: {
    fontSize: 11.5,
    fontWeight: "900",
  },
  queuePhone: {
    fontSize: 9.5,
    fontWeight: "600",
    marginTop: 2,
  },
  forceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#bfdbfe",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  forceBtnText: {
    color: "#3b82f6",
    fontSize: 9,
    fontWeight: "900",
  },

  // CONNECTOR STYLING BETWEEN FIRST SECTION AND THE ORCHESTRATOR
  orchestratorSpacerLine: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginHorizontal: 20,
    marginTop: 28,
  },
  orchestratorHero: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 10,
  },
  orchestratorIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#f5f3ff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd6fe",
    marginBottom: 10,
  },
  orchestratorTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: 0.5,
  },
  orchestratorSubtitle: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#8b5cf6",
    letterSpacing: 0.8,
    marginTop: 4,
  },
  orchestratorTimeline: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  verticalConnector: {
    width: 1,
    height: 20,
    backgroundColor: "#c084fc",
    alignSelf: "center",
  },
  orchestratorCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  orchestratorCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  orchStreamLabel: {
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  activeSynapseBadge: {
    backgroundColor: "#7e22ce",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  activeSynapseBadgeText: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "900",
  },
  orchInnerItem: {
    backgroundColor: "#ffffff50",
    borderRadius: 8,
    padding: 8,
  },
  orchIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  innerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  innerBadgeText: {
    color: "#ffffff",
    fontSize: 7.5,
    fontWeight: "900",
  },
  orchTimestamp: {
    fontSize: 8.5,
    fontWeight: "600",
    color: "#6b21a8",
  },
  orchBodyText: {
    fontSize: 10.5,
    fontWeight: "500",
    color: "#581c87",
    lineHeight: 14,
  },
  agentHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  agentStreamName: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  streamSpecLabel: {
    fontSize: 8.5,
    fontWeight: "700",
    color: "#64748b",
  },
  agentDetailsBox: {
    paddingVertical: 4,
  },
  agentMainTitle: {
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4,
  },
  agentMainBody: {
    fontSize: 10.5,
    fontWeight: "600",
    lineHeight: 14.5,
  },
  orchestratorCommandFooter: {
    marginTop: 8,
    backgroundColor: "#f8fafc",
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  orchCommandText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#8b5cf6",
    letterSpacing: 0.5,
  },
  orchCommandDesc: {
    fontSize: 10,
    fontStyle: "italic",
    fontWeight: "700",
    marginTop: 4,
  },
});
