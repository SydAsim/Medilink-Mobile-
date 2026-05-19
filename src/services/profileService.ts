import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import type { PatientProfile, Medication } from "../types";

const PROFILES_COLLECTION = "patient_profiles";

export async function getPatientProfile(phone: string): Promise<PatientProfile | null> {
  const snap = await getDoc(doc(db, PROFILES_COLLECTION, phone.trim()));
  if (snap.exists()) return snap.data() as PatientProfile;
  return null;
}

export async function updatePatientProfile(phone: string, updates: Partial<PatientProfile>): Promise<void> {
  const profileRef = doc(db, PROFILES_COLLECTION, phone.trim());
  const snap = await getDoc(profileRef);
  
  if (snap.exists()) {
    await updateDoc(profileRef, { ...updates, updatedAt: Date.now() });
  } else {
    await setDoc(profileRef, {
      phone,
      allergies: [],
      chronicConditions: [],
      currentMedications: [],
      pastMedicalRecords: [],
      ...updates,
      createdAt: Date.now(),
    });
  }
}

export async function uploadMedicalRecord(phone: string, localUri: string, originalName: string): Promise<string> {
  const filename = `medical-records/${phone}/${Date.now()}_${originalName}`;
  const storageRef = ref(storage, filename);
  
  // Resolve local file URI to blob
  const response = await fetch(localUri);
  const blob = await response.blob();
  
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  
  // Add to profile
  const profile = await getPatientProfile(phone);
  const records = profile?.pastMedicalRecords || [];
  await updatePatientProfile(phone, { pastMedicalRecords: [...records, url] });
  
  return url;
}

export async function addPrescriptionToHistory(phone: string, medication: Omit<Medication, "id">): Promise<void> {
  const profile = await getPatientProfile(phone);
  const meds = profile?.currentMedications || [];
  
  const newMed: Medication = {
    ...medication,
    id: Math.random().toString(36).slice(2, 9),
    startDate: Date.now(),
  };
  
  await updatePatientProfile(phone, { currentMedications: [...meds, newMed] });
}

export async function updateMedicationRemaining(phone: string, medId: string, remaining: number): Promise<void> {
  const profile = await getPatientProfile(phone);
  if (!profile) return;
  
  const meds = profile.currentMedications.map(m => 
    m.id === medId ? { ...m, remainingDoses: remaining } : m
  );
  
  await updatePatientProfile(phone, { currentMedications: meds });
}
