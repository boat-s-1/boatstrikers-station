'use client';

import { useMemo, useState } from 'react';
import styles from './stadiums.module.css';

const MORNING_CODES = new Set([10, 14, 18, 21, 23, 24]);
const NIGHT_CODES = new Set([1, 7, 12, 15, 20]);

const ROMAN_NAMES = {
  1: 'KIRYU', 2: 'TODA', 3: 'EDOGAWA', 4: 'HEIWAJIMA',
  5: 'TAMAGAWA', 6: 'HAMANAKO', 7: 'GAMAGORI', 8: 'TOKONAME',
  9: 'TSU', 10: 'MIKUNI', 11: 'BIWAKO', 12: 'SUMINOE',
  13: 'AMAGASAKI', 14: 'NARUTO', 15: 'MARUGAME', 16: 'KOJIMA',
  17: 'MIYAJIMA', 18: 'TOKUYAMA', 19: 'SHIMONOSEKI', 20: 'WAKAMATSU',
  21: 'ASHIYA', 22: 'FUKUOKA', 23: 'KARATSU', 24: 'OMURA',
};

function getCategory(courseCode) {
  const code = Number(courseCode);
  if (MORNING_CODES.has(code)) return 'morning';
  if (NIGHT_CODES.has(code)) return 'night';
  return 'day';
}

function VenueIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9h18M5 9V7l7-4 7 4v2M5 20h14M7 9v8M11 9v8M15 9v8M19 9v8" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 9c2.2 0 2.2-1.7 4.4-1.7S9.6 9 11.8 9 14 7.3 16.2 7.3 18.4 9 20.6 9M3 13c2.2 0 2.2-1.7 4.4-1.7s2.2 1.7 4.4 1.7 2.2-1.7 4.4-1.7 2.2 1.7 4.4 1.7M3 17c2.2 0 2.2-1.7 4.4-1.7s2.2 1.7 4.4 1.7 2.2-1.7 4.4-1.7 2.2 1.7 4.4 1.7" />
    </svg>
  );
}

export default function StadiumDirectoryClient({ stadiums }) {
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');

  const visibleStadiums = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return stadiums.filter((stadium) => {
      const categoryMatch =
        filter === 'all' || getCategory(stadium.courseCode) === filter;
      const roman = ROMAN_NAMES[Number(stadium.courseCode)] || '';
      const queryMatch =
        !normalizedQuery ||
        stadium.name.toLowerCase().includes(normalizedQuery) ||
        roman.toLowerCase().includes(normalizedQuery) ||
        String(stadium.courseCode).padStart(2, '0').includes(normalizedQuery);

      return categoryMatch && queryMatch;
    });
  }, [stadiums, filter, query]);

  return (
    <section className={styles.directorySection} id="stadium-directory">
      <div className={styles.filterBar}>
        <div className={styles.filterTabs} role="group" aria-label="開催時間で絞り込む">
          {[
            ['all', 'すべて'],
            ['morning', 'モーニング'],
            ['day', 'デイ'],
            ['night', 'ナイター'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              className={filter === value ? styles.filterActive : ''}
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
            >
              {label}
            </button>
          ))}
        </div>

        <label className={styles.searchBox}>
          <span className="srOnly">場名を検索</span>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-4-4" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="場名を入力"
          />
        </label>
      </div>

      <div className={styles.directoryHeading}>
        <VenueIcon />
        <h2>24場から選ぶ</h2>
        <span />
      </div>

      {visibleStadiums.length > 0 ? (
        <div className={styles.stadiumGrid}>
          {visibleStadiums.map((stadium) => {
            const code = Number(stadium.courseCode);
            const category = getCategory(code);

            return (
              <a
                href={stadium.href}
                className={`${styles.stadiumCard} ${styles[`category_${category}`]}`}
                key={stadium.slug}
              >
                <span className={styles.courseNumber}>
                  {String(code).padStart(2, '0')}
                </span>
                <div className={styles.stadiumNameRow}>
                  <WaveIcon />
                  <div>
                    <strong>{stadium.name}</strong>
                    <small>{ROMAN_NAMES[code] || ''}</small>
                  </div>
                </div>
                <span className={styles.cardLink}>データを見る <b>→</b></span>
              </a>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyState}>
          条件に合う場がありません。検索文字を変更してください。
        </div>
      )}
    </section>
  );
}
