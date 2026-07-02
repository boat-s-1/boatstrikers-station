"use client";

export default function ClearPanel({
  rewardPoint = 20,
  badge = "BSC認定",
  alreadyCleared = false,
  nextHref = "/bsc2/beginner",
  nextTitle = "次へ進む",
}) {
  return (
    <section className="bscResultSimple">
      <div className="bscResultSimpleTop">
        <span>RESULT</span>
        <h2>CLEAR!!</h2>
        <p>ミッション達成おめでとう！</p>
      </div>

      <div className="bscResultSimpleReward">
        <div>
          <span>⭐</span>
          <strong>{alreadyCleared ? "+0pt" : `+${rewardPoint}pt`}</strong>
          <p>獲得ポイント</p>
        </div>

        <div>
          <span>🏅</span>
          <strong>{badge}</strong>
          <p>認定バッジ</p>
        </div>
      </div>

      <div className="bscResultSimpleMessage">
        🌸 一果「お疲れ様！次も一緒に頑張ろう♪」
      </div>

      <div className="bscResultSimpleButtons">
        <a href={nextHref} className="primary">
          ▶ {nextTitle}
        </a>

        <a href="/bsc2">
          🏠 メニューへ戻る
        </a>

        <a href="/bsc2/collection">
          🏅 バッジを見る
        </a>
      </div>
    </section>
  );
}
