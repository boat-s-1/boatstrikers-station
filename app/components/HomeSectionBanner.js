import Image from "next/image";
import { AI_PARTNERS } from "../../lib/aiPartners";
import styles from "./HomeSectionBanner.module.css";

export default function HomeSectionBanner({ title, subtitle, eyebrow, tone = "blue", portraits = false, id }) {
  return (
    <header className={`${styles.banner} ${styles[tone] || styles.blue}`}>
      <div className={styles.copy}>
        <span className={styles.eyebrow}>{eyebrow}</span>
        <h2 id={id}>{title}</h2>
        <p>{subtitle}</p>
      </div>
      <div className={`${styles.art} ${portraits ? styles.portraits : ""}`} aria-hidden="true">
        {Object.entries(AI_PARTNERS).map(([key, partner]) => (
          <Image key={key} src={portraits ? partner.portrait : partner.image} alt="" width={72} height={72} />
        ))}
      </div>
    </header>
  );
}
