"use client";

export default function ClearPanel({
  rewardPoint = 20,
  badge = "BSC認定",
  alreadyCleared = false,
  nextHref = "/bsc2/play/chapter2",
  nextTitle = "Chapter2へ進む",
  reviewHref = "/library",
}) {
  return (
    <section className="bscResultPanel">
      <div className="bscResultGlow" />

      <div className="bscResultHeader">
        <span>RESULT</span>
        <h2>MISSION CLEAR!!</h2>
        <p>おめでとうございます！</p>
      </div>

      <div className="bscResultCharacterBox">
        <img
          src="/characters/ichika-talk.png"
          alt="一果"
          className="bscResultCharacter"
        />

        <div className="bscResultSpeech">
          <span>🌸 一果</span>
          <p>
            今日はここまで♪
            <br />
            次は...
            <br />
            「スタート展示って何？」
            <br />
            を勉強するよ😊
          </p>
        </div>
      </div>

      <div className="bscRewardGrid">
        <div className="bscRewardCard">
          <span>⭐</span>
          <strong>{alreadyCleared ? "+0pt" : `+${rewardPoint}pt`}</strong>
          <p>獲得ポイント</p>
        </div>

        <div className="bscRewardCard">
          <span>🏅</span>
          <strong>{badge}</strong>
          <p>認定バッジ</p>
        </div>

        <div className="bscRewardCard">
          <span>❤</span>
          <strong>{alreadyCleared ? "+0" : "+5"}</strong>
          <p>一果との親密度</p>
        </div>
      </div>

      <div className="bscNextPreview">
        <span>NEXT MISSION</span>
        <strong>{nextTitle}</strong>
        <p>準備ができたら次のチャレンジへ進もう！</p>
      </div>

      <div className="bscResultButtons">
        <a className="primary" href={nextHref}>
          ▶ {nextTitle}
        </a>

        <a href="/bsc2">
          🏠 BSCメニューへ戻る
        </a>

        <a href="/bsc2/play/chapter1">
          🔄 もう一度プレイ
        </a>

        <a href="/bsc2/collection">
          🏅 バッジを見る
        </a>

        <a href={reviewHref}>
          📚 図書館で復習
        </a>
      </div>
    </section>
  );
}
