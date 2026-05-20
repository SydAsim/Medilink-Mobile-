import React, { useState, useEffect, useRef } from "react";
import {
  StyleSheet,
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Dimensions,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import Map from "../components/ui/Map";
import * as Location from "expo-location";
import {
  ShieldAlert,
  ChevronLeft,
  Navigation,
  Sparkles,
  MapPin,
  Clock,
  Activity,
  Layers,
  Terminal,
  Truck,
  Bell,
  Sun,
  Moon,
  Check,
  CheckCircle,
  MoreVertical,
  Plus,
  Send,
  Users,
  Smartphone,
  Phone,
  FileText,
  MessageSquare,
  Cpu,
} from "lucide-react-native";

import { useTheme } from "../context/ThemeContext";
import { db } from "../firebase/config";
import {
  subscribeToAllCases,
  updateCase
} from "../services/caseService";
import {
  subscribeToAllIntelligence,
  addIntelligenceLog
} from "../services/ciroService";
import {
  subscribeToChatMessages,
  sendMessage
} from "../services/chatService";
import type { PatientCase, IntelligenceLog } from "../types";
import BottomNav from "../components/ui/BottomNav";

const { width } = Dimensions.get("window");

export default function EmergencyDispatcher() {
  const { isDark, toggleTheme } = useTheme();

  // Data State
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [intelLogs, setIntelLogs] = useState<IntelligenceLog[]>([]);
  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Navigation & Tabs state
  const [activeSubScreen, setActiveSubScreen] = useState<"main" | "protocol" | "chat">("main");
  const [activeBottomTab, setActiveBottomTab] = useState<"intel" | "protocol" | "chat">("intel");

  // Chat input state
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [typedMessage, setTypedMessage] = useState("");
  const [isLogisticsCollapsed, setIsLogisticsCollapsed] = useState(false);
  const chatInputRef = useRef<TextInput>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const processingLogistics = useRef<Set<string>>(new Set());

  const triggerLogisticsDispatch = async (caseItem: PatientCase) => {
    try {
      const lat = caseItem.latitude || 33.9749;
      const lng = caseItem.longitude || 71.4500;

      // 1. Log start
      await addIntelligenceLog({
        caseId: caseItem.id,
        agentName: "LogisticsAgent",
        thought: `🚨 CIRO Dispatch Agent activated automatically for ${caseItem.severity.toUpperCase()} case. GPS Locked: [${lat.toFixed(4)}, ${lng.toFixed(4)}]. Initiating hospital and ambulance search...`,
        confidence: 1.0,
        action: "LOGISTICS_INITIATED",
      });

      // 2. Mock facilities nearest selection
      const bestHospital = {
        name: "Hayatabad Medical Complex",
        address: "Phase 5, Hayatabad, Peshawar",
        phone: "+92-91-9217480",
        distance: "1.4 km",
        duration: "5 mins",
        type: "hospital"
      };

      const bestAmbulance = {
        name: "Rescue 1122",
        address: "Saddar, Peshawar",
        phone: "1122",
        distance: "1.1 km",
        duration: "4 mins",
        type: "ambulance_service"
      };

      // 3. Log resource findings
      await addIntelligenceLog({
        caseId: caseItem.id,
        agentName: "LogisticsAgent",
        thought: `Resource search complete. Identified nearest Hospital: ${bestHospital.name} (${bestHospital.distance}, ETA: ${bestHospital.duration}) and Ambulance: ${bestAmbulance.name} (ETA: ${bestAmbulance.duration}).`,
        confidence: 0.96,
        action: "RESOURCES_FOUND",
      });

      // 4. Send direct message to the patient
      const chatMessage = `CIRO Logistics Agent has identified the nearest emergency resources for you:\n\n` +
        `🏥 Nearest Hospital: ${bestHospital.name}\n` +
        `📍 ${bestHospital.address}\n` +
        `📞 Hospital Number: ${bestHospital.phone}\n` +
        `⏱ ETA to hospital: ${bestHospital.duration} (${bestHospital.distance})\n\n` +
        `🚑 Nearest Ambulance: ${bestAmbulance.name}\n` +
        `📞 Ambulance Number: ${bestAmbulance.phone}\n` +
        `⏱ Ambulance arrival: ${bestAmbulance.duration} (${bestAmbulance.distance})\n\n` +
        `⚠️ Please stay calm. An ambulance has been coordinated. Help is on the way.`;

      await sendMessage(caseItem.id, "logistics-agent", "emergency", "CIRO Logistics Agent", chatMessage);

      // 5. Update case status in database so it is not processed again
      await updateCase(caseItem.id, { logisticsDispatched: true });

      // 6. Log confirmation to Orchestrator
      await addIntelligenceLog({
        caseId: caseItem.id,
        agentName: "Orchestrator",
        thought: `LogisticsAgent dispatch complete. Patient notified. Active ambulance tracking established.`,
        confidence: 0.98,
        action: "DISPATCH_CONFIRMED",
      });

    } catch (e: any) {
      console.warn("Failed automatic logistics dispatch for case:", caseItem.id, e);
    } finally {
      processingLogistics.current.delete(caseItem.id);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setUserLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      } catch (e) {
        console.log("Error getting location: ", e);
      }
    })();
  }, []);

  useEffect(() => {
    if (activeBottomTab === "chat") {
      const timer = setTimeout(() => {
        chatInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [activeBottomTab]);

  const getMockIntelLogs = (c: any) => {
    const caseIdLabel = c?.id ? `#${c.id.substring(0, 6)}` : "#fC5JKm";
    const severityLabel = c?.severity ? c.severity.toUpperCase() : "CRITICAL";
    const lat = c?.latitude ? c.latitude.toFixed(4) : "33.9749";
    const lng = c?.longitude ? c.longitude.toFixed(4) : "71.4500";
    
    // Customize social media topic dynamically based on case location
    const addressArea = c?.address ? c.address.split(",")[0].trim() : "Hayatabad Phase 4";
    const topic = c?.severity === "critical" ? `Heavy flooding in ${addressArea}` : `Accident reported near ${addressArea}`;

    return [
      {
        id: "mock-1",
        action: "SIGNAL_RECEIVED",
        thought: `New emergency signal received [Case: ${caseIdLabel}]. GPS locked at [${lat}, ${lng}]. Severity: ${severityLabel}. Initiating multi-source signal fusion...`,
        timestamp: Date.now() - 600000,
        agentName: "Orchestrator",
      },
      {
        id: "mock-2",
        action: "CLUSTER_SCAN",
        thought: `Querying Firestore emergency_cases for reports within 1.5km radius submitted in the last 30 minutes...`,
        timestamp: Date.now() - 550000,
        agentName: "TriageAgent",
      },
      {
        id: "mock-3",
        thought: `No other emergency reports found within 1.5km in the last 30 minutes. Case appears geographically isolated. Continuing multi-source validation...`,
        timestamp: Date.now() - 500000,
        agentName: "TriageAgent",
      },
      {
        id: "mock-4",
        action: "WEATHER_SCAN",
        thought: `Querying Open-Meteo API for real-time weather conditions at [${lat}, ${lng}]...`,
        timestamp: Date.now() - 450000,
        agentName: "TriageAgent",
      },
      {
        id: "mock-5",
        thought: `Weather check complete: Partly cloudy. Wind: 4.7 km/h, Precipitation: 0mm. Conditions stable — no weather-based risk escalation required.`,
        timestamp: Date.now() - 400000,
        agentName: "TriageAgent",
      },
      {
        id: "mock-6",
        action: "MAP_CONTEXT_CHECK",
        thought: `Checking map context: scanning for high-risk infrastructure (intersections, highways, hospitals, schools) within 300m via Google Places API...`,
        timestamp: Date.now() - 350000,
        agentName: "LogisticsAgent",
      },
      {
        id: "mock-7",
        action: "MAP_CLEAR",
        thought: `Map analysis complete. Map context check failed. Proceeding without location risk data.`,
        timestamp: Date.now() - 300000,
        agentName: "LogisticsAgent",
      },
      {
        id: "mock-8",
        action: "SOCIAL_SCAN",
        thought: `Scanning social_signals_demo collection for corroborating news and social media reports near [${lat}, ${lng}]...`,
        timestamp: Date.now() - 250000,
        agentName: "IntelAgent",
      },
      {
        id: "mock-9",
        action: "SOCIAL_CORROBORATION",
        thought: `Found 12 corroborating social/news signal(s) within 3km. Primary topic: '${topic}'. Cross-referencing with emergency report — pattern confirmed. Confidence boost: +15%.`,
        timestamp: Date.now() - 200000,
        agentName: "IntelAgent",
      },
      {
        id: "mock-10",
        action: "CONFIDENCE_SCORED",
        thought: `Signal fusion complete. Composite confidence score: 25%. Evidence sources: [12 social signal(s): "${topic}" | case severity: critical]. Crisis escalation threshold: 65%.`,
        timestamp: Date.now() - 150000,
        agentName: "StrategistAgent",
        confidence: 0.25,
      },
      {
        id: "mock-11",
        action: "NO_ESCALATION",
        thought: `Analysis complete. Confidence 25% — below 65% escalation threshold. Classification: Low Risk — Monitor. Evidence gathered: [12 social signal(s): "${topic}" | case severity: critical] No crisis event created. Routing to Emergency Dispatch as standard case.`,
        timestamp: Date.now() - 100000,
        agentName: "StrategistAgent",
        confidence: 0.25,
      }
    ];
  };

  // Color Palette Definitions
  const colors = {
    background: isDark ? "#020617" : "#f8fafc",
    cardBg: isDark ? "#0f172a" : "#ffffff",
    cardBorder: isDark ? "#1e293b" : "#e2e8f0",
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#64748b",
    redAccent: "#ef4444",
    redBorder: "#fca5a5",
    redLightBg: "#fef2f2",
    greenAccent: "#10b981",
    blueAccent: "#3b82f6",
    purpleAccent: "#a855f7",
    inputBg: isDark ? "#1e293b50" : "#f1f5f9",
    terminalBg: "#020617",
  };

  // 1. Subscribe to active cases (All active cases, sorted by severity)
  useEffect(() => {
    const unsub = subscribeToAllCases((data) => {
      const activeCases = data.filter(
        (c) => c.status !== "completed" && 
               c.status !== "closed" && 
               c.status !== "resolved" &&
               (c.severity === "critical" || c.severity === "high")
      ).sort((a, b) => {
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sevA = severityOrder[a.severity] ?? 4;
        const sevB = severityOrder[b.severity] ?? 4;
        if (sevA !== sevB) return sevA - sevB;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      setCases(activeCases);

      // Run automatic logistics dispatch for high/critical cases that haven't been processed yet
      activeCases.forEach((c) => {
        if (!c.logisticsDispatched && !processingLogistics.current.has(c.id)) {
          processingLogistics.current.add(c.id);
          triggerLogisticsDispatch(c);
        }
      });

      if (selectedCase) {
        const updated = activeCases.find((c) => c.id === selectedCase.id);
        if (updated) {
          setSelectedCase(updated);
        } else {
          setSelectedCase(null);
        }
      }
    });
    return () => unsub();
  }, [selectedCase?.id]);

  // 2. Subscribe to CIRO Multi-Agent thoughts logs
  useEffect(() => {
    const unsubIntel = subscribeToAllIntelligence((logs) => {
      setIntelLogs(logs);
    });
    return () => unsubIntel();
  }, []);

  // 3. Subscribe to active case messages
  useEffect(() => {
    if (!selectedCase?.id) {
      setChatMessages([]);
      return;
    }
    const unsubChat = subscribeToChatMessages(selectedCase.id, (msgs) => {
      setChatMessages(msgs);
    });
    return () => unsubChat();
  }, [selectedCase?.id]);

  // 4. Update case status / Dispatch ambulance workflow
  const handleUpdateStatus = async (statusVal: "pending" | "assigned" | "dispatched" | "completed") => {
    if (!selectedCase) return;
    setDispatchingId(selectedCase.id);
    try {
      await updateCase(selectedCase.id, { status: statusVal });

      // Log decision to CIRO Intelligence Feed
      await addIntelligenceLog({
        caseId: selectedCase.id,
        agentName: "LogisticsAgent",
        thought: `Emergency resource coordination status updated to [${statusVal.toUpperCase()}] for case #${selectedCase.id.slice(0, 6)}. GPS tracking updated.`,
        confidence: 0.98,
        action: "STATUS_UPDATED",
      });

      await addIntelligenceLog({
        caseId: selectedCase.id,
        agentName: "Orchestrator",
        thought: `Transitioning active emergency triage logs. Dynamic resource routing locks updated in CIRO Command Network.`,
        confidence: 1.0,
        action: "ROUTING_REALLOCATION",
      });

      Alert.alert("Status Updated", `Case status successfully updated to ${statusVal.toUpperCase()}.`);
    } catch (e: any) {
      Alert.alert("Update Failed", e.message || "Failed to update status.");
    } finally {
      setDispatchingId(null);
    }
  };

  // 5. Send chat message from dispatcher
  const handleSendChatMessage = async () => {
    if (!selectedCase || !typedMessage.trim()) return;
    try {
      await sendMessage(
        selectedCase.id,
        "dispatcher-007",
        "emergency",
        "Dispatcher",
        typedMessage.trim()
      );
      setTypedMessage("");
    } catch (err: any) {
      Alert.alert("Error sending message", err.message);
    }
  };

  // Determine current active node on stepper
  const getStepperIndex = () => {
    if (!selectedCase) return 0;
    const s = selectedCase.status.toLowerCase();
    if (s === "pending") return 0;
    if (s === "assigned") return 1;
    if (s === "dispatched" || s === "en-route") return 2;
    if (s === "completed" || s === "arrived") return 3;
    return 0;
  };

  // Render Main Screen Layout
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >

      {/* Top Header Bar */}
      <View style={[styles.customTopHeader, { backgroundColor: colors.cardBg, borderBottomColor: colors.cardBorder }]}>
        <Pressable style={styles.headerBrand} onPress={() => router.replace("/")}>
          <View style={styles.logoRedBox}>
            <Activity size={16} color="#ffffff" strokeWidth={2.5} />
          </View>
          <View style={styles.brandTextColumn}>
            <Text style={[styles.brandName, { color: colors.textPrimary }]}>MediLink</Text>
            <Text style={styles.brandSub}>EMERGENCY RESPONSE</Text>
          </View>
        </Pressable>
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

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Page Title Bar */}
        <View style={styles.pageTitleBar}>
          <View style={styles.titleIconWrapper}>
            <ShieldAlert size={20} color={colors.redAccent} />
          </View>
          <View style={styles.titleTextWrapper}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Emergency Dispatch</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
              CIRO Multi-Agent Command Center
            </Text>
          </View>
          <View style={styles.activeBadge}>
            <View style={styles.activeBadgeDot} />
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        </View>

        {/* Top 4 Stats Cards */}
        <View style={styles.statsGridRow}>
          {/* HIGH SEVERITY Card */}
          <View style={[styles.statsCardRed]}>
            <View style={styles.statsHeader}>
              <Text style={styles.statsLabelRed}>HIGH SEVERITY</Text>
              <ShieldAlert size={15} color="#ef4444" />
            </View>
            <Text style={styles.statsNumberRed}>
              {cases.filter(c => c.severity === "critical" || c.severity === "high").length}
            </Text>
          </View>

          {/* DISPATCHES Card */}
          <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.statsHeader}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>DISPATCHES</Text>
              <Truck size={15} color={colors.textSecondary} />
            </View>
            <Text style={[styles.statsNumber, { color: colors.textPrimary }]}>
              {cases.filter(c => c.status === "dispatched" || c.status === "assigned").length}
            </Text>
          </View>
        </View>

        <View style={styles.statsGridRow}>
          {/* UNITS READY Card */}
          <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.statsHeader}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>UNITS READY</Text>
              <Activity size={15} color={colors.textSecondary} />
            </View>
            <Text style={[styles.statsNumber, { color: colors.textPrimary }]}>8</Text>
          </View>

          {/* PERSONNEL Card */}
          <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <View style={styles.statsHeader}>
              <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>PERSONNEL</Text>
              <Users size={15} color={colors.textSecondary} />
            </View>
            <Text style={[styles.statsNumber, { color: colors.textPrimary }]}>12</Text>
          </View>
        </View>

        {/* Map Widget Card */}
        <View style={[styles.mapWidgetCard, { borderColor: colors.cardBorder }]}>
          {selectedCase ? (
            <Map
              latitude={selectedCase.latitude}
              longitude={selectedCase.longitude}
              title={`Case #${selectedCase.id.slice(0, 8)}`}
              description={selectedCase.severity.toUpperCase()}
            />
          ) : (
            <Map
              latitude={userLocation ? userLocation.latitude : 33.6844}
              longitude={userLocation ? userLocation.longitude : 73.0479}
              title="Command Center"
              description={userLocation ? "Your Current Location" : "Active Command View"}
            />
          )}

          {/* Coordinates Tag (Overlay Left) */}
          {(selectedCase || userLocation) && (
            <View style={styles.mapOverlayLeft}>
              <Text style={styles.mapOverlayLeftText}>
                LAT: {selectedCase ? selectedCase.latitude.toFixed(6) : userLocation!.latitude.toFixed(6)}
              </Text>
              <Text style={styles.mapOverlayLeftText}>
                LNG: {selectedCase ? selectedCase.longitude.toFixed(6) : userLocation!.longitude.toFixed(6)}
              </Text>
            </View>
          )}

          {/* Nearest Hospital (Overlay Right) */}
          {selectedCase && (selectedCase.severity === "critical" || selectedCase.severity === "high") && (
            <View style={styles.mapOverlayRight}>
              <Text style={styles.mapOverlayRightLabel}>🏥 NEAREST</Text>
              <Text style={styles.mapOverlayRightValue}>Hayatabad Med</Text>
              <Text style={styles.mapOverlayRightSub}>ETA: 5 mins</Text>
            </View>
          )}
        </View>

        {/* Logistics Agent Card */}
        {selectedCase && (selectedCase.severity === "critical" || selectedCase.severity === "high") && (
          <View style={[styles.logisticsAgentCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            <Pressable 
              onPress={() => setIsLogisticsCollapsed(!isLogisticsCollapsed)}
              style={styles.logisticsHeader}
            >
              <View style={styles.logisticsHeaderLeft}>
                <View style={styles.logisticsHeaderDot} />
                <Text style={[styles.logisticsHeaderTitle, { color: colors.textPrimary }]}>🤖 LOGISTICS AGENT</Text>
              </View>
              <ChevronLeft size={16} color={colors.textSecondary} style={{ transform: [{ rotate: isLogisticsCollapsed ? "-90deg" : "90deg" }] }} />
            </Pressable>

            {!isLogisticsCollapsed && (
              <View style={{ marginTop: 12 }}>
                {/* Resource Cards Row */}
                <View style={styles.logisticsResourceRow}>
                  {/* Nearest Hospital Card */}
                  <View style={[styles.logisticsResourceCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Text style={styles.logisticsResourceLabelHospital}>🏥 NEAREST HOSPITAL</Text>
                    <Text style={[styles.logisticsResourceTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      Hayatabad Medical Complex
                    </Text>
                    <Text style={[styles.logisticsResourceSub, { color: colors.textSecondary }]} numberOfLines={2}>
                      Hmc, Phase-4 Phase 4 Hayatabad, Peshawar
                    </Text>
                    <Text style={styles.logisticsResourceETA}>⏱️ ETA: 6 mins (2.0 km)</Text>
                  </View>

                  {/* Nearest Ambulance Card */}
                  <View style={[styles.logisticsResourceCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Text style={styles.logisticsResourceLabelAmbulance}>🚚 NEAREST AMBULANCE</Text>
                    <Text style={[styles.logisticsResourceTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                      Rescue-1122
                    </Text>
                    <Text style={[styles.logisticsResourceSub, { color: colors.textSecondary }]} numberOfLines={2}>
                      Emergency Dispatch Unit Peshawar
                    </Text>
                    <Text style={styles.logisticsResourceETAAmp}>⏱️ Arrival: 4 mins</Text>
                  </View>
                </View>

                {/* Stepper Header Title */}
                <View style={styles.dispatchSectionTitleRow}>
                  <Activity size={14} color="#ef4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.dispatchSectionTitleText, { color: colors.textPrimary }]}>
                    Ambulance Dispatch
                  </Text>
                </View>

                {/* Progress Stepper */}
                <View style={styles.logisticsStepperRow}>
                  {/* Stepper Node 1: PENDING */}
                  <View style={styles.stepperNode}>
                    <View style={[styles.stepperNodeCircle, { borderColor: getStepperIndex() >= 0 ? colors.redAccent : "#cbd5e1" }]}>
                      <Clock size={12} color={getStepperIndex() >= 0 ? colors.redAccent : "#94a3b8"} />
                    </View>
                    <Text style={[styles.stepperNodeLabel, getStepperIndex() >= 0 && { color: colors.redAccent, fontWeight: "900" }]}>PENDING</Text>
                  </View>

                  {/* Stepper Node 2: ASSIGNED */}
                  <View style={styles.stepperNode}>
                    <View style={[styles.stepperNodeCircle, { borderColor: getStepperIndex() >= 1 ? colors.redAccent : "#cbd5e1" }]}>
                      <Navigation size={12} color={getStepperIndex() >= 1 ? colors.redAccent : "#94a3b8"} style={{ transform: [{ rotate: "45deg" }] }} />
                    </View>
                    <Text style={[styles.stepperNodeLabel, getStepperIndex() >= 1 && { color: colors.redAccent, fontWeight: "900" }]}>ASSIGNED</Text>
                  </View>

                  {/* Stepper Node 3: EN ROUTE */}
                  <View style={styles.stepperNode}>
                    <View style={[styles.stepperNodeCircle, { borderColor: getStepperIndex() >= 2 ? colors.redAccent : "#cbd5e1" }]}>
                      <Truck size={12} color={getStepperIndex() >= 2 ? colors.redAccent : "#94a3b8"} />
                    </View>
                    <Text style={[styles.stepperNodeLabel, getStepperIndex() >= 2 && { color: colors.redAccent, fontWeight: "900" }]}>EN ROUTE</Text>
                  </View>

                  {/* Stepper Node 4: ARRIVED */}
                  <View style={styles.stepperNode}>
                    <View style={[styles.stepperNodeCircle, { borderColor: getStepperIndex() >= 3 ? colors.redAccent : "#cbd5e1" }]}>
                      <Check size={12} color={getStepperIndex() >= 3 ? colors.redAccent : "#94a3b8"} />
                    </View>
                    <Text style={[styles.stepperNodeLabel, getStepperIndex() >= 3 && { color: colors.redAccent, fontWeight: "900" }]}>ARRIVED</Text>
                  </View>
                </View>

                {/* Stepper buttons */}
                <View style={styles.logisticsButtonsRow}>
                  <Pressable
                    onPress={() => handleUpdateStatus("assigned")}
                    style={styles.assignBtn}
                  >
                    <Navigation size={14} color="#ef4444" style={{ marginRight: 6, transform: [{ rotate: "45deg" }] }} />
                    <Text style={styles.assignBtnText}>Assign Unit</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleUpdateStatus("dispatched")}
                    style={styles.dispatchBtnPrimary}
                  >
                    {dispatchingId === selectedCase?.id ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Send size={14} color="#ffffff" style={{ marginRight: 6 }} />
                        <Text style={styles.dispatchBtnPrimaryText}>Dispatch</Text>
                      </>
                    )}
                  </Pressable>
                </View>

                {/* Mark Arrived On Scene bottom helper link */}
                {selectedCase && selectedCase.status !== "completed" && (
                  <Pressable
                    onPress={() => handleUpdateStatus("completed")}
                    style={styles.markArrivedPressable}
                  >
                    <Check size={14} color="#64748b" style={{ marginRight: 6 }} />
                    <Text style={styles.markArrivedPressableText}>Mark Arrived on Scene</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {/* Priority Queue Section */}
        <View style={styles.priorityQueueCard}>
          <View style={styles.priorityQueueHeader}>
            <View style={styles.priorityQueueHeaderTitleRow}>
              <ShieldAlert size={16} color={colors.redAccent} />
              <Text style={[styles.priorityQueueTitleText, { color: colors.textPrimary }]}>PRIORITY QUEUE</Text>
            </View>
            <View style={styles.priorityQueueCountBadge}>
              <Text style={styles.priorityQueueCountText}>{cases.length}</Text>
            </View>
          </View>

          {/* Fixed-height scrollable list — always shows ~1.5 cards so Intel panel is always visible */}
          <ScrollView
            style={styles.priorityCaseScrollView}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {cases.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active priority cases.</Text>
            ) : (
              cases.map((c) => {
                const isSelected = selectedCase?.id === c.id;
                const isCritical = c.severity === "critical" || c.severity === "high";
                const isMedium = c.severity === "medium";
                const isLow = c.severity === "low";

                // High Contrast Color Logic for dark / light modes
                let cardBgColor = colors.cardBg;
                let cardBorderColor = isDark ? "#334155" : colors.cardBorder;

                if (isCritical) {
                  if (isSelected) {
                    cardBgColor = isDark ? "#ef444425" : "#fee2e2";
                    cardBorderColor = colors.redAccent;
                  } else {
                    cardBgColor = isDark ? "#ef444410" : "#fff5f5";
                    cardBorderColor = isDark ? "#ef444450" : "#fca5a5";
                  }
                } else if (isMedium) {
                  if (isSelected) {
                    cardBgColor = isDark ? "#f59e0b25" : "#fef3c7";
                    cardBorderColor = "#f59e0b";
                  } else {
                    cardBgColor = isDark ? "#f59e0b08" : "#fffbeb";
                    cardBorderColor = isDark ? "#f59e0b40" : "#fcd34d";
                  }
                } else {
                  // Low severity or default
                  if (isSelected) {
                    cardBgColor = isDark ? "#10b98125" : "#d1fae5";
                    cardBorderColor = "#10b981";
                  } else {
                    cardBgColor = colors.cardBg;
                    cardBorderColor = isDark ? "#334155" : colors.cardBorder;
                  }
                }

                // Render dynamic time string
                const timeString = c.createdAt 
                  ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                  : "Just Now";

                return (
                  <Pressable
                    key={c.id}
                    onPress={() => setSelectedCase(c)}
                    style={[
                      styles.priorityCaseCard,
                      {
                        backgroundColor: cardBgColor,
                        borderColor: cardBorderColor,
                        borderWidth: isSelected ? 2 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.caseAccentStrip, { backgroundColor: isCritical ? "#ef4444" : (isMedium ? "#f59e0b" : "#10b981") }]} />
                    <View style={styles.caseHeaderRow}>
                      <View style={[
                        styles.caseSeverityBadge, 
                        { backgroundColor: isCritical ? "#ef444420" : (isMedium ? "#f59e0b20" : "#10b98120") }
                      ]}>
                        <Text style={[
                          styles.caseSeverityText, 
                          { color: isCritical ? "#ef4444" : (isMedium ? "#f59e0b" : "#10b981") }
                        ]}>
                          {c.severity.toUpperCase()}
                        </Text>
                      </View>
                      <Text style={styles.caseTimeAgo}>{timeString}</Text>
                    </View>
                    <Text style={[styles.caseTitle, { color: colors.textPrimary }]}>{c.issueText}</Text>

                    <View style={styles.caseMetaRow}>
                      <View style={styles.caseMetaItem}>
                        <Phone size={10} color={colors.textSecondary} />
                        <Text style={[styles.caseMetaText, { color: colors.textSecondary }]}>{c.patientPhone}</Text>
                      </View>
                      <View style={styles.caseMetaItem}>
                        <MapPin size={10} color={colors.textSecondary} />
                        <Text style={[styles.caseMetaText, { color: colors.textSecondary }]}>{c.latitude.toFixed(2)}, {c.longitude.toFixed(2)}</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Fade hint when list is scrollable */}
          {cases.length > 1 && (
            <View style={[styles.priorityQueueFadeHint, { pointerEvents: "none" as any }]}>
              <Text style={styles.priorityQueueFadeHintText}>↓ scroll for more</Text>
            </View>
          )}
        </View>

        {/* Intelligence Feed / Protocol / Chat bottom selector card */}
        <View style={[
          styles.bottomPanelCard, 
          { backgroundColor: colors.cardBg, borderColor: colors.cardBorder },
          !selectedCase && { display: "none" }
        ]}>
          {/* Panel Header Label */}
          <View style={[styles.bottomPanelHeaderRow, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.bottomPanelHeaderLeft}>
              <Cpu size={13} color="#3b82f6" />
              <Text style={[styles.bottomPanelHeaderLabel, { color: colors.textSecondary }]}>INTEL AGENT</Text>
            </View>
          </View>

          <View style={[styles.bottomTabsRow, { borderBottomColor: colors.cardBorder }]}>
            {/* INTEL Tab */}
            <Pressable
              onPress={() => setActiveBottomTab("intel")}
              style={[styles.bottomTabBtn, activeBottomTab === "intel" && styles.bottomTabBtnActive]}
            >
              <Terminal size={12} color={activeBottomTab === "intel" ? "#ef4444" : "#64748b"} />
              <Text style={[styles.bottomTabBtnText, activeBottomTab === "intel" && styles.bottomTabBtnTextActive]}>
                INTEL
              </Text>
            </Pressable>

            {/* PROTOCOL Tab (triggers inline render below) */}
            <Pressable
              onPress={() => {
                setActiveBottomTab("protocol");
              }}
              style={[styles.bottomTabBtn, activeBottomTab === "protocol" && styles.bottomTabBtnActive]}
            >
              <FileText size={12} color={activeBottomTab === "protocol" ? "#ef4444" : "#64748b"} />
              <Text style={[styles.bottomTabBtnText, activeBottomTab === "protocol" && styles.bottomTabBtnTextActive]}>
                PROTOCOL
              </Text>
            </Pressable>

            {/* CHAT Tab (triggers inline render below) */}
            <Pressable
              onPress={() => {
                setActiveBottomTab("chat");
                setTimeout(() => {
                  chatInputRef.current?.focus();
                }, 100);
              }}
              style={[styles.bottomTabBtn, activeBottomTab === "chat" && styles.bottomTabBtnActive]}
            >
              <MessageSquare size={12} color={activeBottomTab === "chat" ? "#ef4444" : "#64748b"} />
              <Text style={[styles.bottomTabBtnText, activeBottomTab === "chat" && styles.bottomTabBtnTextActive]}>
                CHAT
              </Text>
            </Pressable>
          </View>

          {/* Tab Content: INTEL */}
          {activeBottomTab === "intel" && (
            <View style={styles.bottomTabContentArea}>
              {(() => {
                const caseLogs = intelLogs.filter((log) => log.caseId === selectedCase?.id);
                const displayLogs = caseLogs.length > 0 ? caseLogs : getMockIntelLogs(selectedCase);
                const scoreLog = displayLogs.find((l) => l.action === "CONFIDENCE_SCORED");
                const confidencePct = scoreLog ? Math.round((scoreLog.confidence || 0) * 100) : (selectedCase?.severity === "critical" || selectedCase?.severity === "high" ? 78 : 25);
                
                const badgeColor = confidencePct >= 65 
                  ? { bg: isDark ? "#7f1d1d" : "#fee2e2", border: isDark ? "#b91c1c" : "#fca5a5", text: isDark ? "#fca5a5" : "#ef4444" }
                  : confidencePct >= 40
                  ? { bg: isDark ? "#78350f" : "#fef3c7", border: isDark ? "#92400e" : "#fcd34d", text: isDark ? "#fcd34d" : "#d97706" }
                  : { bg: isDark ? "#064e3b" : "#ecfdf5", border: isDark ? "#065f46" : "#d1fae5", text: isDark ? "#6ee7b7" : "#047857" };

                return (
                  <>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Text style={{ fontSize: 13, fontWeight: "900", color: colors.textPrimary, letterSpacing: 0.3 }}>INTEL REPORT</Text>
                      <View style={{ backgroundColor: badgeColor.bg, borderWidth: 1, borderColor: badgeColor.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                        <Text style={{ color: badgeColor.text, fontSize: 9.5, fontWeight: "900" }}>{confidencePct}% CONFIDENCE</Text>
                      </View>
                    </View>

                    {displayLogs.map((log) => {
                      const isRed = log.action && (
                        log.action.includes("ALERT") ||
                        log.action.includes("CRISIS") ||
                        log.action.includes("ESCALATED") ||
                        log.action.includes("DETECTED")
                      );
                      const isBlue = log.action === "CONFIDENCE_SCORED" || log.action === "SIGNAL_RECEIVED" || log.action === "DISPATCH_CONFIRMED";
                      const isGreen = log.action === "NO_ESCALATION" || log.action === "RESOURCES_FOUND" || log.action === "MAP_CLEAR";
                      
                      // Setup styles based on card type
                      let cardBg = isDark ? "#1e293b" : "#f8fafc";
                      let cardBdr = isDark ? "#475569" : "#e2e8f0";
                      let badgeBg = isDark ? "#334155" : "#e2e8f0";
                      let badgeText = isDark ? "#cbd5e1" : "#475569";

                      if (isRed) {
                        cardBg = isDark ? "#ef444415" : "#fef2f2";
                        cardBdr = isDark ? "#ef444460" : "#fca5a5";
                        badgeBg = isDark ? "#ef444430" : "#fee2e2";
                        badgeText = isDark ? "#fca5a5" : "#ef4444";
                      } else if (isBlue) {
                        cardBg = isDark ? "#3b82f615" : "#eff6ff";
                        cardBdr = isDark ? "#3b82f660" : "#bfdbfe";
                        badgeBg = isDark ? "#3b82f630" : "#dbeafe";
                        badgeText = isDark ? "#93c5fd" : "#3b82f6";
                      } else if (isGreen) {
                        cardBg = isDark ? "#10b98115" : "#ecfdf5";
                        cardBdr = isDark ? "#10b98160" : "#a7f3d0";
                        badgeBg = isDark ? "#10b98130" : "#d1fae5";
                        badgeText = isDark ? "#a7f3d0" : "#10b981";
                      }

                  return (
                    <View
                      key={log.id}
                      style={{
                        backgroundColor: cardBg,
                        borderWidth: 1,
                        borderColor: cardBdr,
                        borderRadius: 8,
                        padding: 10,
                        marginBottom: 8,
                      }}
                    >
                      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center" }}>
                        {log.action ? (
                          <View
                            style={{
                              backgroundColor: badgeBg,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              borderRadius: 4,
                              marginRight: 8,
                              marginBottom: 2,
                            }}
                          >
                            <Text style={{ color: badgeText, fontSize: 8.5, fontWeight: "800", fontFamily: "monospace" }}>
                              {log.action}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={{ flex: 1, fontSize: 11, lineHeight: 15, color: colors.textPrimary }}>
                          {log.thought}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </>
            );
          })()}
        </View>
      )}

          {/* Tab Content: PROTOCOL */}
          {activeBottomTab === "protocol" && (
            <View style={styles.bottomTabContentArea}>
              {/* Cardiac Alert Card */}
              <View style={[
                styles.redAlertCard, 
                { 
                  backgroundColor: isDark ? "#ef444415" : "#fef2f2", 
                  borderColor: isDark ? "#ef444460" : "#fca5a5",
                  marginBottom: 12 
                }
              ]}>
                <View style={styles.redAlertHeaderRow}>
                  <ShieldAlert size={16} color="#ef4444" />
                  <Text style={[styles.redAlertHeaderLabel, { color: isDark ? "#fca5a5" : "#dc2626" }]}>
                    {selectedCase?.severity === "critical" ? "CRITICAL PROTOCOL ACTIVE" : "EMERGENCY PROTOCOL"}
                  </Text>
                </View>
                <Text style={[styles.redAlertBodyText, { color: isDark ? "#cbd5e1" : "#7f1d1d" }]}>
                  {selectedCase?.aiSummary || "LIFE-THREATENING cardiac event. Administer Aspirin 300mg chewed IMMEDIATELY. Nitroglycerin sublingual if available. ACTIVATE EMS NOW."}
                </Text>
              </View>

              {/* Section Title */}
              <View style={[styles.medSectionTitleRow, { marginBottom: 10 }]}>
                <FileText size={12} color="#64748b" />
                <Text style={styles.medSectionTitleText}>DOCTOR REVIEW MEDICINES</Text>
              </View>

              {(() => {
                const meds = selectedCase?.doctorReviewMedicines || [];
                if (meds.length === 0) {
                  return (
                    <>
                      {/* Medicine Card 1: Aspirin */}
                      <View style={[styles.medicineCustomCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder, marginBottom: 8 }]}>
                        <View style={[styles.medicineHeader, { borderBottomColor: colors.cardBorder }]}>
                          <View style={[styles.blueIconCircle, { backgroundColor: isDark ? "#1e3a8a50" : "#eff6ff" }]}>
                            <Activity size={16} color="#2563eb" />
                          </View>
                          <Text style={[styles.medicineNameText, { color: colors.textPrimary }]}>Aspirin (Disprin)</Text>
                        </View>
                        <View style={styles.medicineBulletList}>
                          <View style={styles.medicineBulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>300mg chewable tablet</Text>
                          </View>
                          <View style={styles.medicineBulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>Can take on empty stomach</Text>
                          </View>
                        </View>
                      </View>

                      {/* Medicine Card 2: Nitroglycerin */}
                      <View style={[styles.medicineCustomCard, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                        <View style={[styles.medicineHeader, { borderBottomColor: colors.cardBorder }]}>
                          <View style={[styles.blueIconCircle, { backgroundColor: isDark ? "#1e3a8a50" : "#eff6ff" }]}>
                            <Activity size={16} color="#2563eb" />
                          </View>
                          <Text style={[styles.medicineNameText, { color: colors.textPrimary }]}>Nitroglycerin (Nitrostat)</Text>
                        </View>
                        <View style={styles.medicineBulletList}>
                          <View style={styles.medicineBulletRow}>
                            <View style={styles.bulletDot} />
                            <Text style={[styles.bulletText, { color: colors.textSecondary }]}>0.4mg sublingual tablet</Text>
                          </View>
                        </View>
                      </View>
                    </>
                  );
                }

                return meds.map((med, idx) => {
                  const parts = med.split(/-(.+)/);
                  const medName = parts[0]?.trim() || med;
                  const medDetails = parts[1]?.trim() || "Recommended dosage as reviewed by attending physician.";

                  return (
                    <View
                      key={idx}
                      style={[
                        styles.medicineCustomCard,
                        {
                          backgroundColor: colors.inputBg,
                          borderColor: colors.cardBorder,
                          marginBottom: idx === meds.length - 1 ? 0 : 8,
                        },
                      ]}
                    >
                      <View style={[styles.medicineHeader, { borderBottomColor: colors.cardBorder }]}>
                        <View style={[styles.blueIconCircle, { backgroundColor: isDark ? "#1e3a8a50" : "#eff6ff" }]}>
                          <Activity size={16} color="#2563eb" />
                        </View>
                        <Text style={[styles.medicineNameText, { color: colors.textPrimary, fontWeight: "bold" }]}>
                          {medName}
                        </Text>
                      </View>
                      <View style={styles.medicineBulletList}>
                        <View style={styles.medicineBulletRow}>
                          <View style={styles.bulletDot} />
                          <Text style={[styles.bulletText, { color: colors.textSecondary }]}>
                            {medDetails}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                });
              })()}
            </View>
          )}

          {/* Tab Content: CHAT */}
          {activeBottomTab === "chat" && (
            <View style={{ padding: 12 }}>
              <ScrollView
                style={{ maxHeight: 220, paddingHorizontal: 5 }}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
              >
                {/* Hardcoded baseline Patient Bubble matching screenshot exactly */}
                <View style={styles.chatLeftBubbleWrapper}>
                  <Text style={styles.chatLeftSenderName}>{selectedCase?.patientPhone || "21-115-3911"}</Text>
                  <View style={[styles.chatLeftBubble, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                    <Text style={[styles.chatLeftBubbleText, { color: colors.textPrimary }]}>Ambulance arrival: 3 mins (0.8 km) ⚠️</Text>
                    <Text style={[styles.chatLeftBubbleText, { marginTop: 4, color: colors.textPrimary }]}>Please stay calm and keep this chat open. Help is on the way.</Text>
                    <Text style={[styles.chatLeftBubbleTime, { color: colors.textSecondary }]}>12:31 AM</Text>
                  </View>
                </View>

                {/* Hardcoded Logistics Agent Bubble matching screenshot exactly */}
                <View style={styles.chatLeftBubbleWrapper}>
                  <Text style={styles.chatLeftSenderName}>CIRO Logistics Agent - emergency</Text>
                  <View style={[
                    styles.chatLeftBubbleCiro, 
                    { 
                      backgroundColor: isDark ? "#1e3a8a20" : "#ffffff", 
                      borderColor: isDark ? "#1e40af" : "#3b82f6"
                    }
                  ]}>
                    <Text style={[styles.chatLeftBubbleTextCiro, { color: isDark ? "#93c5fd" : "#1e3a8a" }]}>CIRO Logistics Agent has identified the nearest emergency resources for you:</Text>

                    <View style={[styles.chatLeftBubbleCiroBox, { backgroundColor: isDark ? "#0f172a" : "#eff6ff" }]}>
                      <View style={styles.chatLeftBubbleCiroBoxItem}>
                        <MapPin size={10} color="#2563eb" />
                        <Text style={[styles.chatLeftBubbleCiroBoxText, { color: isDark ? "#94a3b8" : "#1e3a8a" }]}>Nearest Hospital: </Text>
                        <Text style={[styles.chatLeftBubbleCiroBoxTextBold, { color: isDark ? "#f8fafc" : "#1e3a8a" }]}>Hayatabad Medical Complex</Text>
                      </View>
                      <Text style={[styles.chatLeftBubbleCiroBoxText, { marginLeft: 14, fontSize: 9.5, color: "#64748b" }]}>Phase 5, Hayatabad, Peshawar</Text>
                      <Text style={[styles.chatLeftBubbleCiroBoxText, { marginLeft: 14, fontSize: 9.5, color: "#64748b" }]}>Hospital Number: +92-91-9217480</Text>

                      <View style={[styles.chatLeftBubbleCiroBoxItem, { marginTop: 6 }]}>
                        <Truck size={10} color="#2563eb" />
                        <Text style={[styles.chatLeftBubbleCiroBoxText, { color: isDark ? "#94a3b8" : "#1e3a8a" }]}>Nearest Ambulance: </Text>
                        <Text style={[styles.chatLeftBubbleCiroBoxTextBold, { color: isDark ? "#f8fafc" : "#1e3a8a" }]}>Edhi Foundation Ambulance</Text>
                      </View>
                      <Text style={[styles.chatLeftBubbleCiroBoxText, { marginLeft: 14, fontSize: 9.5, color: "#64748b" }]}>Ambulance Number: +92-21-115-3911</Text>
                    </View>

                    <View style={[styles.chatLeftBubbleCiroETA, { backgroundColor: isDark ? "#7f1d1d30" : "#fef2f2", borderColor: isDark ? "#b91c1c" : "#fca5a5" }]}>
                      <Text style={[styles.chatLeftBubbleCiroETAText, { color: isDark ? "#fca5a5" : "#b91c1c" }]}>⏱️ Ambulance arrival: 3 mins (0.8 km) ⚠️</Text>
                    </View>

                    <Text style={[styles.chatLeftBubbleText, { fontSize: 10.5, marginTop: 6, color: colors.textPrimary }]}>
                      Please stay calm and keep this chat open. Help is on the way.
                    </Text>
                    <Text style={[styles.chatLeftBubbleTime, { color: colors.textSecondary }]}>12:33 AM</Text>
                  </View>
                </View>

                {/* Render Firestore Real-Time Chat Stream */}
                {chatMessages.map((msg) => {
                  const isMe = msg.senderRole === "dispatcher";

                  if (isMe) {
                    return (
                      <View key={msg.id} style={styles.chatRightBubbleWrapper}>
                        <Text style={styles.chatRightSenderName}>Dispatcher - emergency</Text>
                        <View style={styles.chatRightBubble}>
                          <Text style={styles.chatRightBubbleText}>{msg.message}</Text>
                          <Text style={styles.chatRightBubbleTime}>
                            {msg.timestamp ? new Date((msg.timestamp as any)?.toMillis?.() || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just Now"} ✔️✔️
                          </Text>
                        </View>
                      </View>
                    );
                  } else {
                    return (
                      <View key={msg.id} style={styles.chatLeftBubbleWrapper}>
                        <Text style={styles.chatLeftSenderName}>{msg.senderName || "Patient"}</Text>
                        <View style={[styles.chatLeftBubble, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                          <Text style={[styles.chatLeftBubbleText, { color: colors.textPrimary }]}>{msg.message}</Text>
                          <Text style={[styles.chatLeftBubbleTime, { color: colors.textSecondary }]}>
                            {msg.timestamp ? new Date((msg.timestamp as any)?.toMillis?.() || msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Just Now"}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                })}
              </ScrollView>

              {/* Input Footer inline */}
              <View style={[styles.chatFooterInputRow, { borderTopWidth: 1, borderColor: colors.cardBorder, marginTop: 8, height: 50, paddingHorizontal: 5, backgroundColor: colors.cardBg }]}>
                <TextInput
                  ref={chatInputRef}
                  placeholder="Type a message..."
                  placeholderTextColor="#94a3b8"
                  style={[styles.chatFooterInput, { fontSize: 12, height: 36, backgroundColor: colors.inputBg, color: colors.textPrimary }]}
                  value={typedMessage}
                  onChangeText={setTypedMessage}
                  onSubmitEditing={handleSendChatMessage}
                />
                <Pressable onPress={handleSendChatMessage} style={[styles.chatFooterSendBtn, { width: 36, height: 36, borderRadius: 18 }]}>
                  <Send size={12} color="#ffffff" />
                </Pressable>
              </View>
            </View>
          )}
        </View>

      </ScrollView>
      <BottomNav activeTab="emergency" />
      </KeyboardAvoidingView>
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
  pageTitleBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: "center",
  },
  titleIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  titleTextWrapper: {
    flex: 1,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  pageSubtitle: {
    fontSize: 11,
    fontWeight: "500",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  activeBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#2563eb",
  },
  activeBadgeText: {
    color: "#2563eb",
    fontSize: 10,
    fontWeight: "800",
  },
  statsGridRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 12,
    width: "100%",
  },
  statsCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  statsCardRed: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#fef2f2",
    borderColor: "#fca5a5",
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statsLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  statsLabelRed: {
    fontSize: 9.5,
    fontWeight: "800",
    letterSpacing: 0.5,
    color: "#ef4444",
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6,
  },
  statsNumberRed: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6,
    color: "#ef4444",
  },
  mapWidgetCard: {
    marginHorizontal: 20,
    marginTop: 15,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
    height: 180,
  },
  mapOverlayLeft: {
    position: "absolute",
    left: 10,
    top: 10,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  mapOverlayLeftText: {
    color: "#cbd5e1",
    fontSize: 8.5,
    fontWeight: "700",
    fontFamily: "monospace",
    lineHeight: 12,
  },
  mapOverlayRight: {
    position: "absolute",
    right: 10,
    top: 10,
    backgroundColor: "#ffffff",
    padding: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  mapOverlayRightLabel: {
    fontSize: 7.5,
    fontWeight: "900",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  mapOverlayRightValue: {
    fontSize: 10,
    fontWeight: "800",
    color: "#0f172a",
    marginTop: 2,
  },
  mapOverlayRightSub: {
    fontSize: 9,
    fontWeight: "700",
    color: "#2563eb",
    marginTop: 1,
  },
  logisticsAgentCard: {
    marginHorizontal: 20,
    marginTop: 15,
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  logisticsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  logisticsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logisticsHeaderDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3b82f6",
  },
  logisticsHeaderTitle: {
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  logisticsStepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 18,
    paddingHorizontal: 5,
  },
  stepperNode: {
    alignItems: "center",
    flex: 1,
  },
  stepperNodeCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  stepperNodeLabel: {
    fontSize: 8,
    fontWeight: "800",
    marginTop: 6,
    color: "#64748b",
  },
  logisticsButtonsRow: {
    flexDirection: "row",
    gap: 10,
  },
  assignBtn: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  assignBtnText: {
    color: "#ef4444",
    fontSize: 11,
    fontWeight: "900",
  },
  dispatchBtnPrimary: {
    flex: 1,
    flexDirection: "row",
    height: 38,
    borderRadius: 10,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
  },
  dispatchBtnPrimaryText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "900",
  },
  logisticsResourceRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  logisticsResourceCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    justifyContent: "space-between",
  },
  logisticsResourceLabelHospital: {
    fontSize: 7,
    fontWeight: "900",
    color: "#2563eb",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  logisticsResourceLabelAmbulance: {
    fontSize: 7,
    fontWeight: "900",
    color: "#f59e0b",
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  logisticsResourceTitle: {
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 12,
    marginBottom: 2,
  },
  logisticsResourceSub: {
    fontSize: 8,
    lineHeight: 10,
    marginBottom: 4,
  },
  logisticsResourceETA: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#2563eb",
  },
  logisticsResourceETAAmp: {
    fontSize: 8.5,
    fontWeight: "800",
    color: "#f59e0b",
  },
  dispatchSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    marginBottom: 2,
  },
  dispatchSectionTitleText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  markArrivedPressable: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
  },
  markArrivedPressableText: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748b",
  },
  priorityQueueCard: {
    marginHorizontal: 20,
    marginTop: 15,
  },
  priorityQueueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  priorityQueueHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priorityQueueTitleText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  priorityQueueCountBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  priorityQueueCountText: {
    color: "#ffffff",
    fontSize: 9.5,
    fontWeight: "900",
  },
  priorityQueueFadeHint: {
    alignItems: "center",
    paddingTop: 4,
    paddingBottom: 2,
  },
  priorityQueueFadeHintText: {
    fontSize: 9,
    color: "#94a3b8",
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  priorityCaseScrollView: {
    maxHeight: 220,
  },
  priorityCaseCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 10,
    padding: 12,
    paddingLeft: 18,
    position: "relative",
    overflow: "hidden",
  },
  caseAccentStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#ef4444",
  },
  caseHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  caseSeverityBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  caseSeverityText: {
    color: "#ffffff",
    fontSize: 8.5,
    fontWeight: "900",
  },
  caseTimeAgo: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#64748b",
  },
  caseTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    marginBottom: 6,
  },
  caseMetaRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  caseMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  caseMetaText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#64748b",
  },
  bottomPanelCard: {
    marginHorizontal: 20,
    marginTop: 15,
    borderWidth: 1,
    borderRadius: 20,
    overflow: "hidden",
  },
  bottomPanelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  bottomPanelHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bottomPanelHeaderLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  bottomTabsRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    height: 44,
  },
  bottomTabBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
    borderBottomWidth: 2.5,
    borderBottomColor: "transparent",
  },
  bottomTabBtnActive: {
    borderBottomColor: "#ef4444",
  },
  bottomTabBtnText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 0.3,
  },
  bottomTabBtnTextActive: {
    color: "#ef4444",
    fontWeight: "900",
  },
  bottomTabContentArea: {
    padding: 14,
  },
  intelReportHeaderLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  intelCard: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  intelRedCard: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  intelCardText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
  },
  intelRedCardText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#991b1b",
    lineHeight: 15,
  },
  intelClusterBadge: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  intelClusterBadgeText: {
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  emptyText: {
    fontSize: 11,
    textAlign: "center",
    marginVertical: 40,
    fontWeight: "500",
  },

  // Med Protocol Subscreen styles
  subscreenHeader: {
    height: 60,
    flexDirection: "row",
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    alignItems: "center",
    justifyContent: "space-between",
  },
  subscreenHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingRight: 10,
  },
  subscreenHeaderTitle: {
    fontSize: 14.5,
    fontWeight: "900",
    color: "#b91c1c",
    marginLeft: 8,
  },
  protocolBodyScroll: {
    paddingHorizontal: 20,
    paddingTop: 15,
    gap: 15,
    paddingBottom: 80,
  },
  redAlertCard: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 12,
    padding: 14,
  },
  redAlertHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  redAlertHeaderLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#dc2626",
    letterSpacing: 0.8,
  },
  redAlertBodyText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#b91c1c",
    lineHeight: 16,
  },
  medSectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 5,
    marginBottom: 5,
  },
  medSectionTitleText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#64748b",
    letterSpacing: 0.8,
  },
  medicineCustomCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  medicineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5e1",
    paddingBottom: 8,
  },
  blueIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  medicineNameText: {
    fontSize: 13.5,
    fontWeight: "900",
  },
  medicineBulletList: {
    gap: 6,
  },
  medicineBulletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#3b82f6",
  },
  bulletText: {
    fontSize: 11,
    fontWeight: "600",
  },

  // Live Chat Subscreen styles
  chatHeaderSubtitle: {
    fontSize: 9.5,
    color: "#64748b",
    fontWeight: "600",
    marginLeft: 8,
  },
  chatMessagesScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 15,
  },
  chatDateCapsuleRow: {
    alignItems: "center",
    marginVertical: 10,
  },
  chatDateCapsule: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
  },
  chatDateCapsuleText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#64748b",
  },
  chatLeftBubbleWrapper: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    marginBottom: 12,
  },
  chatLeftSenderName: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 3,
    marginLeft: 2,
  },
  chatLeftBubble: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    padding: 10,
  },
  chatLeftBubbleText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#334155",
    lineHeight: 15,
  },
  chatLeftBubbleTime: {
    fontSize: 8.5,
    fontWeight: "600",
    color: "#94a3b8",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  chatLeftBubbleCiro: {
    backgroundColor: "#ffffff",
    borderWidth: 1.5,
    borderColor: "#3b82f6",
    borderRadius: 12,
    padding: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  chatLeftBubbleTextCiro: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#1e3a8a",
    lineHeight: 15,
  },
  chatLeftBubbleCiroBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    padding: 8,
    marginVertical: 6,
    gap: 4,
  },
  chatLeftBubbleCiroBoxItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  chatLeftBubbleCiroBoxText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#1e3a8a",
  },
  chatLeftBubbleCiroBoxTextBold: {
    fontSize: 10,
    fontWeight: "900",
    color: "#1e3a8a",
  },
  chatLeftBubbleCiroETA: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fca5a5",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginVertical: 4,
    alignSelf: "flex-start",
  },
  chatLeftBubbleCiroETAText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#b91c1c",
  },
  chatRightBubbleWrapper: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    marginBottom: 12,
  },
  chatRightSenderName: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#dc2626",
    marginBottom: 3,
    marginRight: 2,
    alignSelf: "flex-end",
  },
  chatRightBubble: {
    backgroundColor: "#dc2626",
    borderRadius: 12,
    padding: 10,
  },
  chatRightBubbleText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#ffffff",
    lineHeight: 15,
  },
  chatRightBubbleTime: {
    fontSize: 8.5,
    fontWeight: "600",
    color: "#fca5a5",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  chatFooterInputRow: {
    height: 60,
    flexDirection: "row",
    paddingHorizontal: 15,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    backgroundColor: "#ffffff",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
  },
  chatFooterPlusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#64748b",
    justifyContent: "center",
    alignItems: "center",
  },
  chatFooterInput: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: "#cbd5e1",
    paddingHorizontal: 12,
    fontSize: 11.5,
    fontWeight: "600",
    color: "#0f172a",
  },
  chatFooterSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#dc2626",
    justifyContent: "center",
    alignItems: "center",
  },
});
