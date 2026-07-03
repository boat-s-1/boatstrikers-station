"use client";

import { useAuth } from "../context/AuthContext";

export default function BscProfilePage() {
  const { user, player, loading, logout } = useAuth();

  if (loading) return <main className="bscPage">読み込み中...</main>;

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
  const title =
    level >= 20 ? "🏆 BSCマスター" :
    level >= 10 ? "🚤 実践クルー" :
    level >= 5 ? "🌊 成長中レーサー" :
    "🌱 見習いクルー";

  return (
    <main className="bscPage">
      <style>{`
        .profileHeroV2{
          position:relative;
          overflow:hidden;
          text-align:center;
          padding:22px 16px;
          background:
            linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,247,223,.96)),
            radial-gradient(circle at top,#ff4f93,transparent 50%);
        }

        .profileHeroV2:before{
          content:"";
          position:absolute;
          inset:-80px;
          background:radial-gradient(circle,rgba(255,215,104,.45),transparent 55%);
          animation:profileAura 3s infinite;
        }

        .profileAvatarV2{
          position:relative;
          z-index:2;
          width:118px;
          height:118px;
          object-fit:cover;
          border-radius:34px;
          border:5px solid #ffd768;
          background:#fff;
          box-shadow:0 14px 30px rgba(0,0,0,.28);
          animation:profileFloat 2.2s ease-in-out infinite;
        }

        .profileNameV2{
          position:relative;
          z-index:2;
          margin:12px 0 6px;
          font-size:28px;
          color:#17345c;
          font-weight:900;
        }

        .profileTitleV2{
          position:relative;
          z-index:2;
          display:inline-block;
          padding:7px 16px;
          border-radius:999px;
          background:linear-gradient(135deg,#ff4f93,#f6a800);
          color:#fff;
          font-size:12px;
          font-weight:900;
        }

        .profileRankGrid{
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:10px;
          margin-top:18px;
        }

        .profileMiniCard{
          padding:14px 8px;
          border-radius:20px;
          background:#eef5ff;
          text-align:center;
          border:2px solid rgba(23,52,92,.08);
        }

        .profileMiniCard strong{
          display:block;
          font-size:24px;
          color:#ff4f93;
          font-weight:900;
        }

        .profileMiniCard span{
          display:block;
          margin-top:4px;
          color:#17345c;
          font-size:12px;
          font-weight:900;
        }

        .bondCardV2{
          display:grid;
          gap:12px;
        }

        .bondItemV2{
          padding:14px;
          border-radius:22px;
          background:linear-gradient(135deg,#fff7df,#eef5ff);
          border:2px solid #ffd768;
        }

        .bondTopV2{
          display:flex;
          justify-content:space-between;
          align-items:center;
          color:#17345c;
          font-weight:900;
        }

        .bondBarV2{
          height:13px;
          margin-top:10px;
          border-radius:999px;
          background:#d8e5f6;
          overflow:hidden;
        }

        .bondBarV2 span{
          display:block;
          height:100%;
          border-radius:999px;
          background:linear-gradient(90deg,#ff4f93,#ffd768);
        }

        .achievementGrid{
          display:grid;
          grid-template-columns:repeat(2,1fr);
          gap:10px;
        }

        .achievementItem{
          padding:14px 8px;
          border-radius:20px;
          background:#fff7df;
          border:2px solid #ffd768;
          text-align:center;
          font-weight:900;
          color:#17345c;
        }

        .achievementItem.lock{
          filter:grayscale(1);
          opacity:.45;
        }

        .profileActionGrid{
          display:grid;
          gap:10px;
        }

        .profileActionGrid a,
        .profileActionGrid button{
          border:0;
          display:block;
          padding:15px;
          border-radius:18px;
          text-align:center;
          text-decoration:none;
          color:#fff;
          background:#17345c;
          font-weight:900;
        }

        .profileActionGrid button{
          background:linear-gradient(135deg,#ff4f93,#f6a800);
        }

        @keyframes profileFloat{
          0%,100%{transform:translateY(0) rotate(-1deg);}
          50%{transform:translateY(-7px) rotate(1deg);}
        }

        @keyframes profileAura{
          0%,100%{transform:scale(.9);opacity:.45;}
          50%{transform:scale(1.15);opacity:.8;}
        }
      `}</style>

      <header className="bscHeader">
        <div>
          <span>BSC MY PAGE</span>
          <h1>マイページ</h1>
        </div>
        <a href="/bsc2" className="bscBtn bscBtnGold">戻る</a>
      </header>

      <section className="bscCard profileHeroV2">
        <img
          src={player?.photoURL || "/bsc/status-ichika.png"}
          alt="player"
          className="profileAvatarV2"
        />

        <h2 className="profileNameV2">{player?.name || "BSCプレイヤー"}</h2>
        <span className="profileTitleV2">{title}</span>

        <div className="bscLevel" style={{ marginTop: 18, position: "relative", zIndex: 2 }}>
          <p><b>LEVEL {level}</b> / EXP {exp}/100</p>
          <div className="bscLevelBar">
            <span style={{ width: `${exp}%` }} />
          </div>
        </div>

        <div className="profileRankGrid" style={{ position: "relative", zIndex: 2 }}>
          <div className="profileMiniCard">
            <strong>{point}</strong>
            <span>POINT</span>
          </div>
          <div className="profileMiniCard">
            <strong>{badges.length}</strong>
            <span>BADGE</span>
          </div>
          <div className="profileMiniCard">
            <strong>{cleared.length}</strong>
            <span>CLEAR</span>
          </div>
          <div className="profileMiniCard">
            <strong>{player?.loginStreak || 1}</strong>
            <span>LOGIN</span>
          </div>
        </div>
      </section>

      <section className="bscCard">
        <h2 className="bscTitle">❤️ キャラ親密度</h2>
        <div className="bondCardV2">
          <BondBar icon="🌸" name="一果" value={bonds.ichika || 0} />
          <BondBar icon="⚡" name="キイナ" value={bonds.kiina || 0} />
          <BondBar icon="💜" name="初音" value={bonds.hatsune || 0} />
        </div>
      </section>

      <section className="bscCard">
        <h2 className="bscTitle">🏅 実績</h2>
        <div className="achievementGrid">
          <div className={`achievementItem ${point >= 100 ? "" : "lock"}`}>⭐ 100pt達成</div>
          <div className={`achievementItem ${level >= 5 ? "" : "lock"}`}>🚤 Lv5到達</div>
          <div className={`achievementItem ${cleared.length >= 3 ? "" : "lock"}`}>🎮 3章クリア</div>
          <div className={`achievementItem ${badges.length >= 1 ? "" : "lock"}`}>🏅 初バッジGET</div>
        </div>
      </section>

      <section className="bscCard">
        <h2 className="bscTitle">🎮 メニュー</h2>
        <div className="profileActionGrid">
          <a href="/bsc2/practice/talk">💬 会話問題へ</a>
          <a href="/bsc2/collection">🏅 バッジコレクション</a>
          <a href="/library">📚 一果図書館</a>
          <button type="button" onClick={logout}>ログアウト</button>
        </div>
      </section>
    </main>
  );
}

function BondBar({ icon, name, value }) {
  return (
    <div className="bondItemV2">
      <div className="bondTopV2">
        <span>{icon} {name}</span>
        <b>{value}%</b>
      </div>
      <div className="bondBarV2">
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
