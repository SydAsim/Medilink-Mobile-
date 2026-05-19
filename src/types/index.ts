// ============================================
// MediLink Type Definitions
// ============================================

export type Severity = "critical" | "high" | "medium" | "low";
export type CaseStatus = "pending" | "assigned" | "in-progress" | "dispatched" | "arrived" | "resolved" | "completed" | "closed";
export type UserRole = "patient" | "doctor" | "emergency";
export type Language = "english" | "urdu" | "pashto";
export type CrisisType = "flood" | "fire" | "accident" | "outage" | "disease" | "protest" | "heatwave" | "unknown";

export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  accuracy?: number;
  timestamp: number;
}

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  startDate: number;
  endDate?: number;
  prescribedBy: string;
  remainingDoses: number;
  totalDoses: number;
}

export interface PatientProfile {
  phone: string;
  name?: string;
  email?: string;
  allergies: string[];
  chronicConditions: string[];
  bloodGroup?: string;
  currentMedications: Medication[];
  pastMedicalRecords: string[]; // URLs to uploaded documents
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };
}

export interface PatientCase {
  id: string;
  patientPhone: string;
  patientName?: string;
  language: Language;
  issueText: string;
  imageUrl?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  severity: Severity;
  aiSummary: string;
  aiSuggestions: string[];
  situationalSuggestions?: string[]; // New: First aid/immediate actions
  emergencyRequired: boolean;
  status: CaseStatus;
  address?: string;
  nearbyLandmarks?: string[];
  assignedDoctorId?: string;
  protocolApproved?: boolean;
  createdAt: number;
  updatedAt?: number;
  // New fields for medical safety
  medicalHistorySnapshot?: {
    allergies: string[];
    conditions: string[];
  };
  safetyAlerts?: string[]; // AI-generated warnings (e.g., "Allergic to Penicillin")
  isSpam?: boolean;        // New: For non-medical/joke reports
  isSystemTest?: boolean;  // New: For internal testing/demo cases
  patientMessage?: string;
  redFlags?: string[];
  detectedLanguage?: string;
  normalizedInputEnglish?: string;
  doctorSummary?: string;
  recommendedFirstAid?: string[];
  doctorReviewMedicines?: string[];
}

export interface AIAnalysis {
  detectedLanguage?: string;
  normalizedInputEnglish?: string;
  possibleConditions: string[];
  recommendedFirstAid?: string[];
  doctorReviewMedicines?: string[];
  recommendedActions: string[]; // For backwards compatibility
  situationalSuggestions?: string[];
  redFlags?: string[];
  safetyWarnings?: string[];
  triageLevel: Severity;
  confidence: number;
  patientMessage?: string;
  doctorSummary?: string;
  summary: string;
  requiresImmediate: boolean;
}

export interface ChatMessage {
  id: string;
  caseId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  message: string;
  timestamp: number;
}

export interface DispatchInfo {
  caseId: string;
  ambulanceId?: string;
  dispatchedAt: number;
  estimatedArrival?: number;
  status: "dispatched" | "en-route" | "arrived" | "completed";
  notes?: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon: string;
  role: UserRole;
  description?: string;
}

// ============================================
// CIRO Intelligence Types
// ============================================

export interface IntelligenceLog {
  id: string;
  caseId?: string;
  crisisId?: string;
  agentName: "Orchestrator" | "TriageAgent" | "LogisticsAgent" | "IntelAgent" | "StrategistAgent";
  thought: string;
  action?: string;
  confidence?: number;
  timestamp: number;
}

export interface CrisisEvent {
  id: string;
  type: CrisisType;
  location: {
    lat: number;
    lng: number;
    address: string;
    radius: number; // affected radius in meters
  };
  severity: Severity;
  confidence: number;
  description: string;
  signals: {
    caseIds: string[];
    socialCount: number;
    sensorAlerts: string[];
  };
  status: "active" | "resolved" | "false-alarm";
  createdAt: number;
  updatedAt: number;
}

export interface ScheduledTask {
  id: string;
  type: "medication_reminder" | "emergency_followup";
  targetPhone: string;
  targetEmail?: string;
  data: any; // e.g., { medicine: "Panadol", dosage: "500mg" }
  scheduledFor: number; // Timestamp
  status: "pending" | "executed" | "cancelled" | "failed";
  createdAt: number;
}
