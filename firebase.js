// firebase.js — Keraniganj.com Firebase Configuration

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, increment } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBHagEJrvZCyD8XHIqdNzGE39hr7jiDiQw",
  authDomain: "keraniganj-dbf1b.firebaseapp.com",
  projectId: "keraniganj-dbf1b",
  storageBucket: "keraniganj-dbf1b.firebasestorage.app",
  messagingSenderId: "252291358700",
  appId: "1:252291358700:web:4a2318ccf1d172152b2ac9",
  measurementId: "G-GPFSVHCG47"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

export { auth, db, provider, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, collection, addDoc, getDocs, query, orderBy, serverTimestamp, updateDoc, doc, increment };
