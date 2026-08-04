import Link from "next/link";
import styles from "./adminHome.module.css";

const items=[
 {href:"/admin/results",icon:"🏆",title:"予想実績管理",text:"予想・投資・払戻・的中画像を登録"},
 {href:"/admin/schedule",icon:"📅",title:"番組表管理",text:"週間番組表と今日の予定を更新"},
 {href:"/admin/radio-blog",icon:"🎙️",title:"ラジオブログ",text:"放送ブログの記事を管理"},
 {href:"/admin/magazine",icon:"📚",title:"Web雑誌管理",text:"入力だけで雑誌レイアウトを作成"},
 {href:"/library/stadium/kiryu?preview=premium",icon:"🚤",title:"桐生攻略プレビュー",text:"1場完成版の無料・有料レイアウトを確認"},
 {href:"/admin/stadium-ai",icon:"🧭",title:"Stadium AI集計",text:"桐生の直近1年・当日評価を再集計"},
 {href:"/admin/note",icon:"📝",title:"note特集管理",text:"トップ掲載するnoteを管理"},
 {href:"/admin/ai-bet-stats",icon:"📊",title:"AI買い目成績",text:"AI予想の集計を確認"},
 {href:"/admin/sync",icon:"🔄",title:"同期管理",text:"データ同期の状態を確認"},
 {href:"/bsc2/admin",icon:"🤖",title:"AI Pipeline",text:"AI処理とCSV登録"},
];
export default function AdminHome(){return <main className={styles.page}><header><span>BOATSTRIKERS CMS</span><h1>管理画面一覧</h1><p>更新したい項目を選んでください。</p></header><div className={styles.grid}>{items.map(i=><Link href={i.href} key={i.href} className={styles.card}><b>{i.icon}</b><div><h2>{i.title}</h2><p>{i.text}</p></div><i>›</i></Link>)}</div><Link className={styles.back} href="/">トップページへ戻る</Link></main>}
