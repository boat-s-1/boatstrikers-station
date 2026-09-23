import styles from "./CharacterReadingSlider.module.css";

const TONES = {
  hatsune: { accent: "#8a55e6", meta: "#7652b6", border: "#e3d7ff", bg: "#fcf9ff" },
  kiina: { accent: "#f0a400", meta: "#8d6b13", border: "#f3dda0", bg: "#fffdf5" },
};

export default function CharacterReadingSlider({ items = [], character = "hatsune", emptyText = "新着の読み物はまだありません。" }) {
  if (!items.length) return <p>{emptyText}</p>;
  const tone = TONES[character] || TONES.hatsune;

  return (
    <div className={styles.wrap} style={{ "--accent": tone.accent, "--meta": tone.meta, "--border": tone.border, "--card-bg": tone.bg }}>
      {items.length > 1 ? <div className={styles.hint}>横にスワイプ →</div> : null}
      <div className={styles.slider} aria-label="新着読み物">
        {items.map((item) => (
          <a
            href={item.link}
            className={styles.card}
            key={`${item.kind || "item"}-${item.link}`}
            {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <img src={item.image} alt={item.title} className={styles.image} />
            <div className={styles.body}>
              <small className={styles.meta}>{item.kind}{item.meta ? `・${item.meta}` : ""}</small>
              <h3>{item.title}</h3>
              <p>{item.date ? new Date(item.date).toLocaleDateString("ja-JP") : ""}</p>
              <span className={styles.readButton}>📖 読む</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
