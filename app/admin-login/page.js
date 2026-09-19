import styles from "./login.module.css";

export const metadata = {
  title: "管理画面ログイン | BoatStrikers",
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AdminLoginPage({ searchParams }) {
  const query = await searchParams;
  return (
    <main className={styles.page}>
      <form action="/api/admin/login" method="post" className={styles.card}>
        <div className={styles.logo}>BS</div>
        <h1>BoatStrikers 管理画面</h1>
        <p>管理パスワードを入力してください。</p>
        {query?.error && <div className={styles.error}>パスワードが違います。</div>}
        <input name="password" type="password" autoComplete="current-password" required placeholder="管理パスワード" />
        <button type="submit">ログイン</button>
      </form>
    </main>
  );
}
