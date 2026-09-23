import styles from "./IchikaNewArrivalsSlider.module.css";

export default function IchikaNewArrivalsSlider({ items = [] }) {
  if (!items.length) return <p>新着の読み物はまだありません。</p>;

  return (
    <div className={styles.wrap}>
      {items.length > 1 ? (
        <div className={styles.hint}>横にスワイプ →</div>
      ) : null}
      <div className={styles.slider} aria-label="一果の新着読み物">
        {items.map((item) => (
          <a
            href={item.link}
            className={styles.card}
            key={`${item.kind}-${item.link}`}
            {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <img
              src={item.image || "/ichika-banner.jpg"}
              alt={item.title}
              className={styles.image}
            />
            <div className={styles.body}>
              <small className={styles.meta}>{item.kind}・{item.meta}</small>
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
