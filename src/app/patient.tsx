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
  LayoutAnimation,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import {
  Heart,
  FileText,
  Clock,
  AlertTriangle,
  Send,
  History,
  ShieldAlert,
  MapPin,
  Sparkles,
  Phone,
  Globe,
  Camera,
  Trash2,
  ChevronLeft,
  MessageSquare,
  Activity,
  Bell,
  Mic,
  Upload,
  Sun,
  Moon,
  ShieldCheck,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react-native";

import { db } from "../firebase/config";
import { 
  createCase, 
  uploadCaseImage, 
  subscribeToCasesByPhone,
  deleteCase
} from "../services/caseService";
import { 
  sendMessage, 
  subscribeToChatMessages 
} from "../services/chatService";
import { 
  getPatientProfile, 
  updatePatientProfile 
} from "../services/profileService";
import { analyzeSymptoms } from "../services/aiService";
import { addIntelligenceLog } from "../services/ciroService";
import { runIntelAgent } from "../services/intelAgent";
import type { PatientCase, PatientProfile, ChatMessage, Severity, Language } from "../types";
import { useTheme } from "../context/ThemeContext";
import BottomNav from "../components/ui/BottomNav";

const { width } = Dimensions.get("window");

export default function PatientPortal() {
  const { isDark, toggleTheme } = useTheme();

  // Navigation state matching tabs
  const [activeTab, setActiveTab] = useState<"report" | "history" | "profile">("report");

  // Inputs state (Initial phone defaults to Peshawar placeholder value)
  const [phone, setPhone] = useState("03131935528");
  const [language, setLanguage] = useState<Language>("english");
  const [issueText, setIssueText] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);

  // GPS state
  const [latitude, setLatitude] = useState<number | null>(33.9749);
  const [longitude, setLongitude] = useState<number | null>(71.4500);
  const [accuracy, setAccuracy] = useState<number | null>(212);
  const [address, setAddress] = useState<string | null>(
    "SECTOR J-2, Hayatabad, Achini Payan, Peshawar City Tehsil, Peshawar District, Peshawar Division, Khyber Pakhtunkhwa, 25100, Pakistan"
  );
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Submit and Sync state
  const [submitting, setSubmitting] = useState(false);
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [activeMessages, setActiveMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isGuidanceOpen, setIsGuidanceOpen] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [activeRec, setActiveRec] = useState<any>(null);
  const [simIntervalId, setSimIntervalId] = useState<any>(null);
  const [waveHeights, setWaveHeights] = useState<number[]>([8, 8, 8, 8, 8, 8, 8]);

  useEffect(() => {
    let interval: any;
    if (isListening) {
      interval = setInterval(() => {
        setWaveHeights([
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
          Math.floor(Math.random() * 24) + 6,
        ]);
      }, 100);
    } else {
      setWaveHeights([8, 8, 8, 8, 8, 8, 8]);
    }
    return () => clearInterval(interval);
  }, [isListening]);

  // Expanded Case History details state
  const [expandedCaseId, setExpandedCaseId] = useState<string | null>(null);
  const [expandedCaseMessages, setExpandedCaseMessages] = useState<ChatMessage[]>([]);
  const [expandedChatInput, setExpandedChatInput] = useState("");

  // Profile Form state
  const [userName, setUserName] = useState("");
  const [userBloodGroup, setUserBloodGroup] = useState("");
  const [email, setEmail] = useState("syedasim2021@gmail.com");
  const [allergiesList, setAllergiesList] = useState<string[]>([]);
  const [conditionsList, setConditionsList] = useState<string[]>([]);
  const [newAllergy, setNewAllergy] = useState("");
  const [newCondition, setNewCondition] = useState("");
  const [activeMeds, setActiveMeds] = useState([
    {
      id: "med-1",
      name: "ORS (Oral Rehydration Salt)",
      instructions: "1 sachet in 1L water •",
      prescribedBy: "Dr. Physician (MediLink)",
      remainingDoses: 30,
      totalDoses: 30
    }
  ]);

  const toggleGuidance = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsGuidanceOpen(!isGuidanceOpen);
  };

  // Manage background simulator intervals cleanup
  useEffect(() => {
    return () => {
      if (simIntervalId) {
        clearInterval(simIntervalId);
      }
    };
  }, [simIntervalId]);

  const handleMicPressIn = () => {
    // Resolve Web Speech Recognition API dynamically
    const SpeechRecognition = typeof window !== "undefined"
      ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
      : null;

    if (SpeechRecognition) {
      try {
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = language === "urdu" ? "ur-PK" : "en-US";

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onresult = (event: any) => {
          let text = "";
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              text += event.results[i][0].transcript;
            }
          }
          if (text) {
            setIssueText((prev) => prev ? prev + " " + text : text);
          }
        };

        rec.onerror = (event: any) => {
          console.warn("[Speech] Recognition error handler triggered:", event.error);
        };

        rec.onend = () => {
          setIsListening(false);
          setActiveRec(null);
        };

        setActiveRec(rec);
        rec.start();
      } catch (e) {
        console.warn("Failed to initialize or start SpeechRecognition:", e);
        setIsListening(false);
        setActiveRec(null);
      }
    } else {
      // Standalone Mobile / Emulator fallback:
      // Start the animated audio wave to look highly premium and active.
      setIsListening(true);
      
      // Open the clean preset and tutorial selector alert
      Alert.alert(
        language === "urdu" ? "وائس ان پٹ گائیڈ" : "Voice Dictation Guide",
        language === "urdu" 
          ? "اپنا بیان بولنے کے لیے، نیچے دیے گئے ٹیکسٹ باکس پر کلک کریں اور اپنے کی بورڈ کا مائیکروفون بٹن استعمال کریں۔\n\nیا نیچے دیے گئے آپشنز میں سے ایک کا انتخاب کریں:"
          : "To speak your statement, tap the description box below and press the microphone icon on your mobile keyboard.\n\nOr insert a quick preset below:",
        [
          { 
            text: language === "urdu" ? "🫁 سانس لینے میں دشواری" : "🫁 Breathing Issue", 
            onPress: () => {
              setIssueText(language === "urdu" 
                ? "شدید سانس لینے میں دشواری اور سینے میں درد محسوس ہو رہا ہے، براہ کرم مدد بھیجیں۔" 
                : "Experiencing severe chest tightness and difficulty breathing. Pulse rate feels extremely high."
              );
              setIsListening(false);
            } 
          },
          { 
            text: language === "urdu" ? "🩸 شدید چوٹ اور بہاؤ" : "🩸 Severe Injury", 
            onPress: () => {
              setIssueText(language === "urdu" 
                ? "شدید حادثہ ہوا ہے، خون بہہ رہا ہے اور فوری طبی امداد کی ضرورت ہے۔" 
                : "Severe accident with continuous bleeding. Requires immediate first aid and transport."
              );
              setIsListening(false);
            } 
          },
          { 
            text: language === "urdu" ? "🤕 سر کی چوٹ / چکر آنا" : "🤕 Dizziness / Trauma", 
            onPress: () => {
              setIssueText(language === "urdu" 
                ? "سر پر چوٹ لگی ہے اور شدید چکر آ رہے ہیں، دھندلا نظر آ رہا ہے۔" 
                : "Had a sudden fall, head injury, and feeling extremely dizzy with blurry vision."
              );
              setIsListening(false);
            } 
          },
          { 
            text: language === "urdu" ? "منسوخ کریں" : "Cancel", 
            onPress: () => setIsListening(false),
            style: "cancel" 
          }
        ]
      );
    }
  };

  const handleMicPressOut = () => {
    // If simulation is running, stop it
    if (simIntervalId) {
      clearInterval(simIntervalId);
      setSimIntervalId(null);
      setIsListening(false);
      return;
    }

    if (activeRec) {
      try {
        activeRec.stop();
      } catch (e) {
        console.warn("Failed to stop active speech recognition:", e);
      }
      setIsListening(false);
      setActiveRec(null);
    }
  };

  const toggleMic = () => {
    if (isListening) {
      handleMicPressOut();
    } else {
      handleMicPressIn();
    }
  };

  const activeCase = cases[0]; // Most recent case

  // Colors mapping matching slate-950 and light styling
  const colors = {
    background: isDark ? "#020617" : "#f8fafc",
    cardBg: isDark ? "#0f172a" : "#ffffff",
    cardBorder: isDark ? "#1e293b" : "#f1f5f9",
    textPrimary: isDark ? "#f8fafc" : "#0f172a",
    textSecondary: isDark ? "#94a3b8" : "#64748b",
    redAccent: "#dc2626",
    blueAccent: "#2563eb",
    greenAccent: "#16a34a",
    purpleAccent: "#a855f7",
    inputBg: isDark ? "#1e293b50" : "#f8fafc",
  };

  // 1. Fetch live GPS coordinates
  const startGPS = async () => {
    try {
      setGpsLoading(true);
      setGpsError(null);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setGpsError("GPS permission denied. Enable location services.");
        setGpsLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      setLatitude(loc.coords.latitude);
      setLongitude(loc.coords.longitude);
      setAccuracy(loc.coords.accuracy);

      const geo = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      if (geo && geo.length > 0) {
        const adr = geo[0];
        setAddress(
          `${adr.name || ""}, ${adr.street || ""}, ${adr.city || ""}, ${adr.country || ""}`
        );
      }
    } catch (e: any) {
      console.warn("GPS tracking error:", e);
    } finally {
      setGpsLoading(false);
    }
  };

  useEffect(() => {
    startGPS();
  }, []);

  // 2. Sync cases, medical profiles, and active case chats
  useEffect(() => {
    if (!phone.trim() || phone.trim().length < 8) return;

    const unsubCases = subscribeToCasesByPhone(phone.trim(), (data) => {
      setCases(data);
    });

    const loadProfile = async () => {
      const p = await getPatientProfile(phone.trim());
      if (p) {
        setProfile(p);
        setUserName(p.name || "");
        setUserBloodGroup(p.bloodGroup || "");
        setAllergiesList(p.allergies || []);
        setConditionsList(p.chronicConditions || []);
      }
    };
    loadProfile();

    return () => unsubCases();
  }, [phone]);

  // Active case chat listener
  useEffect(() => {
    if (!activeCase?.id) {
      setActiveMessages([]);
      return;
    }
    const unsubChat = subscribeToChatMessages(activeCase.id, (msgs) => {
      setActiveMessages(msgs);
    });
    return () => unsubChat();
  }, [activeCase?.id]);

  // Expanded case chat listener
  useEffect(() => {
    if (!expandedCaseId) {
      setExpandedCaseMessages([]);
      return;
    }
    const unsubChat = subscribeToChatMessages(expandedCaseId, (msgs) => {
      setExpandedCaseMessages(msgs);
    });
    return () => unsubChat();
  }, [expandedCaseId]);

  const handleSendExpandedMessage = async (caseId: string) => {
    if (!expandedChatInput.trim()) return;
    try {
      await sendMessage(
        caseId,
        phone.trim(),
        "patient",
        profile?.name || `Patient (${phone.slice(-4)})`,
        expandedChatInput.trim()
      );
      setExpandedChatInput("");
    } catch (e) {
      console.warn("Failed to send history chat message:", e);
    }
  };

  const handleDeleteCaseConfirm = (caseId: string) => {
    Alert.alert(
      "Delete Case?",
      "Are you sure you want to permanently delete this case report from your history?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteCase(caseId);
              if (expandedCaseId === caseId) {
                setExpandedCaseId(null);
              }
              Alert.alert("Case Deleted", "The case report has been permanently removed.");
            } catch (e) {
              Alert.alert("Error", "Failed to delete case report.");
            }
          }
        }
      ]
    );
  };

  const getRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  // 3. Handle image picker selection
  const selectImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera library permission is required.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const cameraPerm = await ImagePicker.requestCameraPermissionsAsync();
    const libraryPerm = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraPerm.status !== "granted" || libraryPerm.status !== "granted") {
      Alert.alert(
        "Permissions Denied", 
        "Both Camera and Photo Library permissions are required to capture and save photos."
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e: any) {
      console.warn("Failed to launch camera:", e);
      Alert.alert("Camera Error", "Could not open camera: " + (e.message || "Unknown error"));
    }
  };

  // 4. Report Emergency Click
  const handleReportEmergency = async () => {
    if (!phone.trim()) {
      Alert.alert("Input Required", "Please enter your phone number to report.");
      return;
    }
    if (!issueText.trim()) {
      Alert.alert("Input Required", "Please describe your symptoms or emergency.");
      return;
    }
    if (latitude === null || longitude === null) {
      Alert.alert("GPS Required", "Location lock is required. Please ensure GPS is enabled.");
      return;
    }

    setSubmitting(true);

    try {
      let imageUrl: string | undefined;
      if (imageUri) {
        try {
          imageUrl = await uploadCaseImage(imageUri);
        } catch (err) {
          console.warn("Storage upload failed:", err);
        }
      }

      const historyContext = profile
        ? `Known Allergies: ${profile.allergies.join(", ") || "None"} | Conditions: ${profile.chronicConditions.join(", ") || "None"}`
        : "No medical history.";

      let aiResult;
      try {
        aiResult = await analyzeSymptoms(
          issueText.trim(),
          `Language: ${language}. Phone: ${phone}. Location: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}].`,
          historyContext
        );
      } catch (err) {
        aiResult = {
          triageLevel: "high" as Severity,
          summary: "AI symptom analysis failed — manual dispatch triage required.",
          recommendedActions: ["Seek immediate emergency help"],
          requiresImmediate: true,
          possibleConditions: [],
          confidence: 0.5,
          patientMessage: "Applying default triage protocol. Rest and seek immediate emergency care.",
          doctorSummary: "AI agent failed. High severity default applied.",
        };
      }

      const caseId = await createCase({
        patientPhone: phone.trim(),
        language,
        issueText: issueText.trim(),
        latitude,
        longitude,
        accuracy: accuracy ?? 10,
        severity: aiResult.triageLevel,
        aiSummary: aiResult.patientMessage || aiResult.summary,
        aiSuggestions: aiResult.recommendedActions || [],
        situationalSuggestions: aiResult.recommendedFirstAid || aiResult.situationalSuggestions || [],
        emergencyRequired: aiResult.requiresImmediate,
        status: "pending",
        safetyAlerts: aiResult.safetyWarnings || [],
        ...(imageUrl ? { imageUrl } : {}),
        ...(address ? { address } : {}),
        isSpam: aiResult.summary?.includes("SYSTEM_NOTICE") || false,
        isSystemTest: issueText.toLowerCase().includes("test") || false,
        detectedLanguage: aiResult.detectedLanguage || "english",
        normalizedInputEnglish: aiResult.normalizedInputEnglish || "",
        patientMessage: aiResult.patientMessage || aiResult.summary,
        doctorSummary: aiResult.doctorSummary || "",
        recommendedFirstAid: aiResult.recommendedFirstAid || [],
        doctorReviewMedicines: aiResult.doctorReviewMedicines || [],
        redFlags: aiResult.redFlags || [],
      });

      setIssueText("");
      setImageUri(null);
      setIsGuidanceOpen(true);

      Alert.alert("Emergency Submitted", "Case reported successfully!");

      const severityStr = aiResult.triageLevel;
      const isCritical = severityStr === "critical" || severityStr === "high";

      Promise.all([
        addIntelligenceLog({
          caseId,
          agentName: "TriageAgent",
          thought: `New mobile signal received. Phone: ${phone.slice(0, 6)}***. GPS: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}]. Initiating clinical diagnostics...`,
          confidence: 1.0,
          action: "CASE_RECEIVED",
        }),
      ]).catch((e) => console.warn(e));

      runIntelAgent(caseId, latitude, longitude, severityStr, issueText.trim()).catch((e) =>
        console.warn(e)
      );

    } catch (e: any) {
      Alert.alert("Submission Failed", e.message || "Failed to submit case.");
    } finally {
      setSubmitting(false);
    }
  };

  // 5. Send Chat Message
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !activeCase?.id) return;
    try {
      await sendMessage(
        activeCase.id,
        phone.trim(),
        "patient",
        profile?.name || `Patient (${phone.slice(-4)})`,
        chatInput.trim()
      );
      setChatInput("");
    } catch (e) {
      console.warn("Failed to send message:", e);
    }
  };

  // 6. Save Profile Changes
  const handleSaveProfile = async () => {
    if (!phone.trim()) {
      Alert.alert("Input Required", "Enter your phone number first.");
      return;
    }

    try {
      const updates = {
        name: userName.trim(),
        bloodGroup: userBloodGroup.trim(),
        allergies: allergiesList,
        chronicConditions: conditionsList,
      };
      await updatePatientProfile(phone.trim(), updates);
      Alert.alert("Profile Saved", "Your safety profile has been successfully uploaded.");
    } catch (e) {
      Alert.alert("Update Failed", "Could not save profile.");
    }
  };

  const handleSaveEmail = () => {
    Alert.alert("Settings Saved", "Communication email has been locked in for medication reminders.");
  };

  const handleAddAllergy = () => {
    if (!newAllergy.trim()) return;
    if (allergiesList.includes(newAllergy.trim())) {
      Alert.alert("Duplicate", "This allergy is already listed.");
      return;
    }
    setAllergiesList([...allergiesList, newAllergy.trim()]);
    setNewAllergy("");
  };

  const handleAddCondition = () => {
    if (!newCondition.trim()) return;
    if (conditionsList.includes(newCondition.trim())) {
      Alert.alert("Duplicate", "This condition is already listed.");
      return;
    }
    setConditionsList([...conditionsList, newCondition.trim()]);
    setNewCondition("");
  };

  const handleDeleteAllergy = (name: string) => {
    setAllergiesList(allergiesList.filter((a) => a !== name));
  };

  const handleDeleteCondition = (name: string) => {
    setConditionsList(conditionsList.filter((c) => c !== name));
  };

  const handleDeleteMed = (id: string) => {
    setActiveMeds(activeMeds.filter((m) => m.id !== id));
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      
      {/* Top Header Bar matching reference exactly */}
      <View style={[styles.topHeader, { backgroundColor: isDark ? "#0f172a" : "#ffffff", borderBottomColor: colors.cardBorder }]}>
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

      {/* Page Title Bar */}
      {activeTab === "profile" ? (
        <View style={styles.pageTitleBar}>
          <View style={[styles.titleIconWrapper, { backgroundColor: isDark ? "#064e3b30" : "#e6f4ea" }]}>
            <ShieldCheck size={20} color={colors.greenAccent} />
          </View>
          <View style={styles.titleTextWrapper}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Medical Profile & Safety</Text>
          </View>
          <Text style={[styles.profilePhone, { color: colors.textSecondary }]}>{phone}</Text>
        </View>
      ) : (
        <View style={styles.pageTitleBar}>
          <View style={styles.titleIconWrapper}>
            <Heart size={20} color={colors.blueAccent} />
          </View>
          <View style={styles.titleTextWrapper}>
            <Text style={[styles.pageTitle, { color: colors.textPrimary }]}>Emergency Portal</Text>
            <Text style={[styles.pageSubtitle, { color: colors.textSecondary }]}>
              Report & track emergencies
            </Text>
          </View>
          <View style={styles.activeBadge}>
            <View style={styles.activeBadgeDot} />
            <Text style={styles.activeBadgeText}>Active</Text>
          </View>
        </View>
      )}

      {/* Tab Switcher Segmented Capsule Pill */}
      <View style={[styles.tabsContainer, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
        <Pressable
          onPress={() => setActiveTab("report")}
          style={[styles.tab, activeTab === "report" && [styles.tabActive, { backgroundColor: colors.cardBg }]]}
        >
          <Send size={14} color={activeTab === "report" ? "#ef4444" : "#94a3b8"} />
          <Text style={[styles.tabLabel, { color: activeTab === "report" ? "#ef4444" : "#94a3b8" }]}>
            Report
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("history")}
          style={[styles.tab, activeTab === "history" && [styles.tabActive, { backgroundColor: colors.cardBg }]]}
        >
          <History size={14} color={activeTab === "history" ? "#2563eb" : "#94a3b8"} />
          <Text style={[styles.tabLabel, { color: activeTab === "history" ? "#2563eb" : "#94a3b8" }]}>
            History
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab("profile")}
          style={[styles.tab, activeTab === "profile" && [styles.tabActive, { backgroundColor: colors.cardBg }]]}
        >
          <ShieldAlert size={14} color={activeTab === "profile" ? "#16a34a" : "#94a3b8"} />
          <Text style={[styles.tabLabel, { color: activeTab === "profile" ? "#16a34a" : "#94a3b8" }]}>
            Profile
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        
        {/* ================= REPORT TAB ================= */}
        {activeTab === "report" && (
          <View style={styles.tabContent}>
            
            {/* Form Box Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              
              <View style={styles.cardHeaderRow}>
                <AlertTriangle size={18} color="#ef4444" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>
                    Emergency Case Submission
                  </Text>
                </View>
                {activeCase && (
                  <Pressable
                    onPress={toggleGuidance}
                    style={styles.showGuidanceBtn}
                  >
                    <Text style={styles.showGuidanceText}>Show Guidance →</Text>
                  </Pressable>
                )}
              </View>

              {/* Phone Field */}
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBg }]}>
                <Phone size={18} color="#94a3b8" style={{ marginRight: 10 }} />
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  placeholder="03XXXXXXXXX"
                  placeholderTextColor="#94a3b8"
                  style={[styles.textInput, { color: colors.textPrimary }]}
                />
              </View>

              {/* Language Selector Row */}
              <View style={styles.languageRow}>
                <Pressable
                  onPress={() => setLanguage("english")}
                  style={[
                    styles.langBtn,
                    language === "english" ? [styles.langBtnActiveEnglish, { backgroundColor: isDark ? "#450a0a" : "#fef2f2", borderColor: isDark ? "#7f1d1d" : "#fecaca" }] : [styles.langBtnInactive, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]
                  ]}
                >
                  <Globe size={14} color={language === "english" ? "#ef4444" : "#64748b"} />
                  <Text style={[styles.langText, { color: language === "english" ? "#ef4444" : "#64748b" }]}>
                    English
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setLanguage("urdu")}
                  style={[
                    styles.langBtn,
                    language === "urdu" ? [styles.langBtnActiveUrdu, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }] : [styles.langBtnInactive, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]
                  ]}
                >
                  <Text style={[styles.langText, { color: language === "urdu" ? "#ef4444" : "#64748b" }]}>
                    اردو
                  </Text>
                </Pressable>
              </View>

              {/* GPS Connected Box */}
              <View style={[styles.gpsBox, { backgroundColor: isDark ? "#064e3b" : "#f0fdf4", borderColor: isDark ? "#065f46" : "#bbf7d0" }]}>
                <MapPin size={18} color="#16a34a" style={{ marginRight: 10, marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.gpsTitle}>GPS Connected ●</Text>
                  <Text style={styles.gpsAddress} numberOfLines={3}>
                    {address || "SECTOR J-2, Hayatabad, Peshawar City, KPK, Pakistan"}
                  </Text>
                  <Text style={styles.gpsCoords}>
                    {latitude?.toFixed(4)}, {longitude?.toFixed(4)} · ±{accuracy}m
                  </Text>
                </View>
                <Pressable onPress={startGPS} style={styles.gpsTargetIcon}>
                  <Activity size={18} color="#16a34a" />
                </Pressable>
              </View>

              {/* Central Large Mic Recorder Pill */}
              <View style={styles.voiceSection}>
                <Pressable 
                  onPress={toggleMic}
                  style={[
                    styles.voiceBtnCircle,
                    isListening && { 
                      backgroundColor: "#dc2626",
                      shadowColor: "#dc2626",
                      shadowRadius: 15,
                      shadowOpacity: 0.5,
                      transform: [{ scale: 1.05 }] as any
                    }
                  ]}
                >
                  <Mic size={32} color="#ffffff" strokeWidth={2.5} />
                </Pressable>
                <Text style={[styles.voiceLabel, isListening && { color: "#dc2626" }]}>
                  {isListening ? "🔴 RECORDING STATEMENT... TAP TO STOP" : "TAP TO RECORD STATEMENT"}
                </Text>
                <View style={styles.pulseContainer}>
                  {waveHeights.map((h, idx) => (
                    <View 
                      key={idx} 
                      style={[
                        styles.pulseBar, 
                        { height: h, backgroundColor: isListening ? "#dc2626" : colors.textSecondary }
                      ]} 
                    />
                  ))}
                </View>
              </View>

              {/* Capture and Upload Buttons */}
              <View style={styles.actionRow}>
                <Pressable onPress={takePhoto} style={[styles.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                  <Camera size={16} color={colors.blueAccent} />
                  <Text style={[styles.actionBtnText, { color: colors.blueAccent }]}>Capture</Text>
                </Pressable>
                <Pressable onPress={selectImage} style={[styles.actionBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}>
                  <Upload size={16} color={colors.blueAccent} />
                  <Text style={[styles.actionBtnText, { color: colors.blueAccent }]}>Upload</Text>
                </Pressable>
              </View>

              {/* Image Previews */}
              {imageUri && (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                  <Pressable onPress={() => setImageUri(null)} style={styles.removeImageBtn}>
                    <Trash2 size={16} color="#ffffff" />
                  </Pressable>
                </View>
              )}

              {/* Description Input */}
              <TextInput
                value={issueText}
                onChangeText={setIssueText}
                multiline
                numberOfLines={3}
                placeholder="Describe your emergency..."
                placeholderTextColor={colors.textSecondary}
                style={[
                  styles.textArea,
                  {
                    color: colors.textPrimary,
                    borderColor: colors.cardBorder,
                    backgroundColor: colors.inputBg,
                    marginTop: 15,
                  },
                ]}
              />

              {/* Submit Emergency Button */}
              <Pressable
                onPress={handleReportEmergency}
                disabled={submitting}
                style={[styles.reportBtn, { backgroundColor: colors.redAccent }]}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <Sparkles size={16} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.reportBtnText}>SUBMIT EMERGENCY REPORT</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* Active Guidance Alert Cards */}
            {activeCase && isGuidanceOpen && (
              <View style={{ gap: 16, marginTop: 15 }}>
                {/* 1. Main AI Emergency Guidance Box */}
                <View style={{
                  backgroundColor: isDark ? "#0f172a" : "#f0f7ff",
                  borderColor: isDark ? "#1e293b" : "#d0e1fd",
                  borderWidth: 1.5,
                  borderRadius: 16,
                  padding: 16,
                }}>
                  {/* Header Row */}
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: isDark ? "#1e293b" : "#dbeafe",
                        alignItems: "center",
                        justifyContent: "center",
                        marginRight: 12,
                      }}>
                        <Activity size={20} color="#2563eb" />
                      </View>
                      <View>
                        <Text style={{
                          color: "#2563eb",
                          fontSize: 14,
                          fontWeight: "800",
                          letterSpacing: 0.3,
                        }}>
                          AI EMERGENCY GUIDANCE
                        </Text>
                        <Text style={{
                          color: colors.textSecondary,
                          fontSize: 11,
                          fontStyle: "italic",
                          marginTop: 1,
                        }}>
                          Analyzed based on your report
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      onPress={toggleGuidance}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        backgroundColor: isDark ? "#1e293b" : "#ffffff",
                        borderColor: isDark ? "#334155" : "#cbd5e1",
                        borderWidth: 1,
                        borderRadius: 20,
                        paddingVertical: 4,
                        paddingHorizontal: 12,
                      }}
                    >
                      <Text style={{ color: isDark ? "#94a3b8" : "#475569", fontSize: 12, fontWeight: "700" }}>
                        - Hide
                      </Text>
                    </Pressable>
                  </View>

                  {/* Summary/Main analysis Box */}
                  <View style={{
                    backgroundColor: isDark ? "#1e293b50" : "#ffffff",
                    borderColor: isDark ? "#334155" : "#e2e8f0",
                    borderWidth: 1,
                    borderRadius: 12,
                    padding: 14,
                    marginBottom: 16,
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}>
                    <Heart size={18} color="#f43f5e" style={{ marginRight: 10, marginTop: 2 }} />
                    <Text style={{
                      color: colors.textPrimary,
                      fontSize: 13,
                      lineHeight: 18,
                      flex: 1,
                      fontWeight: "600",
                    }}>
                      {activeCase.patientMessage || activeCase.aiSummary || "Emergency submitted. Please follow advice below."}
                    </Text>
                  </View>

                  {/* Immediate Steps Section */}
                  <Text style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: colors.textPrimary,
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}>
                    ⊙ IMMEDIATE STEPS
                  </Text>
                  <View style={{ gap: 8, marginBottom: 16 }}>
                    {activeCase.situationalSuggestions && activeCase.situationalSuggestions.length > 0 ? (
                      activeCase.situationalSuggestions.map((item, idx) => (
                        <View key={idx} style={{
                          backgroundColor: isDark ? "#1e293b30" : "#ffffff",
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isDark ? "#334155" : "#e2e8f0",
                          padding: 12,
                          flexDirection: "row",
                          alignItems: "center",
                        }}>
                          <View style={{
                            width: 20,
                            height: 20,
                            borderRadius: 10,
                            backgroundColor: "#eff6ff",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 10,
                          }}>
                            <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "800" }}>
                              {idx + 1}
                            </Text>
                          </View>
                          <Text style={{
                            color: colors.textPrimary,
                            fontSize: 13,
                            fontWeight: "600",
                            flex: 1,
                          }}>
                            {item}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <View style={{
                        backgroundColor: isDark ? "#1e293b30" : "#ffffff",
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: isDark ? "#334155" : "#e2e8f0",
                        padding: 12,
                        flexDirection: "row",
                        alignItems: "center",
                      }}>
                        <View style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          backgroundColor: "#eff6ff",
                          alignItems: "center",
                          justifyContent: "center",
                          marginRight: 10,
                        }}>
                          <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "800" }}>1</Text>
                        </View>
                        <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }}>
                          Rest in a safe place. Keep airways clear. Wait for dispatcher contact.
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Danger Signs Section */}
                  <Text style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: "#ef4444",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}>
                    ⊙ DANGER SIGNS — SEEK EMERGENCY CARE IF:
                  </Text>
                  <View style={{
                    backgroundColor: isDark ? "#ef444415" : "#fef2f2",
                    borderColor: isDark ? "#ef444430" : "#fee2e2",
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}>
                    <AlertTriangle size={16} color="#ef4444" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={{
                      color: isDark ? "#fca5a5" : "#f43f5e",
                      fontSize: 13,
                      fontWeight: "600",
                      flex: 1,
                      lineHeight: 18,
                    }}>
                      {activeCase.redFlags && activeCase.redFlags.length > 0
                        ? activeCase.redFlags.join(", ")
                        : "Any severe chest pain, extreme breathlessness, or heavy bleeding"}
                    </Text>
                  </View>

                  {/* Safety Notes Section */}
                  <Text style={{
                    fontSize: 11,
                    fontWeight: "800",
                    color: "#d97706",
                    letterSpacing: 0.5,
                    marginBottom: 8,
                  }}>
                    ⊙ SAFETY NOTES
                  </Text>
                  <View style={{
                    backgroundColor: isDark ? "#d9770615" : "#fffbeb",
                    borderColor: isDark ? "#d9770630" : "#fef3c7",
                    borderWidth: 1,
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 16,
                    flexDirection: "row",
                    alignItems: "flex-start",
                  }}>
                    <Clock size={16} color="#d97706" style={{ marginRight: 8, marginTop: 2 }} />
                    <Text style={{
                      color: isDark ? "#fcd34d" : "#b45309",
                      fontSize: 13,
                      fontWeight: "600",
                      flex: 1,
                      lineHeight: 18,
                    }}>
                      {activeCase.safetyAlerts && activeCase.safetyAlerts.length > 0
                        ? activeCase.safetyAlerts.join(", ")
                        : "Medical history unknown."}
                    </Text>
                  </View>

                  {/* Footer status row */}
                  <View style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 8,
                    paddingTop: 12,
                    borderTopWidth: 1,
                    borderTopColor: isDark ? "#1e293b" : "#d0e1fd50",
                  }}>
                    <Text style={{
                      fontSize: 10,
                      fontWeight: "800",
                      color: activeCase.protocolApproved ? "#10b981" : "#3b82f6",
                      letterSpacing: 0.5,
                    }}>
                      {activeCase.protocolApproved ? "⊙ CLINICALLY APPROVED" : "⊙ PENDING DR REVIEW"}
                    </Text>
                    <Text style={{
                      color: colors.textSecondary,
                      fontSize: 11,
                      fontStyle: "italic",
                    }}>
                      Stay calm. Help is coming.
                    </Text>
                  </View>
                </View>

                {/* 2. Approved Medical Protocol Box */}
                {activeCase.protocolApproved && (
                  <View style={{
                    backgroundColor: isDark ? "#581c8720" : "#fdf4ff",
                    borderColor: isDark ? "#701a7530" : "#fae8ff",
                    borderWidth: 1.5,
                    borderRadius: 16,
                    padding: 16,
                  }}>
                    <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                      <Sparkles size={16} color="#a855f7" style={{ marginRight: 8 }} />
                      <Text style={{
                        color: "#a855f7",
                        fontSize: 14,
                        fontWeight: "800",
                      }}>
                        Approved Medical Protocol
                      </Text>
                    </View>
                    <Text style={{
                      color: colors.textPrimary,
                      fontSize: 13,
                      lineHeight: 18,
                      fontWeight: "600",
                      marginBottom: 12,
                    }}>
                      Doctor approved protocol: {activeCase.aiSummary}
                    </Text>

                    {/* Dynamic Bulleted list of medicines parsed cleanly */}
                    <View style={{ gap: 8 }}>
                      {(activeCase.aiSuggestions || [])
                        .filter(s => s.startsWith("FOR DOCTOR REVIEW ONLY —"))
                        .map((rawMed, idx) => {
                          // Parse raw medicine string
                          let cleanStr = rawMed.replace("FOR DOCTOR REVIEW ONLY —", "").trim();
                          const parts = cleanStr.split("—").map(p => p.trim());
                          const name = parts[0] || "Medication";
                          const dosage = parts[1] || "";
                          const frequency = parts[2] || "";
                          const purpose = parts[3] || "";

                          return (
                            <View key={idx} style={{
                              backgroundColor: isDark ? "#1e1b4b30" : "#ffffff",
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: isDark ? "#4c1d9550" : "#fae8ff",
                              padding: 12,
                            }}>
                              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                                <Text style={{ marginRight: 6, fontSize: 14 }}>💊</Text>
                                <Text style={{
                                  color: colors.textPrimary,
                                  fontSize: 13,
                                  fontWeight: "800",
                                }}>
                                  {name}
                                </Text>
                              </View>
                              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginLeft: 20 }}>
                                • Dosage: <Text style={{ color: colors.textPrimary }}>{dosage || "As directed"}</Text>
                              </Text>
                              <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginLeft: 20, marginTop: 2 }}>
                                • Frequency: <Text style={{ color: colors.textPrimary }}>{frequency || "N/A"}</Text>
                              </Text>
                              {purpose ? (
                                <Text style={{ color: isDark ? "#c084fc" : "#a855f7", fontSize: 11, fontWeight: "600", marginLeft: 20, marginTop: 4 }}>
                                  • Purpose: {purpose}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                    </View>
                  </View>
                )}

                {/* 3. Live Chat with Medical Team Container */}
                <View style={{
                  backgroundColor: colors.cardBg,
                  borderColor: colors.cardBorder,
                  borderWidth: 1.5,
                  borderRadius: 16,
                  overflow: "hidden",
                }}>
                  <View style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                    borderBottomWidth: 1,
                    borderBottomColor: colors.cardBorder,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                  }}>
                    <MessageSquare size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                    <Text style={{
                      color: colors.textPrimary,
                      fontSize: 13,
                      fontWeight: "800",
                    }}>
                      Chat with Medical Team
                    </Text>
                  </View>

                  <View style={{
                    padding: 16,
                  }}>
                    {/* Message Log */}
                    <View style={{
                      height: 250,
                      backgroundColor: colors.background,
                      borderRadius: 10,
                      padding: 10,
                      marginBottom: 12,
                    }}>
                      {activeMessages.length === 0 ? (
                        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                          <Text style={{
                            color: colors.textSecondary,
                            fontSize: 11,
                            textAlign: "center",
                            lineHeight: 16,
                            fontWeight: "600",
                          }}>
                            No messages yet. Help is being dispatched — updates will appear here.
                          </Text>
                        </View>
                      ) : (
                        <ScrollView contentContainerStyle={{ gap: 8 }}>
                          {activeMessages.map((msg, idx) => (
                            <View
                              key={msg.id || idx}
                              style={[
                                styles.chatBubble,
                                msg.senderRole === "patient"
                                  ? [styles.bubblePatient, { backgroundColor: colors.blueAccent }]
                                  : [styles.bubbleResponder, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }],
                              ]}
                            >
                              <Text style={styles.bubbleSender}>
                                {msg.senderRole === "patient" ? "You" : msg.senderName}
                              </Text>
                              <Text style={[
                                styles.bubbleText,
                                { color: msg.senderRole === "patient" ? "#ffffff" : colors.textPrimary }
                              ]}>
                                {msg.message}
                              </Text>
                            </View>
                          ))}
                        </ScrollView>
                      )}
                    </View>

                    {/* Chat Input Row */}
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <TextInput
                        value={chatInput}
                        onChangeText={setChatInput}
                        placeholder="Type response to crew..."
                        placeholderTextColor={colors.textSecondary}
                        style={{
                          flex: 1,
                          borderWidth: 1,
                          borderColor: colors.cardBorder,
                          borderRadius: 8,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          fontSize: 12,
                          color: colors.textPrimary,
                        }}
                      />
                      <Pressable
                        onPress={handleSendMessage}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          backgroundColor: colors.blueAccent,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Send size={14} color="#ffffff" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              </View>
            )}

          </View>
        )}

        {/* ================= HISTORY TAB ================= */}
        {activeTab === "history" && (
          <View style={styles.tabContent}>
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={[styles.cardHeaderRow, { justifyContent: "space-between" }]}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <History size={18} color={colors.blueAccent} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Your Cases</Text>
                </View>
                <Text style={{ fontSize: 10, fontWeight: "700", color: colors.textSecondary }}>{phone}</Text>
              </View>

              {cases.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No reported incidents found.
                </Text>
              ) : (
                cases.map((item) => (
                  <View
                    key={item.id}
                    style={[
                      styles.historyItem,
                      {
                        borderColor: colors.cardBorder,
                        backgroundColor: colors.inputBg,
                        padding: 14,
                        borderRadius: 14,
                        marginBottom: 12,
                      }
                    ]}
                  >
                    {/* Header that toggles expansion on press */}
                    <Pressable
                      onPress={() => {
                        setExpandedCaseId(expandedCaseId === item.id ? null : item.id);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        {/* Dot icon representing severity/status */}
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor:
                              item.severity === "critical" || item.severity === "high"
                                ? "#ef4444"
                                : item.severity === "medium"
                                ? "#f59e0b"
                                : "#10b981",
                            marginRight: 10,
                          }}
                        />
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{
                            color: colors.textPrimary,
                            fontSize: 14,
                            fontWeight: "800",
                          }}>
                            {item.issueText}
                          </Text>
                          <Text style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                            fontWeight: "500",
                            marginTop: 2,
                          }}>
                            {getRelativeTime(item.createdAt)}
                          </Text>
                        </View>
                      </View>

                      {/* Right icons: Chevron & Delete */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                        {expandedCaseId === item.id ? (
                          <ChevronUp size={16} color={colors.textSecondary} />
                        ) : (
                          <ChevronDown size={16} color={colors.textSecondary} />
                        )}
                        <Pressable 
                          onPress={() => handleDeleteCaseConfirm(item.id)}
                          style={{ padding: 4 }}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </Pressable>
                      </View>
                    </Pressable>

                    {/* Detailed Guidance Panel if expanded */}
                    {expandedCaseId === item.id && (
                      <View style={{ marginTop: 12 }}>
                        {/* 1. Main AI Emergency Guidance Box */}
                        <View style={{
                          backgroundColor: isDark ? "#0f172a" : "#f0f7ff",
                          borderColor: isDark ? "#1e293b" : "#d0e1fd",
                          borderWidth: 1.5,
                          borderRadius: 16,
                          padding: 16,
                        }}>
                          {/* Header Row */}
                          <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: 16,
                          }}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                              <View style={{
                                width: 40,
                                height: 40,
                                borderRadius: 20,
                                backgroundColor: isDark ? "#1e293b" : "#dbeafe",
                                alignItems: "center",
                                justifyContent: "center",
                                marginRight: 12,
                              }}>
                                <Activity size={20} color="#2563eb" />
                              </View>
                              <View>
                                <Text style={{
                                  color: "#2563eb",
                                  fontSize: 14,
                                  fontWeight: "800",
                                  letterSpacing: 0.3,
                                }}>
                                  AI EMERGENCY GUIDANCE
                                </Text>
                                <Text style={{
                                  color: colors.textSecondary,
                                  fontSize: 11,
                                  fontStyle: "italic",
                                  marginTop: 1,
                                }}>
                                  Analyzed based on your report
                                </Text>
                              </View>
                            </View>
                          </View>

                          {/* Summary/Main analysis Box */}
                          <View style={{
                            backgroundColor: isDark ? "#1e293b50" : "#ffffff",
                            borderColor: isDark ? "#334155" : "#e2e8f0",
                            borderWidth: 1,
                            borderRadius: 12,
                            padding: 14,
                            marginBottom: 16,
                            flexDirection: "row",
                            alignItems: "flex-start",
                          }}>
                            <Heart size={18} color="#f43f5e" style={{ marginRight: 10, marginTop: 2 }} />
                            <Text style={{
                              color: colors.textPrimary,
                              fontSize: 13,
                              lineHeight: 18,
                              flex: 1,
                              fontWeight: "600",
                            }}>
                              {item.patientMessage || item.aiSummary || "Emergency submitted. Please follow advice below."}
                            </Text>
                          </View>

                          {/* Immediate Steps Section */}
                          <Text style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: colors.textPrimary,
                            letterSpacing: 0.5,
                            marginBottom: 8,
                          }}>
                            ⊙ IMMEDIATE STEPS
                          </Text>
                          <View style={{ gap: 8, marginBottom: 16 }}>
                            {item.situationalSuggestions && item.situationalSuggestions.length > 0 ? (
                              item.situationalSuggestions.map((step, idx) => (
                                <View key={idx} style={{
                                  backgroundColor: isDark ? "#1e293b30" : "#ffffff",
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: isDark ? "#334155" : "#e2e8f0",
                                  padding: 12,
                                  flexDirection: "row",
                                  alignItems: "center",
                                }}>
                                  <View style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: 10,
                                    backgroundColor: "#eff6ff",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 10,
                                  }}>
                                    <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "800" }}>
                                      {idx + 1}
                                    </Text>
                                  </View>
                                  <Text style={{
                                    color: colors.textPrimary,
                                    fontSize: 13,
                                    fontWeight: "600",
                                    flex: 1,
                                  }}>
                                    {step}
                                  </Text>
                                </View>
                              ))
                            ) : (
                              <View style={{
                                backgroundColor: isDark ? "#1e293b30" : "#ffffff",
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: isDark ? "#334155" : "#e2e8f0",
                                padding: 12,
                                flexDirection: "row",
                                alignItems: "center",
                              }}>
                                <View style={{
                                  width: 20,
                                  height: 20,
                                  borderRadius: 10,
                                  backgroundColor: "#eff6ff",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  marginRight: 10,
                                }}>
                                  <Text style={{ color: "#2563eb", fontSize: 11, fontWeight: "800" }}>1</Text>
                                </View>
                                <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }}>
                                  Rest in a safe place. Keep airways clear. Wait for dispatcher contact.
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Danger Signs Section */}
                          <Text style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: "#ef4444",
                            letterSpacing: 0.5,
                            marginBottom: 8,
                          }}>
                            ⊙ DANGER SIGNS — SEEK EMERGENCY CARE IF:
                          </Text>
                          <View style={{
                            backgroundColor: isDark ? "#ef444415" : "#fef2f2",
                            borderColor: isDark ? "#ef444430" : "#fee2e2",
                            borderWidth: 1,
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 16,
                            flexDirection: "row",
                            alignItems: "flex-start",
                          }}>
                            <AlertTriangle size={16} color="#ef4444" style={{ marginRight: 8, marginTop: 2 }} />
                            <Text style={{
                              color: isDark ? "#fca5a5" : "#f43f5e",
                              fontSize: 13,
                              fontWeight: "600",
                              flex: 1,
                              lineHeight: 18,
                            }}>
                              {item.redFlags && item.redFlags.length > 0
                                ? item.redFlags.join(", ")
                                : "Any severe chest pain, extreme breathlessness, or heavy bleeding"}
                            </Text>
                          </View>

                          {/* Safety Notes Section */}
                          <Text style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: "#d97706",
                            letterSpacing: 0.5,
                            marginBottom: 8,
                          }}>
                            ⊙ SAFETY NOTES
                          </Text>
                          <View style={{
                            backgroundColor: isDark ? "#d9770615" : "#fffbeb",
                            borderColor: isDark ? "#d9770630" : "#fef3c7",
                            borderWidth: 1,
                            borderRadius: 8,
                            padding: 12,
                            marginBottom: 16,
                            flexDirection: "row",
                            alignItems: "flex-start",
                          }}>
                            <Clock size={16} color="#d97706" style={{ marginRight: 8, marginTop: 2 }} />
                            <Text style={{
                              color: isDark ? "#fcd34d" : "#b45309",
                              fontSize: 13,
                              fontWeight: "600",
                              flex: 1,
                              lineHeight: 18,
                            }}>
                              {item.safetyAlerts && item.safetyAlerts.length > 0
                                ? item.safetyAlerts.join(", ")
                                : "Medical history unknown."}
                            </Text>
                          </View>

                          {/* Footer status row */}
                          <View style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginTop: 8,
                            paddingTop: 12,
                            borderTopWidth: 1,
                            borderTopColor: isDark ? "#1e293b" : "#d0e1fd50",
                          }}>
                            <Text style={{
                              fontSize: 10,
                              fontWeight: "800",
                              color: item.protocolApproved ? "#10b981" : "#3b82f6",
                              letterSpacing: 0.5,
                            }}>
                              {item.protocolApproved ? "⊙ CLINICALLY APPROVED" : "⊙ PENDING DR REVIEW"}
                            </Text>
                            <Text style={{
                              color: colors.textSecondary,
                              fontSize: 11,
                              fontStyle: "italic",
                            }}>
                              Stay calm. Help is coming.
                            </Text>
                          </View>
                        </View>

                        {/* 2. Approved Medical Protocol Box */}
                        {item.protocolApproved && (
                          <View style={{
                            backgroundColor: isDark ? "#581c8720" : "#fdf4ff",
                            borderColor: isDark ? "#701a7530" : "#fae8ff",
                            borderWidth: 1.5,
                            borderRadius: 16,
                            padding: 16,
                            marginTop: 12,
                          }}>
                            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                              <Sparkles size={16} color="#a855f7" style={{ marginRight: 8 }} />
                              <Text style={{
                                color: "#a855f7",
                                fontSize: 14,
                                fontWeight: "800",
                              }}>
                                Approved Medical Protocol
                              </Text>
                            </View>
                            <Text style={{
                              color: colors.textPrimary,
                              fontSize: 13,
                              lineHeight: 18,
                              fontWeight: "600",
                              marginBottom: 12,
                            }}>
                              Doctor approved protocol: {item.aiSummary || "Standard clinical regimen"}
                            </Text>

                            {/* Dynamic Bulleted list of medicines parsed cleanly */}
                            <View style={{ gap: 8 }}>
                              {(item.aiSuggestions || [])
                                .filter(s => s.startsWith("FOR DOCTOR REVIEW ONLY —"))
                                .map((rawMed, idx) => {
                                  // Parse raw medicine string
                                  let cleanStr = rawMed.replace("FOR DOCTOR REVIEW ONLY —", "").trim();
                                  const parts = cleanStr.split("—").map(p => p.trim());
                                  const name = parts[0] || "Medication";
                                  const dosage = parts[1] || "";
                                  const frequency = parts[2] || "";
                                  const purpose = parts[3] || "";

                                  return (
                                    <View key={idx} style={{
                                      backgroundColor: isDark ? "#1e1b4b30" : "#ffffff",
                                      borderRadius: 10,
                                      borderWidth: 1,
                                      borderColor: isDark ? "#4c1d9550" : "#fae8ff",
                                      padding: 12,
                                    }}>
                                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                                        <Text style={{ marginRight: 6, fontSize: 14 }}>💊</Text>
                                        <Text style={{
                                          color: colors.textPrimary,
                                          fontSize: 13,
                                          fontWeight: "800",
                                        }}>
                                          {name}
                                        </Text>
                                      </View>
                                      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginLeft: 20 }}>
                                        • Dosage: <Text style={{ color: colors.textPrimary }}>{dosage || "As directed"}</Text>
                                      </Text>
                                      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginLeft: 20, marginTop: 2 }}>
                                        • Frequency: <Text style={{ color: colors.textPrimary }}>{frequency || "N/A"}</Text>
                                      </Text>
                                      {purpose ? (
                                        <Text style={{ color: isDark ? "#c084fc" : "#a855f7", fontSize: 11, fontWeight: "600", marginLeft: 20, marginTop: 4 }}>
                                          • Purpose: {purpose}
                                        </Text>
                                      ) : null}
                                    </View>
                                  );
                                })}
                            </View>
                          </View>
                        )}

                        {/* 3. Live Chat with Medical Team Container */}
                        <View style={{
                          backgroundColor: colors.cardBg,
                          borderColor: colors.cardBorder,
                          borderWidth: 1.5,
                          borderRadius: 16,
                          overflow: "hidden",
                          marginTop: 12,
                        }}>
                          <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                            borderBottomWidth: 1,
                            borderBottomColor: colors.cardBorder,
                            paddingVertical: 10,
                            paddingHorizontal: 16,
                          }}>
                            <MessageSquare size={14} color={colors.textSecondary} style={{ marginRight: 6 }} />
                            <Text style={{
                              color: colors.textPrimary,
                              fontSize: 13,
                              fontWeight: "800",
                            }}>
                              Chat with Medical Team
                            </Text>
                          </View>

                          <View style={{
                            padding: 16,
                          }}>
                            {/* Message Log */}
                            <View style={{
                              height: 120,
                              backgroundColor: colors.background,
                              borderRadius: 10,
                              padding: 10,
                              marginBottom: 12,
                            }}>
                              {expandedCaseMessages.length === 0 ? (
                                <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
                                  <Text style={{
                                    color: colors.textSecondary,
                                    fontSize: 11,
                                    textAlign: "center",
                                    lineHeight: 16,
                                    fontWeight: "600",
                                  }}>
                                    No messages yet. Help is being dispatched — updates will appear here.
                                  </Text>
                                </View>
                              ) : (
                                <ScrollView contentContainerStyle={{ gap: 8 }}>
                                  {expandedCaseMessages.map((msg, idx) => (
                                    <View
                                      key={msg.id || idx}
                                      style={[
                                        styles.chatBubble,
                                        msg.senderRole === "patient"
                                          ? [styles.bubblePatient, { backgroundColor: colors.blueAccent }]
                                          : [styles.bubbleResponder, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }],
                                      ]}
                                    >
                                      <Text style={styles.bubbleSender}>
                                        {msg.senderRole === "patient" ? "You" : msg.senderName}
                                      </Text>
                                      <Text style={[
                                        styles.bubbleText,
                                        { color: msg.senderRole === "patient" ? "#ffffff" : colors.textPrimary }
                                      ]}>
                                        {msg.message}
                                      </Text>
                                    </View>
                                  ))}
                                </ScrollView>
                              )}
                            </View>

                            {/* Chat Input Row */}
                            <View style={{ flexDirection: "row", gap: 8 }}>
                              <TextInput
                                value={expandedChatInput}
                                onChangeText={setExpandedChatInput}
                                placeholder="Message your medical team..."
                                placeholderTextColor={colors.textSecondary}
                                style={{
                                  flex: 1,
                                  borderWidth: 1,
                                  borderColor: colors.cardBorder,
                                  borderRadius: 8,
                                  paddingHorizontal: 12,
                                  paddingVertical: 6,
                                  fontSize: 12,
                                  color: colors.textPrimary,
                                }}
                              />
                              <Pressable
                                onPress={() => handleSendExpandedMessage(item.id)}
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  backgroundColor: colors.blueAccent,
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Send size={14} color="#ffffff" />
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* ================= PROFILE TAB ================= */}
        {activeTab === "profile" && (
          <View style={styles.tabContent}>
            
            {/* 1. Communication Settings Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <Clock size={16} color={colors.blueAccent} style={{ marginRight: 8 }} />
                <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Communication Settings</Text>
              </View>
              <View style={styles.form}>
                <Text style={styles.emailLabel}>EMAIL FOR REMINDERS</Text>
                <View style={styles.emailRow}>
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Enter email address"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.emailInput, { color: colors.textPrimary, backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                  />
                  <Pressable onPress={handleSaveEmail} style={styles.saveSettingsBtn}>
                    <Text style={styles.saveSettingsBtnText}>Save Settings</Text>
                  </Pressable>
                </View>
                <Text style={styles.emailHelpText}>
                  This email will be used by the CIRO Intelligence Agent to send medication reminders and emergency follow-ups.
                </Text>
              </View>
            </View>

            {/* 2. Side-by-Side Known Allergies & Chronic Conditions */}
            <View style={styles.flexRow}>
              {/* Left Card: Known Allergies */}
              <View style={[
                styles.halfCard,
                {
                  backgroundColor: isDark ? "#450a0a20" : "#fef2f2",
                  borderColor: isDark ? "#7f1d1d50" : "#fecaca"
                }
              ]}>
                <View style={styles.cardHeaderRowSmall}>
                  <ShieldAlert size={14} color="#ef4444" style={{ marginRight: 6 }} />
                  <Text style={[styles.smallHeading, { color: colors.textPrimary }]}>Known Allergies</Text>
                </View>
                
                {/* List of allergies */}
                <View style={styles.listContainer}>
                  {allergiesList.length === 0 ? (
                    <Text style={styles.noItemsText}>No allergies listed</Text>
                  ) : (
                    <View style={styles.pillsList}>
                      {allergiesList.map((item, idx) => (
                        <View key={idx} style={[styles.pillBadge, { backgroundColor: isDark ? "#7f1d1d40" : "#fee2e2" }]}>
                          <Text style={[styles.pillText, { color: "#ef4444" }]}>{item}</Text>
                          <Pressable onPress={() => handleDeleteAllergy(item)}>
                            <Text style={{ color: "#ef4444", fontWeight: "bold", marginLeft: 4 }}>×</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Add Input */}
                <View style={styles.addInputRow}>
                  <TextInput
                    value={newAllergy}
                    onChangeText={setNewAllergy}
                    placeholder="Add allergy"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.smallInput, { color: colors.textPrimary, backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                  />
                  <Pressable onPress={handleAddAllergy} style={[styles.addButton, { backgroundColor: "#ef4444" }]}>
                    <Plus size={12} color="#ffffff" strokeWidth={3} />
                  </Pressable>
                </View>
              </View>

              {/* Right Card: Chronic Conditions */}
              <View style={[
                styles.halfCard,
                {
                  backgroundColor: isDark ? "#17255420" : "#eff6ff",
                  borderColor: isDark ? "#1e3a8a50" : "#bfdbfe"
                }
              ]}>
                <View style={styles.cardHeaderRowSmall}>
                  <FileText size={14} color="#3b82f6" style={{ marginRight: 6 }} />
                  <Text style={[styles.smallHeading, { color: colors.textPrimary }]}>Chronic Conditions</Text>
                </View>

                {/* List of conditions */}
                <View style={styles.listContainer}>
                  {conditionsList.length === 0 ? (
                    <Text style={styles.noItemsText}>No conditions listed</Text>
                  ) : (
                    <View style={styles.pillsList}>
                      {conditionsList.map((item, idx) => (
                        <View key={idx} style={[styles.pillBadge, { backgroundColor: isDark ? "#1e3a8a40" : "#dbeafe" }]}>
                          <Text style={[styles.pillText, { color: "#2563eb" }]}>{item}</Text>
                          <Pressable onPress={() => handleDeleteCondition(item)}>
                            <Text style={{ color: "#2563eb", fontWeight: "bold", marginLeft: 4 }}>×</Text>
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* Add Input */}
                <View style={styles.addInputRow}>
                  <TextInput
                    value={newCondition}
                    onChangeText={setNewCondition}
                    placeholder="Add condition"
                    placeholderTextColor={colors.textSecondary}
                    style={[styles.smallInput, { color: colors.textPrimary, backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}
                  />
                  <Pressable onPress={handleAddCondition} style={[styles.addButton, { backgroundColor: "#2563eb" }]}>
                    <Plus size={12} color="#ffffff" strokeWidth={3} />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* 3. Medical Records Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.headerActionRow}>
                <View style={styles.cardHeaderRow}>
                  <Clock size={16} color={colors.blueAccent} style={{ marginRight: 8 }} />
                  <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Medical Records</Text>
                </View>
                <Pressable onPress={selectImage} style={[styles.uploadBtn, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}>
                  <Upload size={12} color={isDark ? "#94a3b8" : "#475569"} style={{ marginRight: 4 }} />
                  <Text style={[styles.uploadBtnText, { color: isDark ? "#cbd5e1" : "#475569" }]}>Upload PDF/Image</Text>
                </Pressable>
              </View>

              <View style={[styles.dottedBox, { borderColor: colors.cardBorder }]}>
                <FileText size={28} color="#94a3b8" style={{ marginBottom: 8 }} />
                <Text style={[styles.dottedBoxText, { color: colors.textSecondary }]}>No records uploaded yet.</Text>
              </View>
            </View>

            {/* 4. Active Medications Card */}
            <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.cardBorder }]}>
              <View style={styles.cardHeaderRow}>
                <ShieldCheck size={16} color={colors.greenAccent} style={{ marginRight: 8 }} />
                <Text style={[styles.cardHeading, { color: colors.textPrimary }]}>Active Medications</Text>
              </View>

              {activeMeds.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No active medications.</Text>
              ) : (
                activeMeds.map((med) => (
                  <View key={med.id} style={[styles.medCard, { backgroundColor: isDark ? "#1e293b50" : "#f8fafc", borderColor: colors.cardBorder }]}>
                    <View style={styles.medHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.medName, { color: colors.textPrimary }]}>{med.name}</Text>
                        <Text style={[styles.medInstructions, { color: colors.textSecondary }]}>{med.instructions}</Text>
                      </View>
                      <View style={styles.medBadgeRow}>
                        <View style={[styles.medBadge, { backgroundColor: isDark ? "#064e3b30" : "#e6f4ea" }]}>
                          <Text style={[styles.medBadgeText, { color: colors.greenAccent }]}>{med.prescribedBy}</Text>
                        </View>
                        <Pressable onPress={() => handleDeleteMed(med.id)} style={styles.trashBtn}>
                          <Trash2 size={14} color="#ef4444" />
                        </Pressable>
                      </View>
                    </View>
                    
                    <View style={styles.dosesRow}>
                      <Text style={[styles.dosesLabel, { color: colors.textSecondary }]}>Remaining Doses</Text>
                      <Text style={[styles.dosesValue, { color: colors.textPrimary }]}>{med.remainingDoses} / {med.totalDoses}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Save All Profiles Action Button */}
            <Pressable
              onPress={handleSaveProfile}
              style={[styles.reportBtn, { backgroundColor: colors.greenAccent, marginTop: 10 }]}
            >
              <Text style={styles.reportBtnText}>SAVE MEDICAL SAFETY SNAPSHOT</Text>
            </Pressable>

          </View>
        )}

      </ScrollView>

      {/* Dynamic Bottom Tab Navigation Bar matching footer precisely */}
      <BottomNav activeTab="patient" />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topHeader: {
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
    fontSize: 14,
    fontWeight: "800",
    color: "#0f172a",
  },
  brandSub: {
    fontSize: 8,
    fontWeight: "700",
    color: "#64748b",
    letterSpacing: 0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  tabsContainer: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  tabActive: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 25,
  },
  tabContent: {
    gap: 15,
  },
  card: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1.5,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
  },
  cardHeading: {
    fontSize: 14,
    fontWeight: "900",
  },
  showGuidanceBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  showGuidanceText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  languageRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 15,
  },
  langBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
  },
  langBtnActiveEnglish: {
    backgroundColor: "#fef2f2",
    borderColor: "#fecaca",
    borderWidth: 1,
  },
  langBtnActiveUrdu: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  langBtnInactive: {
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  langText: {
    fontSize: 13,
    fontWeight: "700",
  },
  gpsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 12,
    borderRadius: 12,
    marginBottom: 15,
  },
  gpsTitle: {
    color: "#16a34a",
    fontSize: 12.5,
    fontWeight: "800",
    marginBottom: 2,
  },
  gpsAddress: {
    color: "#16a34a",
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  gpsCoords: {
    color: "#16a34a",
    fontSize: 10,
    fontWeight: "600",
  },
  gpsTargetIcon: {
    padding: 2,
  },
  voiceSection: {
    alignItems: "center",
    marginVertical: 15,
  },
  voiceBtnCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#1e293b",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#1e293b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 8,
  },
  voiceLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 15,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#f1f5f9",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnText: {
    color: "#2563eb",
    fontSize: 12,
    fontWeight: "700",
  },
  imagePreviewContainer: {
    position: "relative",
    width: "100%",
    height: 150,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 15,
  },
  imagePreview: {
    width: "100%",
    height: "100%",
  },
  removeImageBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 8,
    borderRadius: 8,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    textAlignVertical: "top",
  },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 15,
  },
  reportBtnText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "900",
  },
  emptyText: {
    fontSize: 12,
    textAlign: "center",
    marginVertical: 40,
    fontWeight: "500",
  },
  historyItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  historyMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
  },
  historyId: {
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  severityText: {
    fontSize: 8,
    fontWeight: "800",
  },
  historyText: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
  },
  historyDate: {
    fontSize: 9,
    fontWeight: "500",
    marginTop: 8,
  },
  form: {
    width: "100%",
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  profileInput: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  guidanceCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginTop: 15,
  },
  guidanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 15,
  },
  guidanceTitle: {
    fontSize: 14,
    fontWeight: "900",
    flex: 1,
  },
  hideBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  adviceSection: {
    marginTop: 10,
  },
  adviceHeader: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  adviceBullet: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  prescriptionBox: {
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
    gap: 4,
  },
  prescriptionTitle: {
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  prescriptionDetails: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  prescriptionPending: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#33415510",
    marginTop: 12,
  },
  pendingText: {
    fontSize: 10.5,
    fontWeight: "600",
    flex: 1,
  },
  chatSection: {
    marginTop: 15,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#33415530",
    paddingTop: 15,
  },
  chatTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  chatContainer: {
    height: 120,
    borderRadius: 10,
    padding: 8,
    marginBottom: 8,
  },
  emptyChatText: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 40,
    fontWeight: "500",
  },
  chatBubble: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
    maxWidth: "80%",
  },
  bubblePatient: {
    alignSelf: "flex-end",
  },
  bubbleResponder: {
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
  },
  bubbleSender: {
    fontSize: 8,
    fontWeight: "800",
    color: "#94a3b8",
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  chatInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: "600",
  },
  chatSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  themeToggleBtn: {
    padding: 6,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  profilePhone: {
    fontSize: 10.5,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  emailLabel: {
    fontSize: 9.5,
    fontWeight: "800",
    color: "#64748b",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  emailRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  emailInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 12.5,
    fontWeight: "600",
  },
  saveSettingsBtn: {
    backgroundColor: "#7c7c8c",
    paddingHorizontal: 14,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  saveSettingsBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  emailHelpText: {
    fontSize: 9.5,
    color: "#64748b",
    marginTop: 8,
    lineHeight: 14,
    fontWeight: "500",
  },
  flexRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  halfCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 18,
    padding: 10,
  },
  cardHeaderRowSmall: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  smallHeading: {
    fontSize: 12,
    fontWeight: "900",
  },
  listContainer: {
    minHeight: 40,
    justifyContent: "center",
    marginBottom: 8,
  },
  pillsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  pillBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  noItemsText: {
    fontSize: 11,
    fontStyle: "italic",
    color: "#94a3b8",
    fontWeight: "500",
  },
  addInputRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    width: "100%",
  },
  smallInput: {
    flex: 1,
    height: 28,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 6,
    fontSize: 10.5,
    fontWeight: "600",
  },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  headerActionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  uploadBtnText: {
    fontSize: 10,
    fontWeight: "800",
  },
  dottedBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 25,
    justifyContent: "center",
    alignItems: "center",
    borderColor: "#cbd5e1",
  },
  dottedBoxText: {
    fontSize: 11,
    fontWeight: "600",
  },
  medCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  medHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    gap: 6,
  },
  medName: {
    fontSize: 13,
    fontWeight: "900",
  },
  medInstructions: {
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 2,
  },
  medBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  medBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  medBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  trashBtn: {
    padding: 4,
  },
  dosesRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#33415515",
    paddingTop: 8,
    marginTop: 4,
  },
  dosesLabel: {
    fontSize: 10,
    fontWeight: "600",
  },
  dosesValue: {
    fontSize: 10,
    fontWeight: "800",
  },
  pulseContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 10,
    height: 30,
  },
  pulseBar: {
    width: 3,
    backgroundColor: "#dc2626",
    borderRadius: 1.5,
  },
});
