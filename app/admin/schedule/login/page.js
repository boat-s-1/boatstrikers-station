import styles from "../scheduleAdmin.module.css";

export default async function ScheduleLoginPage({ searchParams }) {
  const query = await searchParams;

  return (
    <main className={styles.loginPage}>
      <form
        action="/api/admin/schedule/login"
        method="post"
        className={styles.loginCard}
      >
        <div className={styles.loginLogo}>BS</div>
        <p className={styles.eyebrow}>WEEKLY PROGRAM</p>
        <h1>週間番組表 管理画面</h1>
        <p>管理パスワードを入力してください。</p>
        {query?.error && (
          <div className={styles.error}>パスワードが違います。</div>
        )}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="管理パスワード"
        />
        <button type="submit">ログイン</button>
      </form>
    </main>
  );
}
