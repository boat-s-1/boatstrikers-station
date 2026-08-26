import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import styles from "./membersAdmin.module.css";
import {
  clearMembersAdminCookie,
  isMembersAdminAuthenticated,
  setMembersAdminCookie,
  verifyMembersAdminPassword,
} from "./_lib/membersAdminAuth";

export const dynamic = "force-dynamic";

function formatJst(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function loginAction(formData) {
  "use server";
  const password = String(formData.get("password") || "");
  if (!verifyMembersAdminPassword(password)) {
    redirect("/admin/members?error=1");
  }
  await setMembersAdminCookie();
  redirect("/admin/members");
}

async function logoutAction() {
  "use server";
  await clearMembersAdminCookie();
  redirect("/admin/members");
}

async function loadMembers() {
  const client = getAdminClient();
  if (!client) {
    return { rows: [], configError: "SUPABASE_SERVICE_ROLE_KEY が未設定です。" };
  }

  const [profilesResult, preferencesResult, authResult] = await Promise.all([
    client.from("bs_member_profiles").select("*").order("created_at", { ascending: false }).limit(1000),
    client.from("bs_member_notification_preferences")
      .select("user_id,boat4_double_top,ichika_escape,hatsune_venus,kiina_boat5,triple_match,updated_at")
      .limit(1000),
    client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesResult.error) throw profilesResult.error;

  const authUsers = authResult?.data?.users || [];
  const profiles = profilesResult.data || [];
  const preferences = preferencesResult.error ? [] : (preferencesResult.data || []);
  const authMap = new Map(authUsers.map((user) => [user.id, user]));
  const profileMap = new Map(profiles.map((profile) => [profile.user_id, profile]));
  const prefMap = new Map(preferences.map((pref) => [pref.user_id, pref]));
  const ids = new Set([...authMap.keys(), ...profileMap.keys(), ...prefMap.keys()]);

  const rows = [...ids].map((userId) => {
    const profile = profileMap.get(userId) || null;
    const auth = authMap.get(userId) || null;
    const pref = prefMap.get(userId) || null;
    const notificationPrefs = {
      kiina45: Boolean(pref?.boat4_double_top),
      ichikaHidden: Boolean(pref?.ichika_escape),
      hatsuneBreak: Boolean(pref?.hatsune_venus),
      kiinaBoat5: Boolean(pref?.kiina_boat5),
      tripleMatch: Boolean(pref?.triple_match),
    };
    const activeNotificationCount = Object.values(notificationPrefs).filter(Boolean).length;

    return {
      userId,
      email: profile?.email || auth?.email || "（メール不明）",
      displayName: profile?.display_name || "",
      plan: profile?.plan || "—",
      membershipStatus: profile?.membership_status || (profile ? "—" : "profile未作成"),
      betaMember: Boolean(profile?.beta_member),
      premiumUntil: profile?.premium_until || null,
      lineLinked: Boolean(profile?.line_user_id || profile?.line_linked_at),
      lineLinkedAt: profile?.line_linked_at || null,
      createdAt: auth?.created_at || profile?.created_at || null,
      emailConfirmedAt: auth?.email_confirmed_at || auth?.confirmed_at || null,
      lastSignInAt: auth?.last_sign_in_at || null,
      termsAccepted: Boolean(profile?.terms_accepted_at && profile?.privacy_accepted_at),
      withdrawnAt: profile?.withdrawn_at || null,
      hasProfile: Boolean(profile),
      notificationPrefs,
      activeNotificationCount,
      notificationUpdatedAt: pref?.updated_at || null,
    };
  });

  rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const errors = [];
  if (authResult?.error) errors.push(`Auth取得エラー: ${authResult.error.message}`);
  if (preferencesResult.error) errors.push(`通知設定取得エラー: ${preferencesResult.error.message}`);
  return { rows, configError: errors.length ? errors.join(" / ") : null };
}

function badge(label, tone) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{label}</span>;
}

function notificationBadge(label, enabled) {
  return <span className={`${styles.notificationBadge} ${enabled ? styles.notificationOn : styles.notificationOff}`}>
    <b>{enabled ? "ON" : "OFF"}</b><span>{label}</span>
  </span>;
}

export default async function MembersAdminPage({ searchParams }) {
  const params = (await searchParams) || {};
  const authenticated = await isMembersAdminAuthenticated().catch(() => false);

  if (!authenticated) {
    return (
      <main className={styles.loginPage}>
        <form className={styles.loginCard} action={loginAction}>
          <div className={styles.loginLogo}>BS</div>
          <span className={styles.eyebrow}>MEMBER ADMIN</span>
          <h1>会員管理</h1>
          <p>会員情報を扱うため、管理パスワードが必要です。</p>
          {String(params.error || "") === "1" && (
            <div className={styles.error}>管理パスワードが違います。</div>
          )}
          <input name="password" type="password" autoComplete="current-password" required placeholder="管理パスワード" />
          <button type="submit">ログイン</button>
        </form>
      </main>
    );
  }

  const { rows, configError } = await loadMembers();
  const q = String(params.q || "").trim().toLowerCase();
  const filter = String(params.filter || "all");

  const filtered = rows.filter((row) => {
    const matchesQuery = !q || row.email.toLowerCase().includes(q) || row.displayName.toLowerCase().includes(q);
    if (!matchesQuery) return false;
    if (filter === "beta") return row.betaMember && !row.withdrawnAt;
    if (filter === "line") return row.lineLinked && !row.withdrawnAt;
    if (filter === "notifications") return row.activeNotificationCount > 0 && !row.withdrawnAt;
    if (filter === "kiina45") return row.notificationPrefs.kiina45 && !row.withdrawnAt;
    if (filter === "ichika") return row.notificationPrefs.ichikaHidden && !row.withdrawnAt;
    if (filter === "hatsune") return row.notificationPrefs.hatsuneBreak && !row.withdrawnAt;
    if (filter === "unconfirmed") return !row.emailConfirmedAt && !row.withdrawnAt;
    if (filter === "withdrawn") return Boolean(row.withdrawnAt);
    if (filter === "incomplete") return !row.hasProfile;
    return true;
  });

  const activeRows = rows.filter((row) => !row.withdrawnAt);
  const stats = {
    total: activeRows.length,
    beta: activeRows.filter((row) => row.betaMember).length,
    confirmed: activeRows.filter((row) => row.emailConfirmedAt).length,
    line: activeRows.filter((row) => row.lineLinked).length,
    notifications: activeRows.filter((row) => row.activeNotificationCount > 0).length,
  };

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>BOATSTRIKERS MEMBER ADMIN</span>
            <h1>会員管理</h1>
            <p>登録・LINE連携・通知設定・最終ログインを確認できます。</p>
          </div>
          <div className={styles.heroActions}>
            <Link className={styles.back} href="/admin">← 管理画面一覧</Link>
            <form action={logoutAction}><button className={styles.logout} type="submit">ログアウト</button></form>
          </div>
        </header>

        <section className={styles.stats}>
          <article className={styles.stat}><span>有効会員</span><strong>{stats.total}</strong></article>
          <article className={styles.stat}><span>β会員</span><strong>{stats.beta}</strong></article>
          <article className={styles.stat}><span>メール確認済み</span><strong>{stats.confirmed}</strong></article>
          <article className={styles.stat}><span>LINE連携済み</span><strong>{stats.line}</strong></article>
          <article className={styles.stat}><span>通知ON会員</span><strong>{stats.notifications}</strong></article>
        </section>

        <form className={styles.toolbar} method="get">
          <div className={styles.search}>
            <input name="q" defaultValue={String(params.q || "")} placeholder="メール・表示名で検索" />
            <select name="filter" defaultValue={filter}>
              <option value="all">すべて</option>
              <option value="beta">β会員</option>
              <option value="line">LINE連携済み</option>
              <option value="notifications">通知を1つ以上ON</option>
              <option value="kiina45">キイナ・4→5 ON</option>
              <option value="ichika">一果・隠れイン ON</option>
              <option value="hatsune">初音・女子イン崩れ ON</option>
              <option value="unconfirmed">メール未確認</option>
              <option value="incomplete">プロフィール未作成</option>
              <option value="withdrawn">退会済み</option>
            </select>
            <button type="submit">絞り込む</button>
          </div>
          <div className={styles.count}>{filtered.length}件表示 / {rows.length}件</div>
        </form>

        <section className={styles.panel}>
          {configError && <div className={styles.error}>{configError}</div>}
          {filtered.length === 0 ? (
            <div className={styles.empty}>該当する会員はいません。</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>会員</th><th>状態</th><th>メール確認</th><th>LINE</th><th>通知設定</th><th>登録日</th><th>最終ログイン</th><th>PREMIUM期限</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.userId}>
                      <td>
                        <div className={styles.email}>{row.email}</div>
                        {row.displayName && <div className={styles.name}>{row.displayName}</div>}
                        {!row.hasProfile && <div className={styles.name}>⚠️ プロフィール未作成</div>}
                      </td>
                      <td>
                        {row.withdrawnAt
                          ? badge("退会済み", "danger")
                          : row.betaMember
                            ? badge("β会員", "blue")
                            : badge(row.membershipStatus || "一般", "muted")}
                        <div className={styles.name}>{row.plan}</div>
                      </td>
                      <td>{row.emailConfirmedAt ? badge("確認済み", "good") : badge("未確認", "warn")}</td>
                      <td>{row.lineLinked ? badge("連携済み", "good") : badge("未連携", "muted")}</td>
                      <td>
                        <div className={styles.notificationPrefs}>
                          {notificationBadge("キイナ・4→5", row.notificationPrefs.kiina45)}
                          {notificationBadge("一果・隠れイン", row.notificationPrefs.ichikaHidden)}
                          {notificationBadge("初音・女子イン崩れ", row.notificationPrefs.hatsuneBreak)}
                        </div>
                        {row.notificationUpdatedAt && <div className={styles.notificationUpdated}>更新 {formatJst(row.notificationUpdatedAt)}</div>}
                      </td>
                      <td className={styles.date}>{formatJst(row.createdAt)}</td>
                      <td className={styles.date}>{formatJst(row.lastSignInAt)}</td>
                      <td className={styles.date}>{formatJst(row.premiumUntil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className={styles.note}>※ メールアドレスなどの個人情報を含むため、このページは管理パスワードで保護されています。通知設定は会員ページで保存された現在値を表示しています。</p>
      </div>
    </main>
  );
}
