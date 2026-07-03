"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../lib/firebase";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);

  const createOrLoadUser = async (firebaseUser) => {
    const ref = doc(db, "bsc_users", firebaseUser.uid);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      const newPlayer = {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || "BSCプレイヤー",
        email: firebaseUser.email || "",
        photoURL: firebaseUser.photoURL || "",
        point: Number(localStorage.getItem("bscPoint") || 0),
        badges: JSON.parse(localStorage.getItem("bscBadge") || "[]"),
        cleared: JSON.parse(localStorage.getItem("bscCleared") || "[]"),
        bonds: {
          ichika: Number(localStorage.getItem("bscBond_ichika") || 0),
          kiina: Number(localStorage.getItem("bscBond_kiina") || 0),
          hatsune: Number(localStorage.getItem("bscBond_hatsune") || 0),
        },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, newPlayer);
      setPlayer(newPlayer);
      return newPlayer;
    }

    const data = snap.data();
    setPlayer(data);
    return data;
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result?.user) {
          setUser(result.user);
          await createOrLoadUser(result.user);
        }
      } catch (error) {
        console.error("redirect login error:", error);
      }

      const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        setUser(firebaseUser);

        if (firebaseUser) {
          await createOrLoadUser(firebaseUser);
        } else {
          setPlayer(null);
        }

        setLoading(false);
      });

      return unsub;
    };

    let unsubscribe;
    initAuth().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const loginWithGoogle = async () => {
    await signInWithRedirect(auth, googleProvider);
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setPlayer(null);
  };

  return (
    <AuthContext.Provider value={{ user, player, loading, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
