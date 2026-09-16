"use client";

import styles from "./RaceQuickView.module.css";

const TAB_LABELS = {
  entries: "出走表",
  exhibition: "展示",
  previous: "前日版",
  live: "直前版",
};

function selectExistingTab(tabKey) {
  const label = TAB_LABELS[tabKey];
  if (!label) return;

  const button = Array.from(document.querySelectorAll("button")).find(
    (candidate) => candidate.textContent?.replace(/\s+/g, "").includes(label)
  );

  if (!button) return;
  button.click();
  button.scrollIntoView({ behavior: "smooth", block: "center" });
}

export default function RaceQuickView({
  courseName,
  raceNo,
  closingTime = null,
  raceStatus = null,
  exhibitionReady = false,
  hasPreviousAi = false,
  hasLiveAi = false,
  resultConfirmed = false,
}) {
  const statuses = [
    raceStatus ? { label: raceStatus, tone: "warning" } : null,
    exhibitionReady ? { label: "展示取得済", tone: "success" } : null,
    hasPreviousAi ? { label: "前日AIあり", tone: "success" } : null,
    hasLiveAi ? { label: "直前AIあり", tone: "success" } : null,
    resultConfirmed ? { label: "結果確定", tone: "success" } : null,
  ].filter(Boolean);

  const aiTab = hasLiveAi ? "live" : hasPreviousAi ? "previous" : null;
  const newspaperTab = hasLiveAi ? "live" : hasPreviousAi ? "previous" : null;

  return (
    <section className={styles.card} aria-label="レースクイックビュー">
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>RACE QUICK VIEW</span>
          <h2 className={styles.title}>{courseName} {raceNo}R</h2>
        </div>
        {closingTime && <span className={styles.deadline}>締切 {closingTime}</span>}
      </div>

      {statuses.length > 0 && (
        <div className={styles.statuses}>
          {statuses.map((status) => (
            <span
              key={status.label}
              className={`${styles.status} ${styles[status.tone] || ""}`}
            >
              {status.label}
            </span>
          ))}
        </div>
      )}

      <nav className={styles.shortcuts} aria-label="レース詳細ショートカット">
        <button type="button" onClick={() => selectExistingTab("entries")}>出走表を見る</button>
        <button type="button" onClick={() => selectExistingTab("exhibition")}>展示を見る</button>
        {aiTab && <button type="button" onClick={() => selectExistingTab(aiTab)}>AIを見る</button>}
        {newspaperTab && <button type="button" onClick={() => selectExistingTab(newspaperTab)}>新聞を見る</button>}
      </nav>
    </section>
  );
}
