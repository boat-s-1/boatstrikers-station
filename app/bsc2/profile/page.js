"use client";

import { useAuth } from "../context/AuthContext";

export default function BscProfilePage() {
  const { user, player, loading, logout } = useAuth();

  if (loading) {
    return <main className="bscPage">読み込み中...</main>;
  }

  if (!user) {
    return (
      <main className="bscPage">
        <section className="bscCard" style={{ textAlign: "center" }}>
          <h1 className="bscTitle">🔐 ログインが必要です</h1>
          <p className="bscSub">マイページを見るにはログインしてください。</p>
          <a href="/bsc2/login" className="bscBtn bscBtnPrimary">
            Googleでログイン
          </a>
        </section>
      </main>
    );
  }

  const point = player?.point || 0;
  const badges = player?.badges || [];
  const cleared = player?.cleared || [];
  const bonds = player?.bonds || {};

  const level = Math.floor(point / 100) + 1;
  const exp = point % 100;

  return (
    <main className="bscPage">
      <header className="bscHeader">
        <div>
          <span>BSC MY PAGE</span>
          <h1>マイページ</h1>
        </div>
        <a href="/bsc2" className="bscBtn bscBtnGold">戻る</a>
      </header>

      <section className="bscCard" style={{ textAlign: "center" }}>
        <img
          src={player?.photoURL || "/bsc/status-ichika.png"}
          alt="player"
          style={{
            width: 110,
            height: 110,
            borderRadius: 32,
            border: "4px solid #FFD768",
            objectFit: "cover",
          }}
        />

        <h2 className="bscTitle" style={{ marginTop: 12 }}>
          {player?.name || "BSCプレイヤー"}
        </h2>

        <span className="bscBadge">🌱 見習いクルー</span>

        <div className="bscLevel" style={{ marginTop: 18 }}>
          <p><b>LEVEL {level}</b> / EXP {exp}/100</p>
          <div className="bscLevelBar">
            <span style={{ width: `${exp}%` }} />
          </div>
        </div>

        <div className="bscGrid bscGrid2" style={{ marginTop: 18 }}>
          <div className="bscCard">
            <h2 className="bscTitle">⭐ {point}</h2>
            <p className="bscSub">ポイント</p>
          </div>

          <div className="bscCard">
            <h2 className="bscTitle">🏅 {badges.length}</h2>
            <p className="bscSub">バッジ</p>
          </div>

          <div className="bscCard">
            <h2 className="bscTitle">🎮 {cleared.length}</h2>
            <p className="bscSub">クリア数</p>
          </div>

          <div className="bscCard">
            <h2 className="bscTitle">🔥 {player?.loginStreak || 1}</h2>
            <p className="bscSub">連続ログイン</p>
          </div>
        </div>
      </section>

      <section className="bscCard">
        <h2 className="bscTitle">❤️ キャラ親密度</h2>

        <BondBar icon="🌸" name="一果" value={bonds.ichika || 0} />
        <BondBar icon="⚡" name="キイナ" value={bonds.kiina || 0} />
        <BondBar icon="💜" name="初音" value={bonds.hatsune || 0} />
      </section>

      <section className="bscCard">
        <h2 className="bscTitle">📚 プレイ情報</h2>

        <div className="bscGrid">
          <a href="/bsc2/practice/talk" className="bscBtn bscBtnPrimary">
            💬 会話問題へ
          </a>

          <a href="/bsc2/collection" className="bscBtn bscBtnGold">
            🏅 バッジコレクション
          </a>

          <a href="/library" className="bscBtn bscBtnBlue">
            📚 一果図書館
          </a>

          <button type="button" onClick={logout} className="bscBtn bscBtnBlue">
            ログアウト
          </button>
        </div>
      </section>
    </main>
  );
}

function BondBar({ icon, name, value }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: 900,
        color: "#17345c",
      }}>
        <span>{icon} {name}</span>
        <b>{value}%</b>
      </div>

      <div className="bscLevelBar" style={{ marginTop: 8 }}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
