"use client";

import { useState } from "react";

const characters = [
  {
    key: "ichika",
    name: "一果",
    icon: "🌸",
    image: "/bsc/status-ichika.png",
    color: "#ff4f93",
    message: "今日はイン逃げの見方を一緒に確認しよう♪",
  },
  {
    key: "kiina",
    name: "キイナ",
    icon: "⚡",
    image: "/bsc/status-kiina.png",
    color: "#f6a800",
    message: "展示とデータを見れば、狙い目が見えてくるよ！",
  },
  {
    key: "hatsune",
    name: "初音",
    icon: "💜",
    image: "/bsc/status-hatsune.png",
    color: "#9b5cff",
    message: "回収率を意識して、実践問題に挑戦しよう。",
  },
];

export default function PracticePage() {
  const [active, setActive] = useState(null);

  const selected = characters.find((c) => c.key === active);

  return (
    <main className="practicePage">
      <style>{`
        .practicePage {
          min-height: 100vh;
          background: #07051e;
          padding: 12px 10px 80px;
          color: #fff;
        }

        .practiceHeader {
          position: sticky;
          top: 8px;
          z-index: 50;
          height: 62px;
          display: grid;
          grid-template-columns: 42px 1fr 58px;
          align-items: center;
          padding: 8px 10px;
          margin-bottom: 12px;
          border-radius: 22px;
          background: rgba(255,255,255,.94);
          box-shadow: 0 8px 22px rgba(0,0,0,.22);
        }

        .practiceHeader a {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #17345c;
          color: #fff;
          text-decoration: none;
          font-size: 22px;
          font-weight: 900;
        }

        .practiceHeader div {
          text-align: center;
        }

        .practiceHeader span {
          display: block;
          color: #ff4f93;
          font-size: 11px;
          font-weight: 900;
        }

        .practiceHeader h1 {
          margin: 2px 0 0;
          color: #17345c;
          font-size: 18px;
          font-weight: 900;
        }

        .practiceHeader b {
          color: #ff4f93;
          font-size: 13px;
          text-align: center;
        }

        .practiceBase {
          position: relative;
          max-width: 920px;
          margin: 0 auto;
          border-radius: 28px;
          overflow: hidden;
          border: 3px solid #ffd768;
          box-shadow: 0 18px 44px rgba(0,0,0,.5);
          background: #111;
        }

        .practiceBaseBg {
          width: 100%;
          display: block;
        }

        .dailyGate {
          position: absolute;
          top: 9%;
          left: 50%;
          transform: translateX(-50%);
          z-index: 10;
          width: min(78%, 480px);
          padding: 14px 16px;
          border-radius: 22px;
          background: rgba(10,20,55,.9);
          border: 3px solid #ffd768;
          text-align: center;
          box-shadow: 0 12px 30px rgba(0,0,0,.4);
        }

        .dailyGate span {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          font-size: 11px;
          font-weight: 900;
        }

        .dailyGate h2 {
          margin: 8px 0 4px;
          font-size: 22px;
          color: #ffd768;
        }

        .dailyGate p {
          margin: 0 0 10px;
          font-size: 12px;
          font-weight: 900;
        }

        .dailyGate a {
          display: inline-block;
          padding: 10px 22px;
          border-radius: 999px;
          background: linear-gradient(135deg, #06c755, #00a7ff);
          color: #fff;
          text-decoration: none;
          font-weight: 900;
        }

        .orbitArea {
          position: absolute;
          left: 50%;
          top: 54%;
          width: 310px;
          height: 310px;
          transform: translate(-50%, -50%);
          z-index: 12;
          border-radius: 50%;
        }

        .orbitRing {
          position: absolute;
          inset: 24px;
          border-radius: 50%;
          border: 2px dashed rgba(255,215,104,.65);
          box-shadow: 0 0 28px rgba(255,215,104,.35);
          animation: ringGlow 2.8s ease-in-out infinite;
        }

        .orbitCenter {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 130px;
          height: 130px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: rgba(20,10,55,.88);
          border: 3px solid #ffd768;
          text-align: center;
          box-shadow: 0 0 30px rgba(255,79,147,.45);
        }

        .orbitCenter strong {
          display: block;
          color: #ffd768;
          font-size: 18px;
        }

        .orbitCenter span {
          display: block;
          margin-top: 4px;
          font-size: 11px;
          font-weight: 900;
        }

        .orbitTrack {
          position: absolute;
          inset: 0;
          animation: orbitRotate 18s linear infinite;
        }

        .orbitCharacter {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 86px;
          height: 86px;
          transform:
            rotate(var(--angle))
            translateX(132px)
            rotate(calc(-1 * var(--angle)));
          margin-left: -43px;
          margin-top: -43px;
          border: 0;
          background: transparent;
          padding: 0;
          cursor: pointer;
          animation: keepUpright 18s linear infinite reverse;
        }

        .orbitCharacter img {
          width: 86px;
          height: 86px;
          object-fit: cover;
          border-radius: 50%;
          border: 4px solid var(--color);
          background: #fff;
          box-shadow: 0 0 20px var(--color), 0 10px 18px rgba(0,0,0,.4);
        }

        .orbitCharacter b {
          position: absolute;
          left: 50%;
          bottom: -20px;
          transform: translateX(-50%);
          white-space: nowrap;
          padding: 4px 10px;
          border-radius: 999px;
          background: rgba(10,20,55,.92);
          border: 2px solid var(--color);
          color: #fff;
          font-size: 12px;
        }

        .practiceMenu {
          position: absolute;
          left: 50%;
          bottom: 7%;
          transform: translateX(-50%);
          z-index: 14;
          width: min(88%, 620px);
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }

        .practiceMenu a {
          padding: 12px 8px;
          border-radius: 18px;
          background: rgba(10,20,55,.9);
          border: 2px solid rgba(255,215,104,.9);
          color: #fff;
          text-decoration: none;
          text-align: center;
          font-size: 12px;
          font-weight: 900;
          box-shadow: 0 8px 18px rgba(0,0,0,.35);
        }

        .practiceDialogOverlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: end center;
          padding: 18px;
          background: rgba(0,0,0,.42);
        }

        .practiceDialog {
          width: min(100%, 520px);
          padding: 18px;
          border-radius: 26px;
          background: rgba(255,255,255,.96);
          color: #17345c;
          border: 3px solid #ffd768;
          box-shadow: 0 16px 40px rgba(0,0,0,.42);
        }

        .practiceDialogTop {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .practiceDialogTop img {
          width: 64px;
          height: 64px;
          object-fit: cover;
          border-radius: 50%;
          border: 3px solid var(--color);
        }

        .practiceDialogTop span {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          background: var(--color);
          color: #fff;
          font-size: 11px;
          font-weight: 900;
        }

        .practiceDialogTop h2 {
          margin: 5px 0 0;
          font-size: 22px;
        }

        .practiceDialog p {
          margin: 16px 0;
          font-weight: 900;
          line-height: 1.7;
        }

        .practiceDialogButtons {
          display: grid;
          gap: 10px;
        }

        .practiceDialogButtons a,
        .practiceDialogButtons button {
          border: 0;
          border-radius: 16px;
          padding: 14px;
          font-size: 15px;
          font-weight: 900;
          text-align: center;
          text-decoration: none;
        }

        .practiceDialogButtons a {
          background: linear-gradient(135deg, #ff4f93, #f6a800);
          color: #fff;
        }

        .practiceDialogButtons button {
          background: #e9eef8;
          color: #17345c;
        }

        @keyframes orbitRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes keepUpright {
          from { rotate: 0deg; }
          to { rotate: 360deg; }
        }

        @keyframes ringGlow {
          0%, 100% { opacity: .5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        @media (max-width: 520px) {
          .orbitArea {
            width: 250px;
            height: 250px;
            top: 55%;
          }

          .orbitCharacter {
            width: 68px;
            height: 68px;
            margin-left: -34px;
            margin-top: -34px;
            transform:
              rotate(var(--angle))
              translateX(106px)
              rotate(calc(-1 * var(--angle)));
          }

          .orbitCharacter img {
            width: 68px;
            height: 68px;
          }

          .orbitCenter {
            width: 104px;
            height: 104px;
          }

          .orbitCenter strong {
            font-size: 15px;
          }

          .practiceMenu {
            grid-template-columns: 1fr;
            bottom: 5%;
          }

          .dailyGate h2 {
            font-size: 18px;
          }
        }
      `}</style>

      <header className="practiceHeader">
        <a href="/bsc2">←</a>
        <div>
          <span>BSC PRACTICE</span>
          <h1>3人と実践編</h1>
        </div>
        <b>ENDLESS</b>
      </header>

      <section className="practiceBase">
        <img
          src="/bsc/practice-base.png"
          alt="BSC実践本部"
          className="practiceBaseBg"
        />

        <div className="dailyGate">
          <span>🏟 TODAY PRACTICE</span>
          <h2>今日の実践チャレンジ</h2>
          <p>毎日更新される実戦問題に挑戦しよう！</p>
          <a href="/bsc2/practice/daily">挑戦する ▶</a>
        </div>

        <div className="orbitArea">
          <div className="orbitRing" />

          <div className="orbitCenter">
            <div>
              <strong>BSC BASE</strong>
              <span>3人の実践本部</span>
            </div>
          </div>

          <div className="orbitTrack">
            {characters.map((char, index) => (
              <button
                type="button"
                key={char.key}
                className="orbitCharacter"
                style={{
                  "--angle": `${index * 120}deg`,
                  "--color": char.color,
                }}
                onClick={() => setActive(char.key)}
              >
                <img src={char.image} alt={char.name} />
                <b>
                  {char.icon} {char.name}
                </b>
              </button>
            ))}
          </div>
        </div>

        <nav className="practiceMenu">
          <a href="/bsc2/practice/daily">🏟 今日の実践</a>
          <a href="/bsc2/practice/battle">🎯 3人予想バトル</a>
          <a href="/bsc2/practice/talk">💬 会話問題</a>
        </nav>
      </section>

      {selected && (
        <div className="practiceDialogOverlay" onClick={() => setActive(null)}>
          <div
            className="practiceDialog"
            style={{ "--color": selected.color }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="practiceDialogTop">
              <img src={selected.image} alt={selected.name} />
              <div>
                <span>
                  {selected.icon} {selected.name}
                </span>
                <h2>話しかけますか？</h2>
              </div>
            </div>

            <p>{selected.message}</p>

            <div className="practiceDialogButtons">
              <a href={`/bsc2/practice/talk?character=${selected.key}`}>
                会話問題に挑戦する ▶
              </a>
              <button type="button" onClick={() => setActive(null)}>
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
