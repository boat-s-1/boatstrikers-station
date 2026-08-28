import Link from 'next/link';
import { Suspense } from 'react';
import NotificationCenter from './NotificationCenter';
import styles from './alerts.module.css';

export const dynamic = 'force-dynamic';
const tools = [
 ['/admin/alerts/exhibition','📡','24場の展示データ対応状況','接続状況・個別取得結果・不足項目を確認'],
 ['#notifications','📣','LINE通知センター','本日の成立件数・通知済み件数・直近の履歴'],
 ['/admin/exhibition-alerts','🚨','キイナ・4→5展開理論','条件成立・通知履歴・成績を管理'],
 ['/admin/ichika-hidden-escape','🏁','一果・隠れイン理論','隠れイン条件・通知履歴・成績を管理'],
 ['/admin/hatsune-womens-inner-break','🌸','初音・女子イン崩れ理論','女子戦の条件・通知履歴・成績を管理'],
];
export default function AlertsPage(){
 return <main className={styles.page}><div className={styles.shell}>
  <header className={styles.hero}><span>BOATSTRIKERS / ALERT MANAGEMENT</span><h1>アラート管理</h1><p>展示データの取得確認から、3理論の成立・LINE通知まで。</p></header>
  <nav className={styles.cards} aria-label="アラート管理メニュー">{tools.map(([href,icon,title,description])=><Link href={href} key={href} className={styles.card}><span aria-hidden="true">{icon}</span><h2>{title}</h2><p>{description}</p><strong>開く →</strong></Link>)}</nav>
  <div className={styles.notice}>この画面を開くだけでは、通知送信・設定変更は行いません。</div>
  <Suspense fallback={<p role="status">LINE通知の集計を読み込んでいます…</p>}><NotificationCenter /></Suspense>
 </div></main>;
}
