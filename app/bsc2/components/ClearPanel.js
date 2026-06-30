"use client";

export default function ClearPanel({
  rewardPoint = 20,
  badge = "BSC認定",
  alreadyCleared = false,
}) {
  return (
    <section className="bscClearPanel">

      <div className="bscClearBadge">
        🎉 MISSION CLEAR
      </div>

      <h2>CLEAR!!</h2>

      {!alreadyCleared ? (
        <>
          <p className="bscClearReward">
            ⭐ +{rewardPoint}pt GET!
          </p>

          <strong className="bscClearBadgeName">
            🏅 {badge}
          </strong>

          <p className="bscClearBond">
            ❤ 一果との親密度 +5
          </p>
        </>
      ) : (
        <>
          <p className="bscAlreadyClear">
            このチャプターはクリア済みです😊
          </p>

          <strong className="bscClearBadgeName">
            🏅 {badge}
          </strong>
        </>
      )}

      <div className="bscClearMessage">

        <img
          src="/characters/ichika-talk.png"
          alt="一果"
          className="bscClearCharacter"
        />

        <div className="bscClearSpeech">

          <span>🌸 一果</span>

          <p>
            お疲れ様😊
            <br />
            次のチャレンジも
            <br />
            一緒に頑張ろう♪
          </p>

        </div>

      </div>

      <div className="bscClearButtons">

        <a href="/bsc2">
          🏠 BSCメニューへ戻る
        </a>

        <a href="/bsc2/play/chapter1">
          🔄 もう一度プレイ
        </a>

        <a href="/bsc2/collection">
          🏅 バッジコレクション
        </a>

        <a href="/library">
          📚 一果図書館で復習
        </a>

      </div>

    </section>
  );
}
