import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "../sync/_lib/adminAuth";
import NewsEditor from "./NewsEditor";
import styles from "./news.module.css";

export const dynamic = "force-dynamic";

function jstToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
}

export default async function NewsPage() {
  if (!(await isAdminAuthenticated())) redirect("/admin/sync/login");
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div><span>BOATSTRIKERS NEWS STUDIO</span><h1>深夜のBoatStrikersニュース</h1><p>キャスターと3つのニュースを選ぶだけで、音声付きの縦型動画を作成します。</p></div>
          <Link href="/admin" className={styles.back}>管理トップへ</Link>
        </header>
        <NewsEditor initialDate={jstToday()} />
      </div>
    </main>
  );
}
