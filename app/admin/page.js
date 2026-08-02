import styles from "./admin.module.css";
const items=[
 {href:"/admin/ticker",icon:"📢",title:"速報テロップ",text:"トップページを流れる速報を管理"},
 {href:"/admin/schedule",icon:"📅",title:"番組表・今日の予定",text:"番組の登録・編集・公開を管理"},
 {href:"/admin/radio-blog",icon:"🎙️",title:"ラジオブログ",text:"ラジオ記事を作成・編集"},
 {href:"/admin/note",icon:"📝",title:"note特集",text:"note掲載コンテンツを管理"},
 {href:"/admin/ai-bet-stats",icon:"📊",title:"AI買い目成績",text:"AI予想の成績を確認"},
 {href:"/admin/sync",icon:"🔄",title:"データ同期",text:"同期状況と実行履歴を確認"},
 {href:"/bsc2/admin",icon:"🎮",title:"BSC管理",text:"BoatStrikers Clubの管理画面"},
];
export default function AdminHome(){return <main className={styles.page}><header><p>BOATSTRIKERS CMS v1.0</p><h1>管理画面一覧</h1><span>各管理機能への入口です</span></header><section className={styles.grid}>{items.map(x=><a href={x.href} key={x.href}><b>{x.icon}</b><div><h2>{x.title}</h2><p>{x.text}</p></div><i>›</i></a>)}</section><a className={styles.home} href="/">← トップページへ戻る</a></main>}
