"use client";

import { useRef } from "react";
import styles from "./LatestInfoSlider.module.css";

function formatDate(value) {
  if (!value) return "";

  return new Date(value).toLocaleDateString("ja-JP", {
    month: "numeric",
    day: "numeric",
  });
}

export default function LatestInfoSlider({ items = [] }) {
  const sliderRef = useRef(null);
  const [featured, ...others] = items;

  if (!featured) return null;

  function scrollCards(direction) {
    const slider = sliderRef.current;
    if (!slider) return;

    slider.scrollBy({
      left: direction * Math.max(220, slider.clientWidth * 0.72),
      behavior: "smooth",
    });
  }

  return (
    <div className={styles.wrapper}>
      <a
        href={featured.link}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.featured}
      >
        <div className={styles.featuredMeta}>
          <time dateTime={featured.date}>{formatDate(featured.date)}</time>
          <span className={styles.newBadge}>NEW</span>
        </div>

        <div className={styles.featuredBody}>
          <span className={styles.category}>{featured.category}</span>
          <strong>{featured.title}</strong>
          <span className={styles.arrow} aria-hidden="true">›</span>
        </div>
      </a>

      {others.length > 0 && (
        <div className={styles.secondaryArea}>
          <div className={styles.secondaryHeader}>
            <span>過去の更新</span>
            <div className={styles.arrowButtons}>
              <button
                type="button"
                onClick={() => scrollCards(-1)}
                aria-label="前の更新を見る"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => scrollCards(1)}
                aria-label="次の更新を見る"
              >
                ›
              </button>
            </div>
          </div>

          <div ref={sliderRef} className={styles.slider}>
            {others.map((item) => (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.card}
                key={`${item.link}-${item.date}`}
              >
                <div className={styles.cardTop}>
                  <time dateTime={item.date}>{formatDate(item.date)}</time>
                  <span>更新</span>
                </div>
                <strong>{item.category}</strong>
                <p>{item.title}</p>
              </a>
            ))}
          </div>
        </div>
      )}

      <a
        href="https://note.com/boat_strikers"
        target="_blank"
        rel="noopener noreferrer"
        className={styles.allLink}
      >
        最新情報をすべて見る
        <span aria-hidden="true">›</span>
      </a>
    </div>
  );
}
