"use client";

export default function ClearPanel({
  rewardPoint = 20,
  badge = "BSC認定",
  alreadyCleared = false,
}) {
  return (
    <section className="bscClearPanel">
      <div className="bscClearBadge">MISSION CLEAR</div>

      <h2>🎉 CLEAR!</h2>

      <p>
        {alreadyCleared
          ? "このMissionはクリア済みです。復習ありがとう！"
          : `+${rewardPoint}pt 獲得！`}
      </p>

      <strong>🏅 {badge} GET!</strong>

      <div className="bscClearButtons">
        <a href="/bsc2">もう一度プレイ</a>
  
        <a href="/bsc">BSC一覧へ</a>
        <a href="/bsc2/collection">バッジを見る ›</a>
      </div>
    </section>
  );
}
