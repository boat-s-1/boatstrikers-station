"use client";

import { useMemo, useState } from "react";
import styles from "./schedule.module.css";
import { getProgramPresetByTitle } from "../../lib/programPresets";

const TYPES = {
  radio: { label: "RADIO", icon: "🎙️", action: "放送を聴く" },
  short: { label: "SHORT", icon: "▶️", action: "動画を見る" },
  note: { label: "NOTE", icon: "📝", action: "記事を読む" },
  live: { label: "LIVE", icon: "🔴", action: "生放送を見る" },
  comic: { label: "COMIC", icon: "📖", action: "コミックを見る" },
  other: { label: "OTHER", icon: "⭐", action: "詳しく見る" },
};

const WEEKDAYS = ["月", "火", "水", "木", "金", "土", "日"];

function addDays(value, days) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dateLabel(value, weekday) {
  const [, month, day] = value.split("-");
  return `${Number(month)}月${Number(day)}日 ${weekday}曜日`;
}

export default function ScheduleClient({ items, weekStart, today }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => filter === "all"
      ? items
      : items.filter((item) => item.content_type === filter),
    [items, filter]
  );

  const featured = items.find((item) => item.is_featured);
  const days = WEEKDAYS.map((weekday, index) => {
    const date = addDays(weekStart, index);
    return {
      weekday,
      date,
      items: filtered.filter((item) => item.event_date === date),
    };
  });

  return (
    <>
      {featured && (
        <section className={styles.featured}>
          <div className={styles.featuredMark}>今週の注目番組</div>
          <p>{featured.event_date} {String(featured.start_time).slice(0, 5)}</p>
          <h2>{featured.title}</h2>
          {featured.episode && <strong>{featured.episode}</strong>}
          {featured.description && <span>{featured.description}</span>}
          {featured.link_url && (
            <a href={featured.link_url} target="_blank" rel="noreferrer">
              配信ページへ
            </a>
          )}
        </section>
      )}

      <div className={styles.filters} aria-label="種類で絞り込む">
        <button className={filter === "all" ? styles.activeFilter : ""} onClick={() => setFilter("all")}>すべて</button>
        {Object.entries(TYPES).slice(0, 5).map(([value, type]) => (
          <button
            key={value}
            className={filter === value ? styles.activeFilter : ""}
            onClick={() => setFilter(value)}
          >
            {type.icon} {type.label}
          </button>
        ))}
      </div>

      <section className={styles.scheduleList}>
        {days.map((day) => (
          <article
            className={`${styles.dayCard} ${day.date === today ? styles.today : ""}`}
            key={day.date}
            id={`day-${day.date}`}
          >
            <header className={styles.dayHeader}>
              <div>
                {day.date === today && <span className={styles.todayBadge}>TODAY</span>}
                <h2>{dateLabel(day.date, day.weekday)}</h2>
              </div>
              <small>{day.items.length} PROGRAMS</small>
            </header>

            <div className={styles.programs}>
              {day.items.length === 0 && (
                <p className={styles.empty}>この日の配信予定はありません。</p>
              )}

              {day.items.map((item) => {
                const type = TYPES[item.content_type] || TYPES.other;
                const preset = getProgramPresetByTitle(item.title);
                return (
                  <div className={styles.program} key={item.id} data-type={item.content_type}>
                    <time>{String(item.start_time).slice(0, 5)}</time>
                    {preset && (
                      <div
                        className={styles.programIcon}
                        style={{ "--program-accent": preset.accent }}
                        aria-hidden="true"
                      >
                        {preset.iconUrl ? (
                          <img src={preset.iconUrl} alt="" />
                        ) : (
                          <span>{preset.iconText}</span>
                        )}
                      </div>
                    )}
                    <div className={styles.programBody}>
                      <div className={styles.programMeta}>
                        <span className={styles.contentBadge}>{type.icon} {type.label}</span>
                        <span>担当：{item.host}</span>
                      </div>
                      <h3>{item.title}</h3>
                      {item.episode && <strong>{item.episode}</strong>}
                      {item.description && <p>{item.description}</p>}
                    </div>
                    {item.link_url ? (
                      <a href={item.link_url} target="_blank" rel="noreferrer">{type.action}</a>
                    ) : (
                      <span className={styles.comingSoon}>配信予定</span>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}
