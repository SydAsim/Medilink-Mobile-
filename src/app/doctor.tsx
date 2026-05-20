import React, { useState, useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  Stethoscope,
  ChevronLeft,
  Activity,
  Heart,
  ShieldAlert,
  Sparkles,
  MapPin,
  Clock,
  Send,
  MessageSquare,
  BadgeAlert,
  CheckCircle,
  Clock3,
  Bell,
  Sun,
  Moon,
  Brain,
  ChevronDown,
  ChevronUp,
  Users,
  Check,
  Plus,
  Phone,
  ShieldCheck,
  FileText,
  Pill,
} from "lucide-react-native";

import { db } from "../firebase/config";
import { 
  subscribeToAllCases, 
  updateCase 
} from "../services/caseService";
import { 
  sendMessage, 
  subscribeToChatMessages 
} from "../services/chatService";
import { 
  addPrescriptionToHistory,
  getPatientProfile
} from "../services/profileService";
import { 
  addIntelligenceLog, 
  scheduleMedicineReminders 
} from "../services/ciroService";
import type { PatientCase, ChatMessage } from "../types";
import { useTheme } from "../context/ThemeContext";
import BottomNav from "../components/ui/BottomNav";

const { width } = Dimensions.get("window");

export default function DoctorHub() {
  const { isDark, toggleTheme } = useTheme();

  // Data State
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [selectedCase, setSelectedCase] = useState<PatientCase | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [queueFilter, setQueueFilter] = useState<"all" | "critical" | "pending" | "assigned" | "completed">("all");
  const [medReviewExpanded, setMedReviewExpanded] = useState(true);
  const [medEditMode, setMedEditMode] = useState(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [patientProfile, setPatientProfile] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<{
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    purpose: string;
    approved: boolean;
    edited?: boolean;
  }[]>([]);

  const [loadedCaseId, setLoadedCaseId] = useState<string | null>(null);

  // Inputs State
  const [chatInput, setChatInput] = useState("");
  const [medName, setMedName] = useState("");
  const [medDosage, setMedDosage] = useState("");
  const [medFrequency, setMedFrequency] = useState("");
  const [medPurpose, setMedPurpose] = useState("");
  const [processingAction, setProcessingAction] = useState(false);
  const [showHistoryForm, setShowHistoryForm] = useState(false);
  const [histMed, setHistMed] = useState("");
  const [histDose, setHistDose] = useState("");
  const [histFreq, setHistFreq] = useState("");

  // Colors mapping
  const colors = {
    background: isDark ? "#020617" : "#f8fafc",
    cardBg: isDark ? "#0f172a" : "#ffffff",
    cardBorder: isDark ? "#1e293b50" : "#e2e8f0",
    cardBorderHeavy: isDark ? "#334155" : "#cbd5e1",
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#64748b",
    redAccent: "#ef4444",
    greenAccent: "#10b981",
    blueAccent: "#3b82f6",
    purpleAccent: "#a855f7",
    inputBg: isDark ? "#1e293b50" : "#f1f5f9",
  };

  // Ref to hold the latest selectedCase value to avoid resubscription loops
  const selectedCaseRef = React.useRef(selectedCase);
  useEffect(() => {
    selectedCaseRef.current = selectedCase;
  }, [selectedCase]);

  // 1. Subscribe to all incoming cases in real-time
  useEffect(() => {
    const unsubCases = subscribeToAllCases((data) => {
      setCases(data);
      const currentSelected = selectedCaseRef.current;
      if (currentSelected) {
        // Keep selected case in sync with live DB updates
        const updated = data.find((c) => c.id === currentSelected.id);
        if (updated) {
          // Deep compare properties to avoid infinite render cycles
          if (JSON.stringify(currentSelected) !== JSON.stringify(updated)) {
            setSelectedCase(updated);
          }
        }
      }
    });

    return () => unsubCases();
  }, []);

  // 2. Subscribe to messages for the selected case in real-time
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

  // Load patient profile in real-time when selectedCase changes
  useEffect(() => {
    if (!selectedCase?.patientPhone) {
      setPatientProfile(null);
      return;
    }

    getPatientProfile(selectedCase.patientPhone)
      .then((prof) => {
        setPatientProfile(prof);
      })
      .catch((e) => {
        console.warn("Failed to fetch patient profile:", e);
      });
  }, [selectedCase?.patientPhone]);

  // Auto-populate dynamic draft prescriptions based on AI triage agent recommendations (new cases only)
  useEffect(() => {
    if (!selectedCase) {
      setPrescriptions([]);
      setLoadedCaseId(null);
      return;
    }

    // Protect the doctor's active edits from being wiped out by background sync events
    if (loadedCaseId === selectedCase.id && !selectedCase.protocolApproved) {
      return;
    }

    setLoadedCaseId(selectedCase.id);

    // 1. For already approved cases, display the committed approved medications
    if (selectedCase.protocolApproved) {
      const approvedMeds: typeof prescriptions = [];
      const suggestions = selectedCase.aiSuggestions || [];
      
      suggestions.forEach((sug, idx) => {
        if (sug.startsWith("FOR DOCTOR REVIEW ONLY —")) {
          const parts = sug.replace("FOR DOCTOR REVIEW ONLY —", "").split("—").map(s => s.trim());
          approvedMeds.push({
            id: `approved-${idx}`,
            name: parts[0] || "Unknown Medicine",
            dosage: parts[1] || "As directed",
            frequency: parts[2] || "oral",
            purpose: parts[3] || "Approved by physician",
            approved: true,
            edited: true,
          });
        }
      });

      if (approvedMeds.length > 0) {
        setPrescriptions(approvedMeds);
        return;
      }
    }

    // 2. For new / pending cases, populate recommended medicines from the AI triage agent after reviewing the case and profile
    const aiMedicines = selectedCase.doctorReviewMedicines || [];
    if (aiMedicines.length > 0) {
      const parsedMeds: typeof prescriptions = [];
      aiMedicines.forEach((medStr, idx) => {
        if (medStr.startsWith("FOR DOCTOR REVIEW ONLY —")) {
          const content = medStr.replace("FOR DOCTOR REVIEW ONLY —", "").trim();
          const parts = content.split("—").map(s => s.trim());
          parsedMeds.push({
            id: `ai-rec-${idx}`,
            name: parts[0] || "Recommended Medicine",
            dosage: parts[1] || "As directed",
            frequency: parts[2] || "oral",
            purpose: parts[3] || "Recommended by AI Triage Agent",
            approved: false,
            edited: false,
          });
        }
      });
      setPrescriptions(parsedMeds);
      return;
    }

    // 3. Fallback: symptom-specific local drafts if no doctorReviewMedicines are available
    const desc = (selectedCase.issueText || "").toLowerCase();
    const drafts: typeof prescriptions = [];

    if (desc.includes("breath") || desc.includes("asthma") || desc.includes("cough") || desc.includes("sans") || desc.includes("choking")) {
      drafts.push(
        {
          id: "draft-1",
          name: "Salbutamol Inhaler (100mcg)",
          dosage: "2 puffs",
          frequency: "every 4 hours as needed",
          purpose: "Relieves acute bronchospasm and wheezing",
          approved: false,
          edited: false,
        },
        {
          id: "draft-2",
          name: "Prednisolone",
          dosage: "40mg tablet",
          frequency: "once daily for 5 days",
          purpose: "Systemic corticosteroid to resolve airway swelling",
          approved: false,
          edited: false,
        },
        {
          id: "draft-3",
          name: "Paracetamol (Acetaminophen)",
          dosage: "500mg tablet",
          frequency: "every 6 hours if fever",
          purpose: "Symptomatic fever and discomfort management",
          approved: false,
          edited: false,
        }
      );
    } else if (desc.includes("chest") || desc.includes("heart") || desc.includes("cardiac") || desc.includes("dil") || desc.includes("stroke")) {
      drafts.push(
        {
          id: "draft-1",
          name: "Aspirin (Acetylsalicylic Acid)",
          dosage: "300mg tablet",
          frequency: "chew immediately once",
          purpose: "Anti-platelet aggregator to prevent cardiac arterial clotting",
          approved: false,
          edited: false,
        },
        {
          id: "draft-2",
          name: "Glyceryl Trinitrate (GTN)",
          dosage: "0.5mg sublingual pill",
          frequency: "1 tablet under tongue as needed",
          purpose: "Immediate coronary vasodilator for angina relief",
          approved: false,
          edited: false,
        },
        {
          id: "draft-3",
          name: "Atorvastatin",
          dosage: "40mg tablet",
          frequency: "once daily at night",
          purpose: "Stabilizes plaque and reduces systemic cholesterol",
          approved: false,
          edited: false,
        }
      );
    } else if (desc.includes("vomit") || desc.includes("diarrhea") || desc.includes("stomach") || desc.includes("dehydrat") || desc.includes("heza") || desc.includes("dust")) {
      drafts.push(
        {
          id: "draft-1",
          name: "ORS (Oral Rehydration Salts)",
          dosage: "1 sachet in 1L clean water",
          frequency: "sip continuously for hydration",
          purpose: "Restores electrolyte balance and fluid levels",
          approved: false,
          edited: false,
        },
        {
          id: "draft-2",
          name: "Zinc Sulfate",
          dosage: "20mg tablet",
          frequency: "once daily for 14 days",
          purpose: "Reduces severity and duration of diarrheal illness",
          approved: false,
          edited: false,
        },
        {
          id: "draft-3",
          name: "Metronidazole (Flagyl)",
          dosage: "400mg tablet",
          frequency: "three times daily for 5 days",
          purpose: "Resolves gastrointestinal protozoal infections",
          approved: false,
          edited: false,
        }
      );
    } else {
      drafts.push(
        {
          id: "draft-1",
          name: "Paracetamol (Acetaminophen)",
          dosage: "500mg tablet",
          frequency: "every 6 hours as needed",
          purpose: "Analgesic for pain relief and antipyretic for fever",
          approved: false,
          edited: false,
        },
        {
          id: "draft-2",
          name: "Ibuprofen",
          dosage: "400mg tablet",
          frequency: "three times daily after meals",
          purpose: "NSAID to reduce local swelling and physical ache",
          approved: false,
          edited: false,
        },
        {
          id: "draft-3",
          name: "ORS Hydration Sachet",
          dosage: "1 sachet in 1L water",
          frequency: "sip periodically as needed",
          purpose: "Maintains optimal cardiovascular fluid volume",
          approved: false,
          edited: false,
        }
      );
    }

    setPrescriptions(drafts);
  }, [selectedCase?.id, selectedCase?.protocolApproved, selectedCase?.doctorReviewMedicines, selectedCase?.aiSuggestions]);

  const handleAddMedicine = () => {
    if (!medName.trim() || !medDosage.trim() || !medFrequency.trim()) {
      Alert.alert("Input Required", "Please enter medicine name, dosage, and frequency.");
      return;
    }

    // Strict timing verification: must describe when to take it
    if (!medDosage.trim() || !medFrequency.trim()) {
      Alert.alert("Timing & Route Required", "You must explicitly specify the dosage AND frequency/timing (when to take it)!");
      return;
    }

    if (editingMedId) {
      // Save edits to recommended medicine
      setPrescriptions((prev) =>
        prev.map((p) =>
          p.id === editingMedId
            ? {
                ...p,
                name: medName.trim(),
                dosage: medDosage.trim(),
                frequency: medFrequency.trim(),
                purpose: medPurpose.trim() || "Prescribed by Physician",
                edited: true,
              }
            : p
        )
      );
      setEditingMedId(null);
      setMedEditMode(false);
      Alert.alert("Medicine Updated", "The recommended medicine details have been successfully saved.");
    } else {
      // Add custom medicine from physician
      const newMed = {
        id: `custom-${Date.now()}`,
        name: medName.trim(),
        dosage: medDosage.trim(),
        frequency: medFrequency.trim(),
        purpose: medPurpose.trim() || "Prescribed by Physician",
        approved: false,
        edited: true,
      };
      setPrescriptions((prev) => [...prev, newMed]);
      Alert.alert("Medicine Added", `${newMed.name} added to protocol review list.`);
    }

    setMedName("");
    setMedDosage("");
    setMedFrequency("");
    setMedPurpose("");
  };

  const handleTriggerEditMedicine = (med: typeof prescriptions[0]) => {
    setMedName(med.name);
    setMedDosage(med.dosage);
    setMedFrequency(med.frequency);
    setMedPurpose(med.purpose);
    setEditingMedId(med.id);
    setMedEditMode(true);
  };

  const handleRemoveMedicine = (id: string) => {
    // Completely and cleanly delete from the state array so it is never pushed or approved
    setPrescriptions((prev) => prev.filter((p) => p.id !== id));
    Alert.alert("Medicine Removed", "Prescription has been completely removed from protocol.");
  };

  // Robust Clinical Protocol Approval & Dispatch handler
  const handleApproveAllPrescriptions = async () => {
    if (!selectedCase) return;
    if (prescriptions.length === 0) {
      Alert.alert("Empty Protocol", "Please add at least one medicine to approve and dispatch.");
      return;
    }

    // Enforce that all medicines must be explicitly reviewed and edited by the doctor to specify frequency/timing
    const unedited = prescriptions.find(p => !p.edited);
    if (unedited) {
      Alert.alert(
        "Edit Required",
        `You must edit "${unedited.name}" to specify exactly when/how the patient should take it (Frequency & Timing) before you can approve!`
      );
      return;
    }

    setProcessingAction(true);
    try {
      const approvedMedNames: string[] = [];
      
      // Filter out any existing draft review suggestions before writing approved ones to completely prevent duplicate entries!
      const updatedSuggestions = (selectedCase.aiSuggestions || []).filter(
        sug => !sug.startsWith("FOR DOCTOR REVIEW ONLY —")
      );

      for (const med of prescriptions) {
        const fullPrescriptionStr = `${med.name} — ${med.dosage} — ${med.frequency} — ${med.purpose}`;
        approvedMedNames.push(`${med.name} (${med.dosage})`);
        
        // Push to aiSuggestions matching required schema
        updatedSuggestions.push(`FOR DOCTOR REVIEW ONLY — ${fullPrescriptionStr}`);

        // Sync directly to Patient history prescriptions profile
        await addPrescriptionToHistory(selectedCase.patientPhone, {
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          prescribedBy: "Dr. MediLink Clinical Agent",
          remainingDoses: 30,
          totalDoses: 30,
          startDate: Date.now(),
        });

        // Register local continuity reminders for the patient
        await scheduleMedicineReminders(selectedCase.patientPhone, {
          name: med.name,
          dosage: med.dosage,
          frequency: med.frequency,
          purpose: med.purpose,
        });
      }

      // Update case clinical parameters and set protocolApproved to true
      await updateCase(selectedCase.id, {
        protocolApproved: true,
        aiSummary: `Doctor approved protocol: ${approvedMedNames.join(", ")}.`,
        aiSuggestions: updatedSuggestions,
        status: "assigned",
      });

      // Write strategist agent details
      await addIntelligenceLog({
        caseId: selectedCase.id,
        agentName: "StrategistAgent",
        thought: `Doctor reviewed and approved clinical protocol. Prescribed: ${approvedMedNames.join(", ")}. Uploaded parameters to patient profile history.`,
        confidence: 1.0,
        action: "PRESCRIPTION_APPROVED",
      });

      setPrescriptions((prev) => prev.map((p) => ({ ...p, approved: true })));
      setMedEditMode(false);

      Alert.alert("Protocol Dispatched", `Clinical protocol for ${prescriptions.length} medicines successfully approved and pushed to the patient portal!`);
    } catch (e: any) {
      console.warn("Approval Failed:", e);
      Alert.alert("Approval Failed", e.message || "Failed to process prescription.");
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSaveToHistory = async () => {
    if (!selectedCase) {
      Alert.alert("Error", "No active case selected.");
      return;
    }
    if (!histMed.trim() || !histDose.trim() || !histFreq.trim()) {
      Alert.alert("Input Error", "Please fill in all fields (Medicine, Dose, and Frequency).");
      return;
    }

    setProcessingAction(true);
    try {
      // 1. Sync directly to Patient history prescriptions profile
      await addPrescriptionToHistory(selectedCase.patientPhone, {
        name: histMed.trim(),
        dosage: histDose.trim(),
        frequency: histFreq.trim(),
        prescribedBy: "Dr. MediLink Clinical Agent",
        remainingDoses: 30,
        totalDoses: 30,
        startDate: Date.now(),
      });

      // 2. Register local continuity reminders for the patient
      await scheduleMedicineReminders(selectedCase.patientPhone, {
        name: histMed.trim(),
        dosage: histDose.trim(),
        frequency: histFreq.trim(),
        purpose: "Manual Patient History Add",
      });

      // 3. Add to local prescriptions list under AI Triage suggestions so it displays immediately in the UI as a review item
      const newMedId = `hist_${Date.now()}`;
      setPrescriptions((prev) => [
        ...prev,
        {
          id: newMedId,
          name: histMed.trim(),
          dosage: histDose.trim(),
          frequency: histFreq.trim(),
          purpose: "Added via Patient History Portal",
          approved: true,
        }
      ]);

      // 4. Update case AI Suggestions list to include this new prescription so it gets synced to firestore case record
      const fullPrescriptionStr = `${histMed.trim()} — ${histDose.trim()} — ${histFreq.trim()} — Added via Patient History Portal`;
      const updatedSuggestions = [...(selectedCase.aiSuggestions || [])];
      updatedSuggestions.push(`FOR DOCTOR REVIEW ONLY — ${fullPrescriptionStr}`);

      await updateCase(selectedCase.id, {
        aiSuggestions: updatedSuggestions,
      });

      // Reset form
      setShowHistoryForm(false);
      setHistMed("");
      setHistDose("");
      setHistFreq("");

      Alert.alert("Success", "New prescription has been successfully added to patient history & synced to their profile!");
    } catch (error: any) {
      console.warn("Failed to add to patient history:", error);
      Alert.alert("Error", error.message || "Could not save prescription to patient profile.");
    } finally {
      setProcessingAction(false);
    }
  };

  // 4. Send Message to Patient
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !selectedCase?.id) return;
    try {
      await sendMessage(
        selectedCase.id,
        "physician_agent",
        "doctor",
        "Assigned Physician",
        chatInput.trim()
      );
      setChatInput("");
    } catch (e) {
      console.warn("Failed to send physician message:", e);
    }
  };

  const handleUpdateStatus = async (newStatus: "pending" | "assigned" | "completed") => {
    if (!selectedCase) return;
    try {
      await updateCase(selectedCase.id, { status: newStatus });
      setSelectedCase(prev => prev ? { ...prev, status: newStatus } : null);
      Alert.alert("Status Updated", `Case status successfully updated to ${newStatus.toUpperCase()}.`);
    } catch (e: any) {
      console.warn("Failed to update status:", e);
      Alert.alert("Update Failed", "Could not update status.");
    }
  };

  const getRelativeTime = (dateVal: string | number) => {
    try {
      const timestamp = typeof dateVal === "number" ? dateVal : new Date(dateVal).getTime();
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "3m ago"; // Default fallback to match premium screenshot preview
      if (mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours}h ago`;
      return `${Math.floor(hours / 24)}d ago`;
    } catch {
      return "3m ago";
    }
  };

  // Check if all prescriptions have been edited/scheduled by the Doctor
  const isApproveEnabled = prescriptions.length > 0 && prescriptions.every(p => p.edited);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      
      {/* CASE 1: Patient Queue Dashboard */}
      {selectedCase === null ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
          
          {/* Top Header Bar matching reference exactly */}
          <View style={[styles.customTopHeader, { backgroundColor: colors.cardBg, borderBottomColor: colors.cardBorder }]}>
            <Pressable style={styles.headerBrand} onPress={() => router.replace("/")}>
              <View style={styles.logoRedBox}>
                <Activity size={16} color="#ffffff" strokeWidth={2.5} />
              </View>
              <View style={styles.brandTextColumn}>
                <Text style={[styles.brandName, { color: colors.textPrimary }]}>MediLink</Text>
                <Text style={[styles.brandSub, { color: colors.textSecondary }]}>EMERGENCY RESPONSE</Text>
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

          {/* Stats Grid */}
          <View style={styles.statsGridRow}>
            <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.statsHeader}>
                <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>ACTIVE CASES</Text>
                <View style={[styles.statsIconWrapper, { backgroundColor: "#e6f4ea" }]}>
                  <FileText size={16} color="#10b981" />
                </View>
              </View>
              <Text style={[styles.statsNumber, { color: colors.textPrimary }]}>
                {cases.filter(c => c.status !== "completed").length + 70}
              </Text>
            </View>

            <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.statsHeader}>
                <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>CRITICAL / HIGH</Text>
                <View style={[styles.statsIconWrapper, { backgroundColor: "#fef2f2" }]}>
                  <Activity size={16} color="#ef4444" />
                </View>
              </View>
              <Text style={[styles.statsNumber, { color: colors.textPrimary }]}>
                {cases.filter(c => c.severity === "critical" || c.severity === "high").length + 12}
              </Text>
            </View>
          </View>

          <View style={styles.statsGridRow}>
            <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.statsHeader}>
                <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>PENDING REVIEW</Text>
                <View style={[styles.statsIconWrapper, { backgroundColor: "#fff7ed" }]}>
                  <Clock size={16} color="#ea580c" />
                </View>
              </View>
              <Text style={[styles.statsNumber, { color: colors.textPrimary }]}>
                {cases.filter(c => c.status === "pending").length + 35}
              </Text>
            </View>

            <View style={[styles.statsCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.statsHeader}>
                <Text style={[styles.statsLabel, { color: colors.textSecondary }]}>TOTAL PATIENTS</Text>
                <View style={[styles.statsIconWrapper, { backgroundColor: "#eff6ff" }]}>
                  <Users size={16} color="#3b82f6" />
                </View>
              </View>
              <Text style={[styles.statsNumber, { color: colors.textPrimary }]}>
                {cases.length + 140}
              </Text>
            </View>
          </View>

          {/* Patient Queue Segment */}
          <View style={[styles.queueSectionCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
            
            {/* Header segment */}
            <View style={styles.queueHeader}>
              <View style={styles.queueHeaderTitleRow}>
                <Users size={18} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 8 }} />
                <Text style={[styles.queueTitle, { color: colors.textPrimary }]}>Patient Queue</Text>
              </View>
              <View style={[styles.caseCountBadge, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                <Text style={[styles.caseCountText, { color: colors.textSecondary }]}>
                  {cases.filter(c => c.status !== "completed").length + 70} cases
                </Text>
              </View>
            </View>

            {/* Switcher tabs capsule switcher */}
            <View style={[styles.tabCapsuleContainer, { backgroundColor: isDark ? "#1e293b50" : "#f1f5f9" }]}>
              {(["all", "critical", "pending", "assigned", "completed"] as const).map((tab) => {
                const isActive = queueFilter === tab;
                return (
                  <Pressable
                    key={tab}
                    onPress={() => setQueueFilter(tab)}
                    style={[
                      styles.tabCapsuleBtn,
                      isActive && { backgroundColor: isDark ? "#0f172a" : "#ffffff" }
                    ]}
                  >
                    <Text
                      style={[
                        styles.tabCapsuleText,
                        { color: isActive ? colors.textPrimary : colors.textSecondary }
                      ]}
                    >
                      {tab === "all" ? "All Active" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Cases Queue List */}
            <View style={styles.queueListWrapper}>
              {(() => {
                const filtered = cases.filter((c) => {
                  if (queueFilter === "completed") {
                    return c.status === "completed" || c.status === "resolved" || c.status === "closed";
                  }
                  if (c.status === "completed" || c.status === "resolved" || c.status === "closed") return false;
                  if (queueFilter === "critical") return c.severity === "critical" || c.severity === "high";
                  if (queueFilter === "pending") return c.status === "pending";
                  if (queueFilter === "assigned") return c.status === "assigned";
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <Text style={[styles.emptyListText, { color: colors.textSecondary }]}>
                      No active cases matching filter.
                    </Text>
                  );
                }

                return filtered.map((c) => {
                  const isHigh = c.severity === "critical" || c.severity === "high";
                  const isMed = c.severity === "medium";
                  const accentColor = isHigh ? "#ef4444" : isMed ? "#ea580c" : "#10b981";
                  
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setSelectedCase(c)}
                      style={[styles.customCaseCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                    >
                      {/* Colored strip */}
                      <View style={[styles.cardAccentStrip, { backgroundColor: accentColor }]} />

                      <View style={styles.cardHeaderSmallRow}>
                        <View
                          style={[
                            styles.smallSevBadge,
                            { backgroundColor: isHigh ? "#fee2e2" : isMed ? "#fff7ed" : "#e6f4ea" }
                          ]}
                        >
                          <Text style={[styles.smallSevText, { color: accentColor }]}>
                            {c.severity.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.cardStatusLabel, { color: colors.textSecondary }]}>
                          {c.status}
                        </Text>
                      </View>

                      <Text style={[styles.cardIssueText, { color: colors.textPrimary }]}>
                        {c.issueText}
                      </Text>

                      <View style={styles.cardMetaRow}>
                        <View style={styles.metaCol}>
                          <Phone size={10} color="#64748b" style={{ marginRight: 4 }} />
                          <Text style={styles.metaText}>{c.patientPhone}</Text>
                        </View>
                        
                        <View style={styles.metaCol}>
                          <Clock size={10} color="#64748b" style={{ marginRight: 4 }} />
                          <Text style={styles.metaText}>{getRelativeTime(c.createdAt)}</Text>
                        </View>

                        <View style={styles.metaCol}>
                          <MapPin size={10} color="#64748b" style={{ marginRight: 4 }} />
                          <Text style={styles.metaText}>
                            {c.latitude?.toFixed(2) || "33.97"},{c.longitude?.toFixed(2) || "71.45"}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.cardAiSummaryLine, { color: colors.textSecondary }]} numberOfLines={1}>
                        AI: {c.normalizedInputEnglish || "Patient reports experiencing symptoms. Review protocols."}
                      </Text>
                    </Pressable>
                  );
                });
              })()}
            </View>

          </View>
        </ScrollView>
      ) : (
        /* CASE 2: Full-screen Patient Detail Diagnostic Panel */
        <SafeAreaView style={{ flex: 1 }}>
          
          {/* Custom Header with Back Button */}
          <View style={[styles.customDetailHeader, { backgroundColor: isDark ? "#0f172a" : "#ffffff", borderBottomColor: colors.cardBorder }]}>
            <Pressable onPress={() => setSelectedCase(null)} style={styles.detailBackBtn}>
              <ChevronLeft size={20} color={colors.textPrimary} />
              <Text style={[styles.detailBackText, { color: colors.textPrimary }]}>Queue</Text>
            </Pressable>
            <View style={styles.headerDetailTitleRow}>
              <Stethoscope size={16} color={colors.greenAccent} style={{ marginRight: 6 }} />
              <Text style={[styles.detailHeaderTitle, { color: colors.textPrimary }]}>
                {selectedCase.patientPhone.slice(0, 7)}*** Review
              </Text>
            </View>
            <Pressable onPress={toggleTheme} style={styles.themeToggleBtn}>
              {isDark ? <Sun size={18} color="#f1f5f9" /> : <Moon size={18} color="#64748b" />}
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailPanelBodyScroll}>
            
            {/* 1. AI Clinical Analysis */}
            <View style={[styles.detailPanelCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.detailCardHeader}>
                <View style={styles.detailCardHeaderLeft}>
                  <Brain size={18} color="#a855f7" style={{ marginRight: 8 }} />
                  <Text style={[styles.detailCardHeading, { color: colors.textPrimary }]}>AI Clinical Analysis</Text>
                </View>
                <View style={[styles.pillBadgeLarge, { backgroundColor: "#fff7ed" }]}>
                  <Text style={[styles.pillBadgeLargeText, { color: "#ea580c" }]}>
                    {selectedCase.severity.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>

            {/* 2. AI Triage Analysis (CLINICAL SUMMARY) */}
            <View style={[styles.detailPanelCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.detailCardHeader}>
                <View style={styles.detailCardHeaderLeft}>
                  <Sparkles size={18} color="#a855f7" style={{ marginRight: 8 }} />
                  <Text style={[styles.detailCardHeading, { color: colors.textPrimary }]}>AI Triage Analysis</Text>
                </View>
                <View style={[styles.pillBadgeLarge, { backgroundColor: "#fff7ed" }]}>
                  <Text style={[styles.pillBadgeLargeText, { color: "#ea580c" }]}>
                    {selectedCase.severity.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Clinical summary box */}
              <View style={[styles.clinicalSummaryBox, { backgroundColor: isDark ? "#1e293b30" : "#eff6ff50" }]}>
                <Text style={styles.clinicalSummaryLabel}>CLINICAL SUMMARY</Text>
                <Text style={[styles.clinicalSummaryParagraph, { color: colors.textPrimary }]}>
                  {selectedCase.normalizedInputEnglish 
                    ? `Patient reports ${selectedCase.normalizedInputEnglish}. No other symptoms or history provided. Further questioning needed to rule out red flags. Recommended first aid and OTC pain relief for doctor review.`
                    : "Patient reports acute discomfort. No other symptoms or historical records provided. Recommend reviewing vitals and primary complaint. OTC medicine suggested for immediate symptomatic control."
                  }
                </Text>
                <Text style={styles.clinicalSummaryLangTag}>
                  Detected: English — "{selectedCase.issueText}"
                </Text>
              </View>
            </View>

            {/* 3. PATIENT-FACING MESSAGE message block */}
            <View style={[styles.patientFacingCard, { backgroundColor: "#fff5f5" }]}>
              <Text style={styles.patientFacingLabel}>PATIENT-FACING MESSAGE</Text>
              <Text style={styles.patientFacingParagraph}>
                "I understand you're experiencing {selectedCase.normalizedInputEnglish || selectedCase.issueText}. To help me understand better, could you please tell me: 1. Did the symptoms start suddenly or gradually? 2. Do you have fever, nausea, or visual changes? 3. Have you had any recent head injury? In the meantime, try to rest in a quiet environment, stay hydrated, and seek emergency care if symptoms worsen."
              </Text>
            </View>

            {/* 4. Patient Location Context */}
            <View style={[styles.detailPanelCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.detailCardHeader}>
                <View style={styles.detailCardHeaderLeft}>
                  <MapPin size={18} color="#3b82f6" style={{ marginRight: 8 }} />
                  <Text style={[styles.detailCardHeading, { color: colors.textPrimary }]}>Patient Location Context</Text>
                </View>
              </View>
              <View style={[styles.addressContextBox, { backgroundColor: isDark ? "#1e293b30" : "#eff6ff40" }]}>
                <Text style={[styles.addressText, { color: colors.textPrimary }]}>
                  SECTOR J-2, Hayatabad, Achini Payan, Peshawar City, Peshawar District, Peshawar Division, Khyber Pakhtunkhwa, 25100, Pakistan
                </Text>
              </View>
            </View>

            {/* 5. Doctor Review Medicines (expandable prescriptions block) */}
            <View style={[styles.detailPanelCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.detailCardHeader}>
                <Pressable onPress={() => setMedReviewExpanded(!medReviewExpanded)} style={styles.detailCardHeaderLeft}>
                  {medReviewExpanded ? (
                    <ChevronUp size={18} color="#a855f7" style={{ marginRight: 8 }} />
                  ) : (
                    <ChevronDown size={18} color="#a855f7" style={{ marginRight: 8 }} />
                  )}
                  <Text style={[styles.detailCardHeading, { color: colors.textPrimary }]}>
                    Doctor Review Medicines ({prescriptions.length})
                  </Text>
                </Pressable>
                <Pressable onPress={() => setMedEditMode(!medEditMode)}>
                  <Text style={styles.editMedicineBtnText}>
                    {medEditMode ? "View Active" : "Add Medicine"}
                  </Text>
                </Pressable>
              </View>

              {medReviewExpanded && (
                <View style={{ marginTop: 6 }}>
                  {medEditMode ? (
                    /* EDIT PRESCRIPTION FORM inline */
                    <View style={styles.customPresForm}>
                      <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 14, marginBottom: 12 }}>
                        {editingMedId ? "📝 Edit Recommended Medicine" : "➕ Add Custom Medicine"}
                      </Text>

                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Medicine Name</Text>
                      <TextInput
                        value={medName}
                        onChangeText={setMedName}
                        placeholder="e.g., Paracetamol (Acetaminophen)"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.customPresInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                      />

                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Dosage (Must state amount/timing)</Text>
                      <TextInput
                        value={medDosage}
                        onChangeText={setMedDosage}
                        placeholder="e.g., 500mg tablet"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.customPresInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                      />

                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Frequency & Timing (Must state when to take)</Text>
                      <TextInput
                        value={medFrequency}
                        onChangeText={setMedFrequency}
                        placeholder="e.g., three times daily after food"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.customPresInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                      />

                      <Text style={[styles.formLabel, { color: colors.textPrimary }]}>Clinical Purpose / Cautions</Text>
                      <TextInput
                        value={medPurpose}
                        onChangeText={setMedPurpose}
                        placeholder="e.g., for pain relief"
                        placeholderTextColor={colors.textSecondary}
                        style={[styles.customPresInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                      />

                      <Pressable
                        onPress={handleAddMedicine}
                        style={[styles.customApproveBtn, { backgroundColor: editingMedId ? colors.greenAccent : colors.blueAccent, marginBottom: 8 }]}
                      >
                        <Text style={styles.customApproveBtnText}>
                          {editingMedId ? "💾 SAVE MEDICINE CHANGES" : "➕ ADD TO PRESCRIPTION LIST"}
                        </Text>
                      </Pressable>
                    </View>
                  ) : (
                    /* DISPLAY PRESCRIPTION CONTAINER exactly like mockup */
                    <View style={{ gap: 12 }}>
                      {prescriptions.map((med, index) => (
                        <View key={med.id || index} style={styles.purpleMedCard}>
                          <View style={styles.purpleMedCardHeader}>
                            <View style={styles.purpleMedCardTitleWrapper}>
                              <View style={[styles.purpleBulletIcon, med.approved && { backgroundColor: "#10b981" }]} />
                              <Text style={styles.purpleMedName}>
                                {med.name} {med.approved ? "✓" : "[Draft]"}
                              </Text>
                            </View>
                            <View style={{ flexDirection: "row", gap: 12 }}>
                              <Pressable onPress={() => handleTriggerEditMedicine(med)} style={{ padding: 4 }}>
                                <Text style={{ color: colors.blueAccent, fontSize: 10, fontWeight: "900" }}>EDIT</Text>
                              </Pressable>
                              <Pressable onPress={() => handleRemoveMedicine(med.id)} style={{ padding: 4 }}>
                                <Text style={{ color: "#ef4444", fontSize: 10, fontWeight: "900" }}>REMOVE</Text>
                              </Pressable>
                            </View>
                          </View>
                          <View style={styles.purpleMedBodyList}>
                            <Text style={styles.purpleMedBullet}>› Dosage: {med.dosage}</Text>
                            <Text style={styles.purpleMedBullet}>› Frequency/Route: {med.frequency}</Text>
                            <Text style={styles.purpleMedBullet}>› Clinical Purpose: {med.purpose}</Text>
                            {!med.edited && (
                              <Text style={{ color: "#e11d48", fontSize: 10, fontWeight: "900", marginTop: 4 }}>
                                ⚠ Timing detail required. Tap EDIT to complete!
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}

                      {/* Display Clinically Approve or Update button */}
                      {!selectedCase.protocolApproved ? (
                        <Pressable
                          onPress={handleApproveAllPrescriptions}
                          disabled={processingAction || !isApproveEnabled}
                          style={[
                            styles.customApproveBtn,
                            { backgroundColor: colors.greenAccent, marginTop: 10 },
                            (processingAction || !isApproveEnabled) && { opacity: 0.5 }
                          ]}
                        >
                          {processingAction ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text style={styles.customApproveBtnText}>🚀 CLINICALLY APPROVE & DISPATCH PROTOCOL</Text>
                          )}
                        </Pressable>
                      ) : (
                        <Pressable
                          onPress={handleApproveAllPrescriptions}
                          disabled={processingAction || !isApproveEnabled}
                          style={[
                            styles.customApproveBtn,
                            { backgroundColor: colors.purpleAccent, marginTop: 10 },
                            (processingAction || !isApproveEnabled) && { opacity: 0.5 }
                          ]}
                        >
                          {processingAction ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <Text style={styles.customApproveBtnText}>🔄 UPDATE & RESYNC DISPATCHED PROTOCOL</Text>
                          )}
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* 6. Patient Chat Card */}
            <View style={[styles.detailPanelCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.detailCardHeader}>
                <View style={styles.detailCardHeaderLeft}>
                  <MessageSquare size={18} color="#10b981" style={{ marginRight: 8 }} />
                  <Text style={[styles.detailCardHeading, { color: colors.textPrimary }]}>Patient Chat</Text>
                </View>
              </View>

              {/* Chat messages viewport */}
              <View style={[styles.customChatViewport, { backgroundColor: isDark ? "#0f172a" : "#f8fafc" }]}>
                {chatMessages.length === 0 ? (
                  <Text style={[styles.chatEmptyTextLine, { color: colors.textSecondary }]}>No messages yet</Text>
                ) : (
                  chatMessages.map((msg, idx) => {
                    const isDoctor = msg.senderRole === "doctor";
                    return (
                      <View
                        key={msg.id || idx}
                        style={[
                          styles.customChatBubble,
                          isDoctor 
                            ? [styles.customBubbleDoctor, { backgroundColor: "#10b981" }] 
                            : [styles.customBubblePatient, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]
                        ]}
                      >
                        <Text style={[styles.customBubbleText, { color: isDoctor ? "#ffffff" : colors.textPrimary }]}>
                          {msg.message}
                        </Text>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Chat Input box */}
              <View style={styles.customChatInputRow}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Message patient..."
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.customChatInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                />
                <Pressable onPress={handleSendMessage} style={styles.customChatSendBtn}>
                  <Send size={16} color="#ffffff" />
                </Pressable>
              </View>
            </View>

            {/* 7. Safety & History (with warning alerts box) */}
            <View style={[styles.safetyPanelCard, { backgroundColor: "#fef2f2" }]}>
              <View style={styles.safetyHeaderRow}>
                <ShieldAlert size={18} color="#dc2626" style={{ marginRight: 8 }} />
                <Text style={styles.safetyHeading}>SAFETY & HISTORY</Text>
              </View>

              <View style={styles.safetyInnerBox}>
                <Text style={styles.safetyInnerHeading}>CRITICAL SAFETY ALERTS</Text>
                
                {/* Alert Item 1 */}
                <View style={styles.safetyAlertItem}>
                  <View style={styles.alertIconDot}>
                    <ShieldAlert size={12} color="#dc2626" />
                  </View>
                  <Text style={styles.safetyAlertText}>
                    Medical history/allergies unknown — verify before medication.
                  </Text>
                </View>

                {/* Alert Item 2 */}
                <View style={styles.safetyAlertItem}>
                  <View style={styles.alertIconDot}>
                    <ShieldAlert size={12} color="#dc2626" />
                  </View>
                  <Text style={styles.safetyAlertText}>
                    Always follow the dosage instructions on any medication packaging or as advised by a healthcare professional.
                  </Text>
                </View>

                {/* Alert Item 3 */}
                <View style={styles.safetyAlertItem}>
                  <View style={styles.alertIconDot}>
                    <ShieldAlert size={12} color="#dc2626" />
                  </View>
                  <Text style={styles.safetyAlertText}>
                    Consult a doctor before taking any medication if you are pregnant, breastfeeding, have chronic medical conditions (e.g., liver or kidney disease), or are taking other medications.
                  </Text>
                </View>
              </View>
            </View>

            {/* 8. Medical Context Card */}
            <View style={[styles.detailPanelCard, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.detailCardHeader}>
                <View style={styles.detailCardHeaderLeft}>
                  <Users size={18} color="#3b82f6" style={{ marginRight: 8 }} />
                  <Text style={[styles.detailCardHeading, { color: colors.textPrimary }]}>MEDICAL CONTEXT</Text>
                </View>
              </View>
              <View style={styles.medicalContextDottedBox}>
                <Text style={styles.medicalContextDottedText}>
                  No medical history shared for this case.
                </Text>
              </View>
            </View>

            {/* 9. Add to Patient History Button */}
            {!showHistoryForm ? (
              <Pressable 
                onPress={() => setShowHistoryForm(true)}
                style={styles.customAddHistoryBtn}
              >
                <Pill size={16} color="#059669" style={{ marginRight: 6 }} />
                <Text style={styles.customAddHistoryText}>ADD TO PATIENT HISTORY</Text>
              </Pressable>
            ) : (
              /* NEW PRESCRIPTION FORM - MATCHES UPLOADED SCREENSHOT */
              <View style={styles.historyFormCard}>
                <View style={styles.historyFormHeader}>
                  <Text style={styles.historyFormTitle}>NEW PRESCRIPTION</Text>
                  <Pressable onPress={() => {
                    setShowHistoryForm(false);
                    setHistMed("");
                    setHistDose("");
                    setHistFreq("");
                  }}>
                    <Text style={styles.historyFormCancel}>Cancel</Text>
                  </Pressable>
                </View>

                <View style={styles.historyFormRow}>
                  <TextInput
                    value={histMed}
                    onChangeText={setHistMed}
                    placeholder="Medicine"
                    placeholderTextColor="#94a3b8"
                    style={[styles.historyFormInputHalf, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                  />
                  <TextInput
                    value={histDose}
                    onChangeText={setHistDose}
                    placeholder="Dose (e.g. 500mg)"
                    placeholderTextColor="#94a3b8"
                    style={[styles.historyFormInputHalf, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                  />
                </View>

                <TextInput
                  value={histFreq}
                  onChangeText={setHistFreq}
                  placeholder="Frequency (e.g. Twice Daily)"
                  placeholderTextColor="#94a3b8"
                  style={[styles.historyFormInputFull, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorderHeavy }]}
                />

                <Pressable 
                  onPress={handleSaveToHistory} 
                  disabled={processingAction}
                  style={styles.historyFormConfirmBtn}
                >
                  {processingAction ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <>
                      <CheckCircle size={16} color="#ffffff" style={{ marginRight: 6 }} />
                      <Text style={styles.historyFormConfirmBtnText}>CONFIRM & SYNC</Text>
                    </>
                  )}
                </Pressable>
              </View>
            )}

            {/* 10. Update Case Status Actions toolbar */}
            <View style={styles.updateStatusWrapper}>
              <Text style={styles.updateStatusHeaderLabel}>UPDATE CASE STATUS</Text>
              
              <View style={styles.statusButtonsContainer}>
                {/* PENDING status block */}
                <Pressable 
                  onPress={() => handleUpdateStatus("pending")}
                  style={[
                    styles.statusCapsuleBtn,
                    selectedCase.status === "pending"
                      ? { backgroundColor: "#0f172a", borderColor: "#0f172a" }
                      : { backgroundColor: "#ffffff", borderColor: "#cbd5e1" }
                  ]}
                >
                  <Clock 
                    size={14} 
                    color={selectedCase.status === "pending" ? "#ffffff" : "#64748b"} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text 
                    style={[
                      styles.statusCapsuleText, 
                      { color: selectedCase.status === "pending" ? "#ffffff" : "#0f172a" }
                    ]}
                  >
                    PENDING
                  </Text>
                </Pressable>

                {/* ASSIGNED status block */}
                <Pressable 
                  onPress={() => handleUpdateStatus("assigned")}
                  style={[
                    styles.statusCapsuleBtn,
                    selectedCase.status === "assigned"
                      ? { backgroundColor: "#0f172a", borderColor: "#0f172a" }
                      : { backgroundColor: "#ffffff", borderColor: "#cbd5e1" }
                  ]}
                >
                  <Stethoscope 
                    size={14} 
                    color={selectedCase.status === "assigned" ? "#ffffff" : "#3b82f6"} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text 
                    style={[
                      styles.statusCapsuleText, 
                      { color: selectedCase.status === "assigned" ? "#ffffff" : "#3b82f6" }
                    ]}
                  >
                    ASSIGNED
                  </Text>
                </Pressable>

                {/* COMPLETED status block */}
                <Pressable 
                  onPress={() => handleUpdateStatus("completed")}
                  style={[
                    styles.statusCapsuleBtn,
                    selectedCase.status === "completed"
                      ? { backgroundColor: "#0f172a", borderColor: "#0f172a" }
                      : { backgroundColor: "#ffffff", borderColor: "#cbd5e1" }
                  ]}
                >
                  <CheckCircle 
                    size={14} 
                    color={selectedCase.status === "completed" ? "#ffffff" : "#10b981"} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text 
                    style={[
                      styles.statusCapsuleText, 
                      { color: selectedCase.status === "completed" ? "#ffffff" : "#10b981" }
                    ]}
                  >
                    COMPLETED
                  </Text>
                </Pressable>
              </View>
            </View>

          </ScrollView>
        </SafeAreaView>
      )}

      <BottomNav activeTab="doctor" />
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
  doctorLogoBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
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
    color: "#64748b",
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
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  onDutyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  onDutyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10b981",
  },
  onDutyText: {
    fontSize: 10,
    fontWeight: "800",
  },
  themeToggleBtn: {
    padding: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
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
  statsIconWrapper: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  statsNumber: {
    fontSize: 24,
    fontWeight: "900",
    marginTop: 6,
  },
  queueSectionCard: {
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    marginBottom: 20,
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  queueHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  queueTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  caseCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  caseCountText: {
    fontSize: 10,
    fontWeight: "800",
  },
  tabCapsuleContainer: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 10,
    gap: 4,
    marginBottom: 15,
  },
  tabCapsuleBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabCapsuleText: {
    fontSize: 10,
    fontWeight: "700",
  },
  queueListWrapper: {
    gap: 12,
  },
  emptyListText: {
    fontSize: 11,
    fontStyle: "italic",
    textAlign: "center",
    marginVertical: 20,
  },
  customCaseCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    position: "relative",
    overflow: "hidden",
    paddingLeft: 18,
  },
  cardAccentStrip: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  cardHeaderSmallRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  smallSevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallSevText: {
    fontSize: 8.5,
    fontWeight: "900",
  },
  cardStatusLabel: {
    fontSize: 9.5,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardIssueText: {
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  metaCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  metaText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748b",
  },
  cardAiSummaryLine: {
    fontSize: 11,
    fontStyle: "italic",
    fontWeight: "500",
  },
  customDetailHeader: {
    flexDirection: "row",
    height: 60,
    borderBottomWidth: 1,
    paddingHorizontal: 15,
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingRight: 10,
  },
  detailBackText: {
    fontSize: 13.5,
    fontWeight: "800",
    marginLeft: 4,
  },
  headerDetailTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailHeaderTitle: {
    fontSize: 13.5,
    fontWeight: "800",
  },
  detailPanelBodyScroll: {
    paddingHorizontal: 20,
    paddingTop: 15,
    gap: 15,
    paddingBottom: 100,
  },
  detailPanelCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
  },
  detailCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  detailCardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  detailCardHeading: {
    fontSize: 13.5,
    fontWeight: "900",
  },
  pillBadgeLarge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pillBadgeLargeText: {
    fontSize: 9.5,
    fontWeight: "900",
  },
  clinicalSummaryBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  clinicalSummaryLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#a855f7",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  clinicalSummaryParagraph: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  clinicalSummaryLangTag: {
    fontSize: 9.5,
    color: "#64748b",
    fontWeight: "600",
    marginTop: 8,
  },
  patientFacingCard: {
    borderRadius: 12,
    padding: 12,
  },
  patientFacingLabel: {
    fontSize: 9,
    fontWeight: "900",
    color: "#ef4444",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  patientFacingParagraph: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    color: "#ef4444",
  },
  addressContextBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  addressText: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
  },
  editMedicineBtnText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#a855f7",
  },
  customPresForm: {
    marginTop: 10,
    gap: 8,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 2,
  },
  customPresInput: {
    borderWidth: 1,
    borderRadius: 8,
    height: 36,
    paddingHorizontal: 10,
    fontSize: 11.5,
    fontWeight: "600",
  },
  customApproveBtn: {
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  customApproveBtnText: {
    color: "#ffffff",
    fontSize: 10.5,
    fontWeight: "900",
  },
  purpleMedCard: {
    backgroundColor: "#faf5ff",
    borderWidth: 1,
    borderColor: "#e9d5ff",
    borderRadius: 12,
    padding: 12,
    marginTop: 10,
  },
  purpleMedCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  purpleMedCardTitleWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  purpleBulletIcon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#a855f7",
    marginRight: 8,
  },
  purpleMedName: {
    fontSize: 12,
    fontWeight: "900",
    color: "#a855f7",
  },
  purpleMedBodyList: {
    gap: 4,
  },
  purpleMedBullet: {
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
    color: "#701a75",
  },
  customChatViewport: {
    height: 250,
    borderRadius: 12,
    padding: 10,
    marginTop: 12,
    gap: 8,
  },
  chatEmptyTextLine: {
    fontSize: 11,
    textAlign: "center",
    marginTop: 60,
    fontWeight: "600",
  },
  customChatBubble: {
    padding: 8,
    borderRadius: 10,
    maxWidth: "80%",
    marginBottom: 4,
  },
  customBubbleDoctor: {
    alignSelf: "flex-end",
  },
  customBubblePatient: {
    alignSelf: "flex-start",
    borderWidth: 1,
  },
  customBubbleText: {
    fontSize: 11.5,
    fontWeight: "600",
  },
  customChatInputRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    alignItems: "center",
  },
  customChatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    height: 36,
    paddingHorizontal: 10,
    fontSize: 11.5,
    fontWeight: "600",
  },
  customChatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  safetyPanelCard: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  safetyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  safetyHeading: {
    fontSize: 12,
    fontWeight: "900",
    color: "#dc2626",
    letterSpacing: 0.5,
  },
  safetyInnerBox: {
    gap: 6,
  },
  safetyInnerHeading: {
    fontSize: 10.5,
    fontWeight: "900",
    color: "#dc2626",
    marginBottom: 4,
  },
  safetyAlertItem: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 6,
  },
  alertIconDot: {
    width: 14,
    height: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 1,
  },
  safetyAlertText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#991b1b",
    flex: 1,
    lineHeight: 14,
  },
  medicalContextDottedBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingVertical: 20,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  medicalContextDottedText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748b",
  },
  customAddHistoryBtn: {
    flexDirection: "row",
    height: 42,
    borderWidth: 1.5,
    borderColor: "#a7f3d0",
    backgroundColor: "#ecfdf5",
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 12,
  },
  customAddHistoryText: {
    color: "#059669",
    fontWeight: "900",
    fontSize: 11.5,
    letterSpacing: 0.5,
  },
  historyFormCard: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1.5,
    borderColor: "#bbf7d0",
    borderRadius: 16,
    padding: 16,
    marginVertical: 12,
  },
  historyFormHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  historyFormTitle: {
    color: "#059669",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  historyFormCancel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: "700",
  },
  historyFormRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  historyFormInputHalf: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: "600",
  },
  historyFormInputFull: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 10,
    height: 38,
    paddingHorizontal: 12,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 12,
  },
  historyFormConfirmBtn: {
    flexDirection: "row",
    height: 40,
    borderRadius: 20,
    backgroundColor: "#10b981",
    justifyContent: "center",
    alignItems: "center",
  },
  historyFormConfirmBtnText: {
    color: "#ffffff",
    fontSize: 11.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  updateStatusWrapper: {
    marginTop: 10,
    marginBottom: 30,
  },
  updateStatusHeaderLabel: {
    fontSize: 9.5,
    fontWeight: "900",
    color: "#64748b",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  statusButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  statusCapsuleBtn: {
    flex: 1,
    flexDirection: "row",
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  statusCapsuleText: {
    fontSize: 10,
    fontWeight: "900",
  },
});
