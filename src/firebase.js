import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from "firebase/firestore";

// Konfigurasi Firebase dari Environment Variables (Vite)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

// Deteksi konfigurasi API key kosong / belum diatur
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "your_rotated_api_key") {
  console.warn("[Firebase Warning] Kredensial Firebase belum dikonfigurasi di file .env.local!\n" + "Pastikan Anda telah menyalin .env.example menjadi .env.local dan mengisi API Key baru.");
}

// Initialize Firebase App, Auth & Firestore
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where };
