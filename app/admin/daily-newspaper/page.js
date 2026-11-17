import Link from "next/link";
import DailyNewspaperClient from "./DailyNewspaperClient";
import styles from "./dailyNewspaper.module.css";

export const dynamic = "force-dynamic";

export default function DailyNewspaperPage() {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.topbar}>
          <Link href="/admin">← 管理TOPへ</Link>
          <Link href="/admin/newspaper">通常新聞へ →</Link>
        </div>
        <header className={styles.hero}>
          <div><span>BOATSTRIKERS CONTENT STUDIO</span><h1>DAILY 12R NEWSPAPER</h1><p>1場の1R〜12Rを、一果・初音・キイナそれぞれの視点で1枚の新聞にまとめる画像生成プロンプトを作成します。</p></div>
        </header>
        <DailyNewspaperClient />
      </div>
    </main>
  );
}
