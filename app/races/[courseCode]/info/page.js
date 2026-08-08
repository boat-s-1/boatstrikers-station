import Link from "next/link";
import { normalizeCourseCode, normalizeDate } from "../../../lib/boatstrikersPlatform";
import { resolveStadium, stadiumPath } from "../../../../lib/stadiums";
import { getStadiumGuide } from "../../../../lib/stadiumGuideData";
import styles from "./stadiumInfo.module.css";

export const dynamic = "force-dynamic";

const SECTION_IMAGES = {
  basic: "/stadium-guide/section-01-basic.png",
  water: "/stadium-guide/section-02-water.png",
  focus: "/stadium-guide/section-03-focus.png",
  check: "/stadium-guide/section-04-check.png",
};

const KIRYU_COMPLETE = {
  basic_info: {
    race_type: "ナイター",
    water_type: "淡水",
    tide: "影響なし",
    summary:
      "桐生は年間を通じてナイター開催。冬〜春は「赤城おろし」と呼ばれる強風で水面が荒れることがあり、夏場は比較的穏やかで、まくりも効きやすい水面です。標高が高いため、モーターのパワーや出足が弱めになりやすい点も特徴です。",
  },
  yearly_stats: {
    course1_win_rate: 49.7,
    course3_win_rate: 12.8,
    course4_win_rate: 14.1,
    course5_win_rate: 10.2,
  },
  layout_image_url: "/stadium-guide/kiryu-water-layout.webp",
  layout_notes: [
    {
      title: "ピット〜2マーク 165m",
      text: "水面図ではピットから第2ターンマークまで165m。レース前はピット離れから進入隊形がどうなるかも確認したいポイントです。",
    },
    {
      title: "ターンマーク間 300m",
      text: "第1・第2ターンマーク間は300m。水面全体の形とあわせて、各艇がどこから仕掛けるかをイメージしやすいレイアウトです。",
    },
    {
      title: "風の変化に注意",
      text: "冬〜春は赤城おろしで荒れることがあります。直前の風向・風速と展示の変化をセットで確認すると分かりやすいです。",
    },
  ],
  focus_cards: [
    {
      label: "1コース",
      value: "49.7%",
      title: "まずはインの信頼度",
      text: "直近6か月の1コース1着率は49.7%。インだけで決め打ちせず、展示・スタート・機力まで見て判断したい場です。",
    },
    {
      label: "4コース",
      value: "14.1%",
      title: "センター勢の攻め",
      text: "4コースの1着率は14.1%。夏場の穏やかな水面ではまくりも効くため、センター勢の気配には注目です。",
    },
    {
      label: "3コース",
      value: "12.8%",
      title: "3コースも侮れない",
      text: "3コースの1着率は12.8%。1号艇の気配が弱いときは、3・4コースのスタートと伸びを比較しておきたいところです。",
    },
  ],
  check_points: [
    {
      title: "風向・風速を最初に確認",
      text: "特に冬〜春は赤城おろしの影響で水面が変わりやすいため、予想を始める前に直前の風を確認します。",
    },
    {
      title: "モーターの出足・行き足",
      text: "桐生は標高が高く、モーターのパワーや出足が弱めになりやすいとされています。展示で各艇の機力差を比較します。",
    },
    {
      title: "1号艇だけで決めない",
      text: "1コース1着率は約5割。インの気配に加えて、3・4コースのスタートや伸びが良いときは攻めの展開も考えます。",
    },
    {
      title: "季節で水面イメージを変える",
      text: "冬〜春は強風による荒れ、夏は比較的穏やかな水面を意識。季節と当日のコンディションを一緒に見ます。",
    },
  ],
};

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? `${n.toFixed(1)}%` : "集計中";
}

function BasicItem({ label, value }) {
  return (
    <div className={styles.basicItem}>
      <span>{label}</span>
      <strong>{value || "情報準備中"}</strong>
    </div>
  );
}

function SectionImage({ src, alt }) {
  return (
    <div className={styles.sectionImageWrap}>
      <img className={styles.sectionImage} src={src} alt={alt} />
    </div>
  );
}

export default async function StadiumInfoPage({ params, searchParams }) {
  const route = await params;
  const query = await searchParams;
  const courseCode = normalizeCourseCode(route.courseCode);
  const raceDate = normalizeDate(query?.date);
  const stadium = resolveStadium(courseCode);

  if (!stadium) {
    return <main className={styles.page}>開催場が見つかりません。</main>;
  }

  const guide = await getStadiumGuide(stadium.slug);
  const isKiryu = stadium.slug === "kiryu";

  const basic = isKiryu
    ? { ...(guide?.basic_info || {}), ...KIRYU_COMPLETE.basic_info }
    : guide?.basic_info || {};

  const yearly = isKiryu
    ? { ...(guide?.yearly_stats || {}), ...KIRYU_COMPLETE.yearly_stats }
    : guide?.yearly_stats || {};

  const layoutNotes = isKiryu
    ? KIRYU_COMPLETE.layout_notes
    : Array.isArray(guide?.layout_notes)
      ? guide.layout_notes
      : [];

  const layoutImage = isKiryu
    ? KIRYU_COMPLETE.layout_image_url
    : guide?.layout_image_url;

  const hasLayoutImage = Boolean(
    layoutImage && layoutImage !== "/book-24-stadiums.jpg"
  );

  const focusCards = isKiryu
    ? KIRYU_COMPLETE.focus_cards
    : [
        {
          label: "イン",
          value: pct(yearly.course1_win_rate),
          title: "まずは1号艇",
          text: "1号艇の信頼度を見る基本指標。数字だけでなく展示・スタートも合わせて確認します。",
        },
        {
          label: "高配当",
          value: pct(yearly.over10000_rate),
          title: "荒れやすさ",
          text: "高配当率は荒れやすさの参考。母数が少ない場合は参考値として扱います。",
        },
        {
          label: "展示",
          value: guide?.exhibition_reliability?.grade || "分析中",
          title: "展示の信頼度",
          text: "展示タイムや周回展示が結果につながりやすいかを24場攻略で分析します。",
        },
      ];

  const checkPoints = isKiryu
    ? KIRYU_COMPLETE.check_points
    : [
        {
          title: "まず1号艇の信頼度",
          text: "全国平均だけで決めず、その場のイン傾向と選手・モーターを確認します。",
        },
        {
          title: "展示とスタート",
          text: "直前情報が出たら、展示タイム・展示ST・進入の変化をチェックします。",
        },
        {
          title: "風と水面状況",
          text: "風向・風速や潮位の影響がある場では、直前の水面状況を優先します。",
        },
      ];

  const code = String(stadium.courseCode).padStart(2, "0");

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href={`/races/${code}?date=${raceDate}`}>
          ← {stadium.name} レース一覧
        </Link>
        <span>BOATSTRIKERS STADIUM GUIDE</span>
      </header>

      <section className={styles.hero}>
        <small>#{code} BASIC GUIDE</small>
        <h1>{stadium.name}</h1>
        <p>{stadium.englishName}</p>
      </section>

      <nav className={styles.jump} aria-label="場基本情報メニュー">
        <a href="#water">水面</a>
        <a href="#tendency">傾向</a>
        <a href="#point">見るポイント</a>
        <a href="#more">24場攻略</a>
      </nav>

      <section className={styles.panel}>
        <SectionImage
          src={SECTION_IMAGES.basic}
          alt="01 まず知っておきたい基本情報"
        />

        <div className={styles.basicGrid}>
          <BasicItem label="開催タイプ" value={basic.race_type} />
          <BasicItem label="水面タイプ" value={basic.water_type} />
          <BasicItem label="潮位" value={basic.tide} />
          <BasicItem
            label="1コース1着率"
            value={pct(yearly.course1_win_rate)}
          />
        </div>

        <p className={styles.lead}>
          {basic.summary ||
            `${stadium.name}の基本情報・水面特徴・コース傾向を、初心者にも分かりやすく整理しています。`}
        </p>

        {isKiryu && (
          <p className={styles.sourceNote}>
            ※1コース1着率はBOAT RACE桐生公式「水面特性」
            （2025年11月〜2026年4月・全レース）の掲載値を使用。
          </p>
        )}
      </section>

      <section className={styles.panel} id="water">
        <SectionImage
          src={SECTION_IMAGES.water}
          alt="02 水面レイアウト"
        />

        {hasLayoutImage ? (
          <img
            className={styles.layoutImage}
            src={layoutImage}
            alt={`${stadium.name} 水面レイアウト`}
          />
        ) : (
          <div className={styles.waterMap} aria-label="水面レイアウト概略図">
            <div className={styles.startLine}>START</div>
            <i className={styles.mark1}>1M</i>
            <i className={styles.mark2}>2M</i>
            <span>ホームストレッチ</span>
          </div>
        )}

        <div className={styles.noteGrid}>
          {layoutNotes.length ? (
            layoutNotes.slice(0, 4).map((note, index) => (
              <article key={`${note.title}-${index}`}>
                <strong>{note.title || `POINT ${index + 1}`}</strong>
                <p>{note.text}</p>
              </article>
            ))
          ) : (
            <article>
              <strong>水面データ準備中</strong>
              <p>
                水面図・1マーク周辺・ピットからの進入など、場ごとの特徴を順次追加します。
              </p>
            </article>
          )}
        </div>
      </section>

      <section className={styles.panel} id="tendency">
        <SectionImage
          src={SECTION_IMAGES.focus}
          alt="03 こういう艇に注目！"
        />

        <div className={styles.tendencyGrid}>
          {focusCards.map((item, index) => (
            <article key={`${item.label}-${index}`}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.panel} id="point">
        <SectionImage
          src={SECTION_IMAGES.check}
          alt="04 この場はココを見る"
        />

        <ol className={styles.points}>
          {checkPoints.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <b>{index + 1}</b>
              <div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.more} id="more">
        <small>MORE DATA</small>
        <h2>
          もっと詳しく見るなら
          <br />
          24場攻略ノートへ
        </h2>
        <p>
          コース別成績、季節、風、展示、イン逃げ条件、穴条件などをより詳しく確認できます。
        </p>
        <Link href={stadiumPath(stadium)}>
          #{code} {stadium.name} 24場攻略を見る →
        </Link>
      </section>
    </main>
  );
}
