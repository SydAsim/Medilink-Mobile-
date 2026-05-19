import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import type { PatientCase, CaseStatus } from "../types";

const CASES_COLLECTION = "cases";

export async function createCase(
  caseData: Omit<PatientCase, "id" | "createdAt">
): Promise<string> {
  const docRef = await addDoc(collection(db, CASES_COLLECTION), {
    ...caseData,
    createdAt: Date.now(),
  });
  console.log("✅ Case created inside Mobile:", docRef.id);
  return docRef.id;
}

export async function getCase(caseId: string): Promise<PatientCase | null> {
  const snap = await getDoc(doc(db, CASES_COLLECTION, caseId));
  if (snap.exists()) return { id: snap.id, ...snap.data() } as PatientCase;
  return null;
}

export async function getAllCases(): Promise<PatientCase[]> {
  const q = query(collection(db, CASES_COLLECTION));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as PatientCase))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function getCasesByPhone(phone: string): Promise<PatientCase[]> {
  const q = query(
    collection(db, CASES_COLLECTION),
    where("patientPhone", "==", phone.trim())
  );
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as PatientCase))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function updateCaseStatus(
  caseId: string,
  status: CaseStatus
): Promise<void> {
  const caseRef = doc(db, CASES_COLLECTION, caseId);
  await updateDoc(caseRef, { status, updatedAt: Date.now() });
}

export async function updateCase(
  caseId: string,
  updates: Partial<PatientCase>
): Promise<void> {
  await updateDoc(doc(db, CASES_COLLECTION, caseId), {
    ...updates,
    updatedAt: Date.now(),
  });
}

export async function deleteCase(caseId: string): Promise<void> {
  await deleteDoc(doc(db, CASES_COLLECTION, caseId));
}

export function subscribeToAllCases(
  callback: (cases: PatientCase[]) => void
): () => void {
  const q = query(collection(db, CASES_COLLECTION));
  
  return onSnapshot(
    q,
    (snapshot) => {
      const cases = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as PatientCase))
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(cases);
    },
    (error) => {
      console.error("❌ Mobile listener error:", error);
      callback([]);
    }
  );
}

export function subscribeToCasesByPhone(
  phone: string,
  callback: (cases: PatientCase[]) => void
): () => void {
  const q = query(
    collection(db, CASES_COLLECTION),
    where("patientPhone", "==", phone.trim())
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const cases = snapshot.docs
        .map((d) => ({ id: d.id, ...d.data() } as PatientCase))
        .sort((a, b) => b.createdAt - a.createdAt);
      callback(cases);
    },
    (error) => {
      console.error("❌ Mobile subscriber error:", error);
      callback([]);
    }
  );
}

export async function uploadCaseImage(localUri: string): Promise<string> {
  const filename = `case-images/${Date.now()}_mobile.jpg`;
  const storageRef = ref(storage, filename);
  
  // Fetch local URI and convert to Blob for Firebase Storage (Expo compatible)
  const response = await fetch(localUri);
  const blob = await response.blob();
  
  await uploadBytes(storageRef, blob);
  const url = await getDownloadURL(storageRef);
  console.log("✅ Mobile image uploaded successfully to Storage:", url);
  return url;
}
