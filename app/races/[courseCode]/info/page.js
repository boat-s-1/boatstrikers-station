import Link from "next/link";
import { normalizeCourseCode, normalizeDate } from "../../../lib/boatstrikersPlatform";
import { resolveStadium, stadiumPath } from "../../../../lib/stadiums";
import { getStadiumGuide } from "../../../../lib/stadiumGuideData";
import styles from "./stadiumInfo.module.css";

export const dynamic = "force-dynamic";

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(1)}%` : "集計中";
}

function BasicItem({ label, value }) {
  return <div className={styles.basicItem}><span>{label}</span><strong>{value || "情報準備中"}</strong></div>;
}

export default async function StadiumInfoPage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;
  const courseCode = normalizeCourseCode(route.courseCode);
  const raceDate = normalizeDate(query?.date);
  const stadium = resolveStadium(courseCode);

  if (!stadium) return <main className={styles.page}>開催場が見つかりません。</main>;

  const guide = await getStadiumGuide(stadium.slug);
  const basic = guide?.basic_info || {};
  const yearly = guide?.yearly_stats || {};
  const layoutNotes = Array.isArray(guide?.layout_notes) ? guide.layout_notes : [];
  const hasLayoutImage = Boolean(guide?.layout_image_url && guide.layout_image_url !== "/book-24-stadiums.jpg");
  const code = String(stadium.courseCode).padStart(2, "0");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href={`/races/${code}?date=${raceDate}`}>← {stadium.name} レース一覧</Link>
        <span>BOATSTRIKERS STADIUM GUIDE</span>
      </header>

      <section className={styles.hero}>
        <small>#{code} BASIC GUIDE</small>
        <h1>{stadium.name}</h1>
        <p>{stadium.englishName}</p>
      </section>

      <nav className={styles.jump}>
        <a href="#water">水面</a><a href="#tendency">傾向</a><a href="#point">見るポイント</a><a href="#more">24場攻略</a>
      </nav>

      <section className={styles.panel}>
        <div className={styles.heading}><span>01</span><div><small>BASIC</small><h2>まず知っておきたい基本情報</h2></div></div>
        <div className={styles.basicGrid}>
          <BasicItem label="開催タイプ" value={basic.race_type} />
          <BasicItem label="水面タイプ" value={basic.water_type} />
          <BasicItem label="潮位" value={basic.tide} />
          <BasicItem label="1コース1着率" value={pct(yearly.course1_win_rate)} />
        </div>
        <p className={styles.lead}>{basic.summary || `${stadium.name}の水面・コース傾向を、初心者にも分かりやすく整理するページです。詳細データは24場攻略ノートで確認できます。`}</p>
      </section>

      <section className={styles.panel} id="water">
        <div className={styles.heading}><span>02</span><div><small>WATER LAYOUT</small><h2>水面レイアウト</h2></div></div>
        {hasLayoutImage ? (
          <img className={styles.layoutImage} src={guide.layout_image_url} alt={`${stadium.name} 水面レイアウト`} />
        ) : (
          <div className={styles.waterMap} aria-label="水面レイアウト概略図">
            <div className={styles.startLine}>START</div><i className={styles.mark1}>1M</i><i className={styles.mark2}>2M</i><span>ホームストレッチ</span>
          </div>
        )}
        <div className={styles.noteGrid}>
          {layoutNotes.length ? layoutNotes.slice(0, 4).map((note, index) => (
            <article key={`${note.title}-${index}`}><strong>{note.title || `POINT ${index + 1}`}</strong><p>{note.text}</p></article>
          )) : <article><strong>水面データ準備中</strong><p>水面図・1マーク周辺・ピットからの進入など、場ごとの特徴を順次追加します。</p></article>}
        </div>
      </section>

      <section className={styles.panel} id="tendency">
        <div className={styles.heading}><span>03</span><div><small>COURSE TENDENCY</small><h2>こういう艇に注目</h2></div></div>
        <div className={styles.tendencyGrid}>
          <article><span>イン</span><strong>{pct(yearly.course1_win_rate)}</strong><p>1号艇の信頼度を見る基本指標。数字だけでなく展示・STも合わせて確認。</p></article>
          <article><span>高配当</span><strong>{pct(yearly.over10000_rate)}</strong><p>荒れやすさの参考。母数が少ない場合は参考値として扱います。</p></article>
          <article><span>展示</span><strong>{guide?.exhibition_reliability?.grade || "分析中"}</strong><p>展示タイムや周回展示が結果につながりやすいかを24場攻略で分析。</p></article>
        </div>
      </section>

      <section className={styles.panel} id="point">
        <div className={styles.heading}><span>04</span><div><small>CHECK POINT</small><h2>初心者はここを見る</h2></div></div>
        <ol className={styles.points}>
          <li><b>1</b><div><strong>まず1号艇の信頼度</strong><p>全国平均だけで決めず、その場のイン傾向と選手・モーターを確認します。</p></div></li>
          <li><b>2</b><div><strong>展示とスタート</strong><p>直前情報が出たら、展示タイム・展示ST・進入の変化をチェックします。</p></div></li>
          <li><b>3</b><div><strong>風と水面状況</strong><p>風向・風速や潮位の影響がある場では、直前の水面状況を優先します。</p></div></li>
        </ol>
      </section>

      <section className={styles.more} id="more">
        <small>MORE DATA</small><h2>もっと詳しく見るなら<br />24場攻略ノートへ</h2>
        <p>コース別成績、季節、風、展示、イン逃げ条件、穴条件などをより詳しく確認できます。</p>
        <Link href={stadiumPath(stadium)}>#{code} {stadium.name} 24場攻略を見る →</Link>
      </section>
    </main>
  );
}
