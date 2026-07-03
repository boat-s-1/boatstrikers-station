"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithRedirect,
  signInWithPopup,
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
    if (!firebaseUser) return null;

    const ref = doc(db, "bsc_users", firebaseUser.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      setPlayer(data);
      return data;
    }

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
  };

  useEffect(() => {
    let unsub = () => {};

    const start = async () => {
      try {
        await getRedirectResult(auth);
      } catch (error) {
        console.error("getRedirectResult error:", error);
        alert(`ログイン結果エラー: ${error.code || ""}\n${error.message || error}`);
      }

      unsub = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          setUser(firebaseUser);

          if (firebaseUser) {
            await createOrLoadUser(firebaseUser);
          } else {
            setPlayer(null);
          }
        } catch (error) {
          console.error("auth state error:", error);
          alert(`ログイン処理エラー: ${error.code || ""}\n${error.message || error}`);
        } finally {
          setLoading(false);
        }
      });
    };

    start();

    return () => unsub();
  }, []);

  const loginWithGoogle = async () => {
  try {
    setLoading(true);

    const result = await signInWithPopup(auth, googleProvider);

    setUser(result.user);
    await createOrLoadUser(result.user);

    alert("ログイン成功しました");
  } catch (error) {
    setLoading(false);
    console.error("login error:", error);
    alert(`ログインエラー: ${error.code || ""}\n${error.message || error}`);
  }
};

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setPlayer(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        player,
        loading,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
