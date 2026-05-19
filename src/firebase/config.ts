import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeFirestore, getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your mobile app's Firebase configuration (same as web app)
const firebaseConfig = {
  apiKey: "AIzaSyBStWiRE86cHi7j5DL9WSOK-0sVdbUBvkA",
  authDomain: "fourth-case-416809.firebaseapp.com",
  projectId: "fourth-case-416809",
  storageBucket: "fourth-case-416809.firebasestorage.app",
  messagingSenderId: "495628949370",
  appId: "1:495628949370:web:d72c4d276c39bafa0ee8c3",
};

// Initialize Firebase - prevent duplicate initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom settings for React Native if needed
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

// Initialize Firebase Storage
const storage = getStorage(app);

export { app, db, storage };
