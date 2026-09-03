import styles from "./bannerFlush.module.css";

export default function HatsuneLayout({ children }) {
  return <div className={styles.shell}>{children}</div>;
}
