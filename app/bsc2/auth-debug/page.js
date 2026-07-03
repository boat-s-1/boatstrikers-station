"use client";

import { auth } from "../lib/firebase";

export default function AuthDebugPage() {
  return (
    <main className="bscPage">
      <section className="bscCard">
        <h1 className="bscTitle">Firebase Debug</h1>

        <p>apiKey: {process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "OK" : "NG"}</p>
        <p>authDomain: {process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "NG"}</p>
        <p>projectId: {process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "NG"}</p>
        <p>appName: {auth.app.name}</p>
      </section>
    </main>
  );
}
