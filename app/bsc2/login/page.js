"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { user, player, loading, loginWithGoogle, logout } = useAuth();

  if (loading) {
    return <main className="bscPage">読み込み中...</main>;
  }

  return (
    <main className="bscPage">
      <section className="bscCard" style={{ textAlign: "center" }}>
        <h1 className="bscTitle">🔐 BSCログイン</h1>

        {!user ? (
          <>
            <p className="bscSub">
              Googleでログインすると、ポイント・親密度・クリア状況を保存できます。
            </p>

            <button
              className="bscBtn bscBtnPrimary"
              type="button"
              onClick={loginWithGoogle}
              style={{ marginTop: 16 }}
            >
              Googleでログイン
            </button>
          </>
        ) : (
          <>
            <img
              src={player?.photoURL || "/bsc/status-ichika.png"}
              alt="user"
              style={{
                width: 90,
                height: 90,
                borderRadius: "50%",
                border: "4px solid #FFD768",
              }}
            />

            <h2>{player?.name || "BSCプレイヤー"}</h2>
            <p className="bscSub">ログイン済みです</p>

            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              <button
                className="bscBtn bscBtnGreen"
                type="button"
                onClick={() => router.push("/bsc2")}
              >
                BSCホームへ
              </button>

              <button className="bscBtn bscBtnBlue" type="button" onClick={logout}>
                ログアウト
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
