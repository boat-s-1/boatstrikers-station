import Link from "next/link";
import { normalizeCourseCode, normalizeDate } from "../../../lib/boatstrikersPlatform";
import { resolveStadium, stadiumPath } from "../../../../lib/stadiums";
import { getStadiumGuide } from "../../../../lib/stadiumGuideData";
import { getStadiumBasicGuide } from "../../../../lib/stadiumBasicGuide24";
import styles from "./stadiumInfo.module.css";

export const dynamic = "force-dynamic";

const SECTION_IMAGES = {
  basic: "/stadium-guide/section-01-basic.png",
  water: "/stadium-guide/section-02-water.png",
  focus: "/stadium-guide/section-03-focus.png",
  check: "/stadium-guide/section-04-check.png",
};

function pct(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(1)}%` : "集計中";
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

function CourseCard({ course, rate, title, text }) {
  return (
    <article>
      <span>{course}コース</span>
      <strong>{pct(rate)}</strong>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
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

  const [dbGuide, staticGuide] = await Promise.all([
    getStadiumGuide(stadium.slug),
    Promise.resolve(getStadiumBasicGuide(stadium.slug)),
  ]);

  if (!staticGuide) {
    return <main className={styles.page}>基本情報データが見つかりません。</main>;
  }

  const rates = staticGuide.courseWinRates || [];
  const layoutImage =
    dbGuide?.layout_image_url ||
    staticGuide.layoutImageUrl ||
    null;

  const hasLayoutImage = Boolean(
    layoutImage && layoutImage !== "/book-24-stadiums.jpg"
  );

  const code = String(stadium.courseCode).padStart(2, "0");
  const topOuter = staticGuide.topOuter;
  const secondOuter = staticGuide.secondOuter;

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
          <BasicItem label="主な開催" value={staticGuide.raceType} />
          <BasicItem label="水面タイプ" value={staticGuide.waterType} />
          <BasicItem label="干満差" value={staticGuide.tide} />
          <BasicItem label="1コース1着率" value={pct(rates[0])} />
        </div>

        <p className={styles.lead}>{staticGuide.summary}</p>

        <div className={styles.sourceBox}>
          <div>
            <strong>データ出典：BOAT RACE公式 ボートレース場データ</strong>
            <span>
              集計期間：{staticGuide.periodFrom}〜{staticGuide.periodTo}
            </span>
          </div>
          <a
            href={staticGuide.officialUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            公式データを確認 →
          </a>
        </div>
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
          <div className={styles.layoutPlaceholder}>
            <div className={styles.placeholderIcon}>WATER LAYOUT</div>
            <strong>{stadium.name} 水面レイアウト</strong>
            <p>
              水面レイアウト画像は準備中です。
              <br />
              あとから画像を追加するだけで、この位置に自動表示できます。
            </p>
          </div>
        )}

        <div className={styles.noteGrid}>
          <article>
            <strong>水質：{staticGuide.waterType}</strong>
            <p>
              BOAT RACE公式の場データに掲載されている水質です。
            </p>
          </article>
          <article>
            <strong>干満差：{staticGuide.tide}</strong>
            <p>{staticGuide.tideText}</p>
          </article>
          <article>
            <strong>外で最も高い1着率</strong>
            <p>
              {topOuter.course}コース {pct(topOuter.rate)}。
              水面図追加後は位置関係と合わせて確認できます。
            </p>
          </article>
        </div>
      </section>

      <section className={styles.panel} id="tendency">
        <SectionImage
          src={SECTION_IMAGES.focus}
          alt="03 こういう艇に注目！"
        />

        <div className={styles.tendencyGrid}>
          <CourseCard
            course={1}
            rate={rates[0]}
            title={staticGuide.insideLabel}
            text={staticGuide.insideText}
          />
          <CourseCard
            course={topOuter.course}
            rate={topOuter.rate}
            title={`外で最も高い1着率`}
            text={`直近3か月では、1コース以外で最も1着率が高いのが${topOuter.course}コースです。スタートと展示気配を比較したい艇です。`}
          />
          <CourseCard
            course={secondOuter.course}
            rate={secondOuter.rate}
            title="次に見る外コース"
            text={`${topOuter.course}コースだけでなく、${secondOuter.course}コースも外の比較候補。1号艇の信頼度が下がるレースでは特に確認します。`}
          />
        </div>

        <p className={styles.miniNote}>
          ※コース別1着率は直近3か月の場全体の傾向です。個々のレースでは選手・モーター・展示・進入を優先してください。
        </p>
      </section>

      <section className={styles.panel} id="point">
        <SectionImage
          src={SECTION_IMAGES.check}
          alt="04 この場はココを見る"
        />

        <ol className={styles.points}>
          <li>
            <b>1</b>
            <div>
              <strong>まず1コースの数字を見る</strong>
              <p>
                直近3か月の1コース1着率は{pct(rates[0])}。
                この数字を「インをどこまで信頼するか」の入口にします。
              </p>
            </div>
          </li>
          <li>
            <b>2</b>
            <div>
              <strong>{topOuter.course}コースの気配を比較</strong>
              <p>
                外では{topOuter.course}コースの1着率が{pct(topOuter.rate)}で最上位。
                展示タイム・展示ST・伸びを1号艇と比較します。
              </p>
            </div>
          </li>
          <li>
            <b>3</b>
            <div>
              <strong>{staticGuide.tide === "あり" ? "潮位と水面状況" : "風と水面状況"}</strong>
              <p>{staticGuide.tideText}</p>
            </div>
          </li>
          <li>
            <b>4</b>
            <div>
              <strong>最後はそのレースの直前情報</strong>
              <p>
                場全体の傾向は土台。実際の買い目では、進入・展示・モーター・スタート気配を重ねて判断します。
              </p>
            </div>
          </li>
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
