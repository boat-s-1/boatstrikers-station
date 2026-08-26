import Link from "next/link";
import { normalizeCourseCode, normalizeDate } from "../../../lib/boatstrikersPlatform";
import { resolveStadium, stadiumPath } from "../../../../lib/stadiums";
import { getStadiumGuide } from "../../../../lib/stadiumGuideData";
import { getStadiumBasicGuide } from "../../../../lib/stadiumBasicGuide24";
import styles from "./stadiumInfo.module.css";
import StadiumHeroBanner from "../../components/StadiumHeroBanner";

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

function WaterSchematic({ stadium, guide }) {
  const code = String(stadium.courseCode).padStart(2, "0");
  const rates = guide.courseWinRates || [];
  const topOuter = guide.topOuter || { course: 2, rate: null };
  const laneY = [190, 214, 238, 262, 286, 310];

  return (
    <div className={styles.waterSchematicWrap}>
      <svg
        className={styles.waterSchematic}
        viewBox="0 0 1000 520"
        role="img"
        aria-label={`${stadium.name} 水面模式図。縮尺なし。`}
      >
        <defs>
          <linearGradient id={`water-${code}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#073e6f" />
            <stop offset="55%" stopColor="#087db0" />
            <stop offset="100%" stopColor="#19a5c8" />
          </linearGradient>
          <linearGradient id={`panel-${code}`} x1="0" x2="1">
            <stop offset="0%" stopColor="#071d36" stopOpacity=".94" />
            <stop offset="100%" stopColor="#0b3152" stopOpacity=".86" />
          </linearGradient>
        </defs>

        <rect width="1000" height="520" rx="28" fill="#061d35" />
        <rect x="24" y="24" width="952" height="472" rx="24" fill={`url(#water-${code})`} />

        <path
          d="M165 150 H775 C860 150 910 195 910 250 C910 305 860 350 775 350 H165 C80 350 42 305 42 250 C42 195 80 150 165 150 Z"
          fill="none"
          stroke="#bcecff"
          strokeWidth="3"
          strokeOpacity=".78"
        />
        <path
          d="M165 176 H770 C832 176 874 208 874 250 C874 292 832 324 770 324 H165 C104 324 78 292 78 250 C78 208 104 176 165 176 Z"
          fill="none"
          stroke="#8bd7f2"
          strokeWidth="1.5"
          strokeOpacity=".62"
        />

        {laneY.map((y, index) => {
          const lane = index + 1;
          const active = lane === Number(topOuter.course);
          return (
            <g key={lane}>
              <line
                x1="178"
                y1={y}
                x2="760"
                y2={y}
                stroke={active ? "#ffe38a" : "#dff6ff"}
                strokeWidth={active ? "4" : "2"}
                strokeOpacity={active ? ".95" : ".48"}
              />
              <circle cx="154" cy={y} r="13" fill={active ? "#ffe38a" : "#ffffff"} fillOpacity={active ? "1" : ".88"} />
              <text x="154" y={y + 5} textAnchor="middle" fontSize="14" fontWeight="900" fill="#073454">
                {lane}
              </text>
            </g>
          );
        })}

        <line x1="724" y1="160" x2="724" y2="340" stroke="#fff" strokeWidth="4" strokeDasharray="10 8" />
        <text x="724" y="142" textAnchor="middle" fontSize="17" fontWeight="900" fill="#fff">START</text>

        <circle cx="828" cy="250" r="17" fill="#ff7557" stroke="#fff" strokeWidth="5" />
        <circle cx="126" cy="250" r="17" fill="#ff7557" stroke="#fff" strokeWidth="5" />
        <text x="828" y="286" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff">1M</text>
        <text x="126" y="286" textAnchor="middle" fontSize="16" fontWeight="900" fill="#fff">2M</text>

        <rect x="46" y="42" width="405" height="86" rx="18" fill={`url(#panel-${code})`} />
        <text x="70" y="74" fontSize="14" fontWeight="900" fill="#83dfff" letterSpacing="2">BOATSTRIKERS WATER GUIDE</text>
        <text x="70" y="111" fontSize="31" fontWeight="900" fill="#fff">#{code} {stadium.name}</text>

        <rect x="760" y="48" width="176" height="46" rx="23" fill="#ffffff" fillOpacity=".92" />
        <text x="848" y="77" textAnchor="middle" fontSize="15" fontWeight="900" fill="#174b6d">模式図・縮尺なし</text>

        <g transform="translate(54 392)">
          <rect width="892" height="78" rx="18" fill="#061a30" fillOpacity=".83" />
          <text x="28" y="31" fontSize="13" fontWeight="800" fill="#84cbe9">水質</text>
          <text x="28" y="56" fontSize="21" fontWeight="900" fill="#fff">{guide.waterType || "—"}</text>

          <text x="202" y="31" fontSize="13" fontWeight="800" fill="#84cbe9">干満差</text>
          <text x="202" y="56" fontSize="21" fontWeight="900" fill="#fff">{guide.tide || "—"}</text>

          <text x="370" y="31" fontSize="13" fontWeight="800" fill="#84cbe9">1コース1着率</text>
          <text x="370" y="56" fontSize="21" fontWeight="900" fill="#fff">{pct(rates[0])}</text>

          <text x="602" y="31" fontSize="13" fontWeight="800" fill="#84cbe9">外で最も高い1着率</text>
          <text x="602" y="56" fontSize="21" fontWeight="900" fill="#ffe38a">{topOuter.course}コース {pct(topOuter.rate)}</text>
        </g>
      </svg>
      <p className={styles.waterSchematicNote}>
        ※コース位置を分かりやすく示したBoatStrikers模式図です。実際の水面寸法・ターンマーク位置を正確な縮尺で再現した図ではありません。
      </p>
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
      <StadiumHeroBanner courseCode={courseCode} compact />

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
          <WaterSchematic stadium={stadium} guide={staticGuide} />
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
              コース傾向と当日の展示・スタート気配を合わせて確認します。
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
            title="外で最も高い1着率"
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
