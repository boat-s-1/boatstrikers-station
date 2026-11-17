import Link from 'next/link';
import styles from '../community.module.css';

// Safe pre-launch screen: no client-side access to private notifications.
// Replace with authenticated server-side inbox after DB/RLS/API integration tests.
export const metadata = {
  title: '通知｜BoatStrikers',
  description: 'BoatStrikersのサイト内通知。現在準備中です。',
  robots: { index: false, follow: true },
};
export default function CommunityNotificationsPage() {
  return <main className={styles.main}>
    <div className={styles.kicker}>BOATSTRIKERS NOTIFICATIONS</div>
    <h1>通知</h1>
    <p className={styles.intro}>掲示板への返信や、予想・研究記事の更新をBoatStrikersでまとめて確認できるよう準備しています。</p>
    <div className={styles.empty} role="status">
      <strong>通知機能は準備中です</strong>
      <p>現在、通知の保存・配信・既読機能は利用できません。LINE・Discordへの追加登録は必要ありません。</p>
    </div>
    <p className={styles.note}>スマートフォンへのプッシュ通知は、対応環境で希望した方だけに提供する予定です。通知許可を自動で求めることはありません。</p>
    <Link className={styles.back} href="/community">掲示板に戻る</Link>
  </main>;
}
