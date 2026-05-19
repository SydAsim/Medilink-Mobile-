import { db } from "../firebase/config";
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
  getDocs
} from "firebase/firestore";
import { sendEmergencyReminder } from "./notificationService";
import { getPatientProfile } from "./profileService";
import type { IntelligenceLog, ScheduledTask } from "../types";

/**
 * Adds a new thought/log to the AI Intelligence Feed
 */
export async function addIntelligenceLog(log: Omit<IntelligenceLog, "id" | "timestamp">) {
  try {
    // Bulletproof deduplication: if this is a case-specific action, check if it already exists
    if (log.caseId && log.action) {
      const q = query(
        collection(db, "intelligence_logs"),
        where("caseId", "==", log.caseId),
        where("action", "==", log.action)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        console.log(`[CIRO Deduplicator] Skipped duplicate log: [${log.action}] for case ${log.caseId}`);
        return snap.docs[0].id;
      }
    }
    
    // Also check for global/system tasks to avoid duplicates on quick clicks
    if (!log.caseId && log.action) {
      const q = query(
        collection(db, "intelligence_logs"),
        where("action", "==", log.action),
        where("thought", "==", log.thought)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].id;
      }
    }

    const docRef = await addDoc(collection(db, "intelligence_logs"), {
      ...log,
      timestamp: Date.now(),
      serverTimestamp: serverTimestamp(),
    });
    return docRef.id;
  } catch (e) {
    console.error("Error adding intelligence log:", e);
    return null;
  }
}

/**
 * Subscribes to live intelligence logs for a specific case or crisis
 */
export function subscribeToIntelligenceLogs(
  targetId: string, 
  type: "case" | "crisis", 
  callback: (logs: IntelligenceLog[]) => void
) {
  const field = type === "case" ? "caseId" : "crisisId";
  const q = query(
    collection(db, "intelligence_logs"),
    where(field, "==", targetId)
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }) as IntelligenceLog)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    callback(logs);
  });
}

/**
 * Subscribes to ALL city-wide intelligence logs (for the Command Center)
 */
export function subscribeToAllIntelligence(callback: (logs: IntelligenceLog[]) => void) {
  const q = query(
    collection(db, "intelligence_logs")
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as IntelligenceLog[];
    
    // In-memory sort to avoid Firestore index requirements on complex orders
    const sorted = logs.sort((a, b) => b.timestamp - a.timestamp);
    callback(sorted);
  });
}

/**
 * Continuity Agent: Schedules and sends medication reminders
 */
export async function scheduleMedicineReminders(
  phone: string, 
  medDetails: { name: string; dosage: string; frequency: string; purpose?: string },
  clientNow?: number
) {
  const referenceTime = clientNow || Date.now();
  
  // 1. Log the Agent's reasoning
  await addIntelligenceLog({
    agentName: "StrategistAgent",
    thought: `Analyzing doctor's prescription for ${phone}. Medicine: ${medDetails.name}. Syncing with Patient Local Time.`,
    confidence: 1.0,
    action: "TIMEZONE_SYNC"
  });

  // 2. Extract Time from frequency string (e.g. "Take at 11 : 00 PM")
  let scheduledTime: number | null = null;
  const timeMatch = medDetails.frequency.match(/(\d{1,2})\s*:\s*(\d{2})\s*(AM|PM)/i);
  
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = parseInt(timeMatch[2]);
    const ampm = timeMatch[3].toUpperCase();
    
    const scheduledDate = new Date(referenceTime);
    let finalHours = ampm === "PM" && hours < 12 ? hours + 12 : hours;
    if (ampm === "AM" && hours === 12) finalHours = 0;
    
    scheduledDate.setHours(finalHours, minutes, 0, 0);
    
    // If time already passed today, schedule for tomorrow
    if (scheduledDate.getTime() < referenceTime) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }
    scheduledTime = scheduledDate.getTime();
  }

  // 3. Log parsing result
  if (scheduledTime) {
    const timeStr = new Date(scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    await addIntelligenceLog({
      agentName: "StrategistAgent",
      thought: `Time extraction successful: Detected ${timeStr}. Queuing autonomous task in CIRO Temporal Buffer.`,
      confidence: 1.0,
      action: "TASK_QUEUED"
    });

    // 4. Save to Scheduled Tasks collection
    try {
      const profile = await getPatientProfile(phone);
      await addDoc(collection(db, "scheduled_tasks"), {
        type: "medication_reminder",
        targetPhone: phone,
        targetEmail: profile?.email || null,
        data: medDetails,
        scheduledFor: scheduledTime,
        status: "pending",
        createdAt: Date.now()
      });
    } catch (e) {
      console.error("Failed to queue task:", e);
    }
  } else {
    // Fallback: If no time detected, send a courtesy reminder immediately for demo
    await addIntelligenceLog({
      agentName: "StrategistAgent",
      thought: `No specific time detected in "${medDetails.frequency}". Defaulting to immediate 'General Adherence' reminder.`,
      confidence: 0.8
    });
    
    const profile = await getPatientProfile(phone);
    const patientEmail = profile?.email || "syedasim2021@gmail.com"; 
    await sendEmergencyReminder(phone, patientEmail, medDetails);
    
    await addIntelligenceLog({
      agentName: "Orchestrator",
      thought: "Courtesy reminder dispatched. Continuity loop completed.",
      confidence: 1.0,
      action: "NOTIFICATION_SENT"
    });
  }
}

/**
 * Executes a pending task
 */
export async function executeScheduledTask(taskId: string) {
  try {
    const taskRef = doc(db, "scheduled_tasks", taskId);
    await updateDoc(taskRef, { status: "executed", executedAt: Date.now() });
    return true;
  } catch (e) {
    console.error("Task execution failed:", e);
    return false;
  }
}

/**
 * Subscribes to pending tasks
 */
export function subscribeToScheduledTasks(callback: (tasks: ScheduledTask[]) => void) {
  const q = query(
    collection(db, "scheduled_tasks"),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ScheduledTask[];
    
    // Sort in memory instead of database level to avoid index errors
    const sortedTasks = tasks.sort((a, b) => a.scheduledFor - b.scheduledFor);
    callback(sortedTasks);
  });
}
