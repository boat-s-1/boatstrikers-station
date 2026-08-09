"use client";

import styles from "./StadiumHeroBanner.module.css";

const STADIUMS = {
  1: { name: "桐生", en: "KIRYU", bg: "/backgrounds/6B178DB8-C92E-46CC-82A5-5451D7AC5AA0.png" },
  2: { name: "戸田", en: "TODA", bg: "/backgrounds/FC5BE741-F73B-4256-9F44-6956FBD20E6F.png" },
  3: { name: "江戸川", en: "EDOGAWA", bg: "/backgrounds/BD55BDF9-EE60-49A1-BFDA-5B95FF2BC85F.png" },
  4: { name: "平和島", en: "HEIWAJIMA", bg: "/backgrounds/62DFF1EC-DE56-4368-AD4F-68AD6494C97D.png" },
  5: { name: "多摩川", en: "TAMAGAWA", bg: "/backgrounds/C6329CF8-BADE-44E0-838F-BE5B8605DCFC.png" },
  6: { name: "浜名湖", en: "HAMANAKO", bg: "/backgrounds/C93356BF-1F30-495D-9CCB-9DA45FD6E73A.png" },
  7: { name: "蒲郡", en: "GAMAGORI", bg: "/backgrounds/E4607E75-9DB1-4FA5-A5E7-3E6A03B7C9FE.png" },
  8: { name: "常滑", en: "TOKONAME", bg: "/backgrounds/F80FCF3E-7D13-410C-8574-84417C142816.png" },
  9: { name: "津", en: "TSU", bg: "/backgrounds/9F98462B-9AF6-4354-8F4C-4EE8DFEDACAE.png" },
  10: { name: "三国", en: "MIKUNI", bg: "/backgrounds/E988F9B9-C704-4918-AC70-810A6D7F7073.png" },
  11: { name: "びわこ", en: "BIWAKO", bg: "/backgrounds/5B9AE3A1-48BD-4C9C-803C-04BEB7012EC7.png" },
  12: { name: "住之江", en: "SUMINOE", bg: "/backgrounds/758979BE-A279-47EB-B2C1-D43E16E976A5.png" },
  13: { name: "尼崎", en: "AMAGASAKI", bg: "/backgrounds/3E4DBBD8-8744-44C2-A78E-2701DDC4296E.png" },
  14: { name: "鳴門", en: "NARUTO", bg: "/backgrounds/C60FE24E-A424-4BDA-878A-112A2D41898C.png" },
  15: { name: "丸亀", en: "MARUGAME", bg: "/backgrounds/0355DF1E-8167-4230-A3F6-BE5E2EC6E068.png" },
  16: { name: "児島", en: "KOJIMA", bg: "/backgrounds/01725F6C-7DC9-4343-8D00-9DA2F3604D27.png" },
  17: { name: "宮島", en: "MIYAJIMA", bg: "/backgrounds/758979BE-A279-47EB-B2C1-D43E16E976A5.png" },
  18: { name: "徳山", en: "TOKUYAMA", bg: "/backgrounds/17914489-7354-4382-AD50-D12D6440E32F.png" },
  19: { name: "下関", en: "SHIMONOSEKI", bg: "/backgrounds/F72FBD4C-991A-4127-92DB-007206E0D31F.png" },
  20: { name: "若松", en: "WAKAMATSU", bg: "/backgrounds/BD69613E-C153-49E8-AE37-BF338F87FA51.png" },
  21: { name: "芦屋", en: "ASHIYA", bg: "/backgrounds/41ED7181-4C61-4F30-BDE3-E95F79F088A8.png" },
  22: { name: "福岡", en: "FUKUOKA", bg: "/backgrounds/B8091B1D-0189-4915-9594-4428C5B93339.png" },
  23: { name: "唐津", en: "KARATSU", bg: "/backgrounds/6E5D6CA0-3A66-47EB-99BD-9936F92D422E.png" },
  24: { name: "大村", en: "OMURA", bg: "/backgrounds/B5B45305-8C2B-4F52-A7A0-41B0917E8156.png" },
};

export default function StadiumHeroBanner({
  courseCode,
  compact = false,
}) {
  const code = Number(courseCode);
  const stadium = STADIUMS[code];

  if (!stadium) return null;

  const padded = String(code).padStart(2, "0");

  return (
    <section
      className={`${styles.hero} ${compact ? styles.compact : ""}`}
      style={{ "--stadium-bg": `url("${stadium.bg}")` }}
      aria-label={`${stadium.name} ボートレース場バナー`}
    >
      <div className={styles.photo} aria-hidden="true" />
      <div className={styles.whiteWash} aria-hidden="true" />

      <div className={styles.content}>
        <div className={styles.title}>
          <span className={styles.number}>#{padded}</span>
          <strong>{stadium.name}</strong>
        </div>

        <div className={styles.english}>
          BoatRace {stadium.en}
        </div>

        <div className={styles.ribbon}>
          出走表・AI分析・予想新聞
        </div>

        <div className={styles.features}>
          <span>◎ データで狙う</span>
          <span>▥ AIで読む</span>
          <span>♧ 勝ち筋を見つける</span>
        </div>
      </div>
    </section>
  );
}
