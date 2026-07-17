"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  useParams,
  useRouter,
  useSearchParams,
} from "next/navigation";

import { racecourses } from "../../../data/racecourses";
import { getCourseRaces } from "../../../data/raceSchedule";

import "./race-detail.css";

/* =========================
   基本設定
========================= */

const VALID_TABS = ["basic", "previous", "live"];

const BOAT_CLASS_NAMES = {
  1: "boat1",
  2: "boat2",
  3: "boat3",
  4: "boat4",
  5: "boat5",
  6: "boat6",
};

const BOAT_COLOR_NAMES = {
  1: "白",
  2: "黒",
  3: "赤",
  4: "青",
  5: "黄",
  6: "緑",
};

/* =========================
   表示用関数
========================= */

function getRaceTypeLabel(type) {
  if (type === "night") return "ナイター";
  if (type === "morning") return "モーニング";
  return "デイ";
}

function getStatusInfo(status) {
  if (status === "closed") {
    return {
      label: "締切",
      className: "closed",
    };
  }

  if (status === "soon") {
    return {
      label: "まもなく締切",
      className: "soon",
    };
  }

  return {
    label: "発売中",
    className: "before",
  };
}

function getGradeClass(grade) {
  if (grade === "SG") return "raceDetailGrade sg";
  if (grade === "G1") return "raceDetailGrade g1";
  if (grade === "G2") return "raceDetailGrade g2";
  if (grade === "G3") return "raceDetailGrade g3";

  return "raceDetailGrade general";
}

function getEvaluation(score) {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  return "D";
}

function getEvaluationClass(score) {
  if (score >= 90) return "rankS";
  if (score >= 80) return "rankA";
  if (score >= 70) return "rankB";
  if (score >= 60) return "rankC";
  return "rankD";
}

/* =========================
   仮AIデータ生成
   後ほどSupabaseへ変更可能
========================= */

function createPreviousPrediction(race) {
  const firstRacer = race.racers[0];

  const baseScore =
    race.ichikaScore ||
    Math.min(
      92,
      Math.round(
        52 +
          firstRacer.nationalRate * 2.8 +
          firstRacer.localRate * 1.6
      )
    );

  const sortedRacers = [...race.racers].sort((a, b) => {
    const scoreA =
      a.nationalRate * 1.2 +
      a.localRate -
      a.averageStart * 10;

    const scoreB =
      b.nationalRate * 1.2 +
      b.localRate -
      b.averageStart * 10;

    return scoreB - scoreA;
  });

  const opponent1 =
    sortedRacers.find((racer) => racer.boatNo !== 1)?.boatNo || 2;

  const opponent2 =
    sortedRacers.find(
      (racer) =>
        racer.boatNo !== 1 &&
        racer.boatNo !== opponent1
    )?.boatNo || 3;

  return {
    score: baseScore,
    rank: getEvaluation(baseScore),
    danger:
      baseScore >= 82
        ? "低"
        : baseScore >= 70
          ? "中"
          : "高",

    marks: {
      main: 1,
      second: opponent1,
      third: opponent2,
      fourth: [2, 3, 4, 5, 6].find(
        (boatNo) =>
          boatNo !== opponent1 &&
          boatNo !== opponent2
      ),
    },

    comments: [
      `1号艇 ${firstRacer.name}は全国勝率${firstRacer.nationalRate.toFixed(
        2
      )}、当地勝率${firstRacer.localRate.toFixed(2)}。`,
      `平均STは${firstRacer.averageStart.toFixed(
        2
      )}で、前日時点ではイン中心の評価です。`,
      `${opponent1}号艇を相手筆頭、${opponent2}号艇を連下候補として評価しています。`,
    ],

    bets: [
      `1-${opponent1}-${opponent2}`,
      `1-${opponent2}-${opponent1}`,
      `1-${opponent1}-4`,
      `1-${opponent2}-4`,
    ],
  };
}

function createLivePrediction(race, previousPrediction) {
  const exhibitionScores = race.racers.map((racer) => {
    const score = Math.max(
      55,
      Math.min(
        96,
        Math.round(
          85 -
            racer.averageStart * 70 +
            racer.nationalRate * 1.6 +
            ((race.raceNo * racer.boatNo) % 8)
        )
      )
    );

    return {
      boatNo: racer.boatNo,
      exhibitionTime: Number(
        (
          6.62 +
          ((race.raceNo * 7 + racer.boatNo * 3) % 20) /
            100
        ).toFixed(2)
      ),
      startTiming: Number(
        (
          0.03 +
          ((race.raceNo + racer.boatNo * 2) % 15) /
            100
        ).toFixed(2)
      ),
      score,
      rank: getEvaluation(score),
    };
  });

  const firstExhibition = exhibitionScores.find(
    (item) => item.boatNo === 1
  );

  const scoreChange =
    firstExhibition.score >= 85
      ? 6
      : firstExhibition.score >= 75
        ? 2
        : -5;

  const liveScore = Math.max(
    35,
    Math.min(97, previousPrediction.score + scoreChange)
  );

  const strongestOpponent = [...exhibitionScores]
    .filter((item) => item.boatNo !== 1)
    .sort((a, b) => b.score - a.score)[0];

  const secondOpponent = [...exhibitionScores]
    .filter(
      (item) =>
        item.boatNo !== 1 &&
        item.boatNo !== strongestOpponent.boatNo
    )
    .sort((a, b) => b.score - a.score)[0];

  return {
    score: liveScore,
    scoreChange,
    rank: getEvaluation(liveScore),
    entryPrediction: "123 / 456",
    wind: "向かい風 2m",
    wave: "2cm",
    exhibitionScores,

    comments: [
      scoreChange >= 0
        ? "1号艇は展示後も大きなマイナス材料がなく、前日評価を維持しています。"
        : "1号艇の展示気配にやや不安があり、前日評価から下方修正しました。",

      `${strongestOpponent.boatNo}号艇の展示評価が高く、相手筆頭です。`,

      `${secondOpponent.boatNo}号艇も連下候補として押さえたい気配です。`,
    ],

    bets: [
      `1-${strongestOpponent.boatNo}-${secondOpponent.boatNo}`,
      `1-${secondOpponent.boatNo}-${strongestOpponent.boatNo}`,
      `1-${strongestOpponent.boatNo}-4`,
    ],
  };
}

/* =========================
   共通パーツ
========================= */

function ProbabilityMeter({ value }) {
  return (
    <div className="probabilityMeter">
      <div className="probabilityMeterHeader">
        <span>イン逃げ期待度</span>
        <strong>{value}%</strong>
      </div>

      <div className="probabilityTrack">
        <span
          className="probabilityFill"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function BoatBadge({ boatNo, small = false }) {
  return (
    <span
      className={`detailBoatBadge ${
        BOAT_CLASS_NAMES[boatNo]
      } ${small ? "small" : ""}`}
    >
      {boatNo}
    </span>
  );
}

function PredictionMark({ mark, boatNo }) {
  return (
    <div className="predictionMarkItem">
      <span className={`markSymbol mark${mark}`}>
        {mark}
      </span>

      <BoatBadge boatNo={boatNo} small />
    </div>
  );
}

/* =========================
   基本出走表タブ
========================= */

function BasicEntryTab({ race }) {
  return (
    <section className="tabPanel">
      <div className="panelHeading">
        <div>
          <p className="panelEnglish">ENTRY LIST</p>
          <h2>基本出走表</h2>
        </div>

        <span className="panelBadge">6艇</span>
      </div>

      <div className="basicGuide">
        <span>📋</span>

        <p>
          選手の級別、全国勝率、当地勝率、平均STを確認できます。
        </p>
      </div>

      <div className="entryCardList">
        {race.racers.map((racer) => (
          <article
            className="entryRacerCard"
            key={racer.boatNo}
          >
            <div className="entryRacerTop">
              <BoatBadge boatNo={racer.boatNo} />

              <div className="entryRacerName">
                <div>
                  <span className="boatColorName">
                    {BOAT_COLOR_NAMES[racer.boatNo]}
                  </span>

                  <span
                    className={`entryClassBadge ${racer.className.toLowerCase()}`}
                  >
                    {racer.className}
                  </span>
                </div>

                <h3>{racer.name}</h3>
                <p>登録番号 {4300 + racer.boatNo * 37}</p>
              </div>

              {racer.boatNo === 1 && (
                <span className="firstBoatLabel">
                  イン
                </span>
              )}
            </div>

            <div className="entryStatsGrid">
              <div>
                <span>全国勝率</span>
                <strong>
                  {racer.nationalRate.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>当地勝率</span>
                <strong>
                  {racer.localRate.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>平均ST</span>
                <strong>
                  {racer.averageStart.toFixed(2)}
                </strong>
              </div>

              <div>
                <span>モーター</span>
                <strong>
                  {(
                    28 +
                    ((race.raceNo * racer.boatNo * 3) % 22)
                  ).toFixed(1)}
                  %
                </strong>
              </div>
            </div>

            <div className="entryExtraRow">
              <span>
                モーター
                <b>
                  {10 +
                    ((race.raceNo + racer.boatNo * 7) % 70)}
                </b>
              </span>

              <span>
                ボート
                <b>
                  {12 +
                    ((race.raceNo + racer.boatNo * 9) % 65)}
                </b>
              </span>

              <span>
                F
                <b>0</b>
              </span>

              <span>
                L
                <b>0</b>
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/* =========================
   前日版タブ
========================= */

function PreviousTab({ race, prediction }) {
  return (
    <section className="tabPanel">
      <div className="newspaperHero previousNewspaper">
        <div className="newspaperCharacter">
          🍊
        </div>

        <div>
          <p>ICHIKA PREVIOUS DAY</p>
          <h2>一果の前日版新聞</h2>
          <span>
            出走情報をもとに前日時点でAI解析
          </span>
        </div>
      </div>

      <article className="predictionMainCard">
        <div className="predictionMainTop">
          <div>
            <p className="predictionSmallTitle">
              前日AI評価
            </p>

            <div className="predictionRankRow">
              <span
                className={`predictionRank ${getEvaluationClass(
                  prediction.score
                )}`}
              >
                {prediction.rank}
              </span>

              <div>
                <strong>イン中心評価</strong>
                <p>
                  危険度：
                  <b>{prediction.danger}</b>
                </p>
              </div>
            </div>
          </div>

          <div className="predictionBoatOne">
            <BoatBadge boatNo={1} />
            <span>本命</span>
          </div>
        </div>

        <ProbabilityMeter value={prediction.score} />
      </article>

      <article className="marksCard">
        <div className="smallCardHeading">
          <span>🎯</span>

          <div>
            <p>AI MARK</p>
            <h3>一果の印</h3>
          </div>
        </div>

        <div className="marksGrid">
          <PredictionMark
            mark="◎"
            boatNo={prediction.marks.main}
          />

          <PredictionMark
            mark="○"
            boatNo={prediction.marks.second}
          />

          <PredictionMark
            mark="▲"
            boatNo={prediction.marks.third}
          />

          <PredictionMark
            mark="△"
            boatNo={prediction.marks.fourth}
          />
        </div>
      </article>

      <article className="analysisCard">
        <div className="smallCardHeading">
          <span>🔍</span>

          <div>
            <p>AI ANALYSIS</p>
            <h3>前日時点の分析</h3>
          </div>
        </div>

        <div className="analysisList">
          {prediction.comments.map((comment, index) => (
            <div className="analysisItem" key={comment}>
              <span>{index + 1}</span>
              <p>{comment}</p>
            </div>
          ))}
        </div>
      </article>

      <article className="betCard">
        <div className="betCardHeader">
          <div>
            <p>RECOMMENDED TICKETS</p>
            <h3>前日版おすすめ買い目</h3>
          </div>

          <span>{prediction.bets.length}点</span>
        </div>

        <div className="betTicketGrid">
          {prediction.bets.map((bet, index) => (
            <div
              className={
                index === 0
                  ? "betTicket mainBet"
                  : "betTicket"
              }
              key={bet}
            >
              {index === 0 && <small>本線</small>}
              <strong>{bet}</strong>
            </div>
          ))}
        </div>

        <p className="betNotice">
          ※前日時点の情報をもとにした参考予想です。
        </p>
      </article>
    </section>
  );
}

/* =========================
   直前版タブ
========================= */

function LiveTab({
  race,
  previousPrediction,
  livePrediction,
}) {
  const isUp = livePrediction.scoreChange >= 0;

  return (
    <section className="tabPanel">
      <div className="newspaperHero liveNewspaper">
        <div className="newspaperCharacter">
          ⚡
        </div>

        <div>
          <p>ICHIKA LIVE UPDATE</p>
          <h2>一果の直前版</h2>
          <span>
            展示・進入・直前気配を反映した最終評価
          </span>
        </div>
      </div>

      <article className="liveUpdateCard">
        <div className="liveUpdateTop">
          <div>
            <p>前日版からの変化</p>

            <div className="scoreComparison">
              <span>{previousPrediction.score}%</span>
              <b>→</b>
              <strong>{livePrediction.score}%</strong>
            </div>
          </div>

          <span
            className={
              isUp
                ? "scoreChange scoreUp"
                : "scoreChange scoreDown"
            }
          >
            {isUp ? "+" : ""}
            {livePrediction.scoreChange}
          </span>
        </div>

        <ProbabilityMeter value={livePrediction.score} />

        <div className="liveInfoGrid">
          <div>
            <span>最終評価</span>
            <strong
              className={getEvaluationClass(
                livePrediction.score
              )}
            >
              {livePrediction.rank}
            </strong>
          </div>

          <div>
            <span>進入予想</span>
            <strong>
              {livePrediction.entryPrediction}
            </strong>
          </div>

          <div>
            <span>風向・風速</span>
            <strong>{livePrediction.wind}</strong>
          </div>

          <div>
            <span>波高</span>
            <strong>{livePrediction.wave}</strong>
          </div>
        </div>
      </article>

      <article className="exhibitionCard">
        <div className="smallCardHeading">
          <span>🚤</span>

          <div>
            <p>EXHIBITION</p>
            <h3>展示評価</h3>
          </div>
        </div>

        <div className="exhibitionTable">
          <div className="exhibitionHeader">
            <span>艇</span>
            <span>展示</span>
            <span>ST</span>
            <span>評価</span>
          </div>

          {livePrediction.exhibitionScores.map(
            (item) => (
              <div
                className="exhibitionRow"
                key={item.boatNo}
              >
                <BoatBadge
                  boatNo={item.boatNo}
                  small
                />

                <strong>
                  {item.exhibitionTime.toFixed(2)}
                </strong>

                <strong>
                  {item.startTiming.toFixed(2)}
                </strong>

                <span
                  className={`exhibitionRank ${getEvaluationClass(
                    item.score
                  )}`}
                >
                  {item.rank}
                </span>
              </div>
            )
          )}
        </div>
      </article>

      <article className="analysisCard">
        <div className="smallCardHeading">
          <span>📝</span>

          <div>
            <p>LIVE COMMENT</p>
            <h3>直前コメント</h3>
          </div>
        </div>

        <div className="analysisList">
          {livePrediction.comments.map(
            (comment, index) => (
              <div
                className="analysisItem"
                key={comment}
              >
                <span>{index + 1}</span>
                <p>{comment}</p>
              </div>
            )
          )}
        </div>
      </article>

      <article className="betCard liveBetCard">
        <div className="betCardHeader">
          <div>
            <p>FINAL TICKETS</p>
            <h3>直前版・最終買い目</h3>
          </div>

          <span>{livePrediction.bets.length}点</span>
        </div>

        <div className="betTicketGrid">
          {livePrediction.bets.map((bet, index) => (
            <div
              className={
                index === 0
                  ? "betTicket mainBet"
                  : "betTicket"
              }
              key={bet}
            >
              {index === 0 && <small>本線</small>}
              <strong>{bet}</strong>
            </div>
          ))}
        </div>

        <p className="betNotice">
          ※展示後データを反映した参考予想です。
        </p>
      </article>
    </section>
  );
}

/* =========================
   メインページ
========================= */

export default function RaceDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const courseCode = String(
    params?.courseCode || ""
  ).padStart(2, "0");

  const raceNo = Number(params?.raceNo);

  const tabFromUrl = searchParams.get("tab");

  const initialTab = VALID_TABS.includes(tabFromUrl)
    ? tabFromUrl
    : "basic";

  const [activeTab, setActiveTab] =
    useState(initialTab);

  useEffect(() => {
    if (
      tabFromUrl &&
      VALID_TABS.includes(tabFromUrl)
    ) {
      setActiveTab(tabFromUrl);
    }
  }, [tabFromUrl]);

  const course = useMemo(() => {
    return racecourses.find(
      (item) => item.code === courseCode
    );
  }, [courseCode]);

  const races = useMemo(() => {
    return getCourseRaces(courseCode);
  }, [courseCode]);

  const race = useMemo(() => {
    return races.find(
      (item) => item.raceNo === raceNo
    );
  }, [races, raceNo]);

  const previousPrediction = useMemo(() => {
    if (!race) return null;
    return createPreviousPrediction(race);
  }, [race]);

  const livePrediction = useMemo(() => {
    if (!race || !previousPrediction) return null;

    return createLivePrediction(
      race,
      previousPrediction
    );
  }, [race, previousPrediction]);

  function changeTab(tabName) {
    setActiveTab(tabName);

    router.replace(
      `/races/${courseCode}/${raceNo}?tab=${tabName}`,
      {
        scroll: false,
      }
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  if (
    !course ||
    !race ||
    !previousPrediction ||
    !livePrediction
  ) {
    return (
      <main className="raceDetailPage">
        <section className="raceDetailNotFound">
          <span>🚤</span>
          <h1>レースが見つかりません</h1>
          <p>
            開催場コードまたはレース番号を確認してください。
          </p>

          <Link href="/races">
            開催場一覧へ戻る
          </Link>
        </section>
      </main>
    );
  }

  const statusInfo = getStatusInfo(race.status);

  return (
    <main className="raceDetailPage">
      <header
        className={`raceDetailHero ${course.raceType}`}
      >
        <div className="raceDetailHeroInner">
          <div className="raceDetailTopNav">
            <Link
              href={`/races/${courseCode}`}
              className="raceDetailBack"
            >
              ← {course.name}レース一覧
            </Link>

            <Link
              href="/races"
              className="raceDetailCourseList"
            >
              開催場一覧
            </Link>
          </div>

          <div className="raceDetailTitleArea">
            <div className="raceDetailRaceNumber">
              <strong>{race.raceNo}</strong>
              <span>R</span>
            </div>

            <div className="raceDetailTitle">
              <div className="raceDetailCourseRow">
                <h1>{course.name}</h1>

                <span
                  className={getGradeClass(
                    course.grade
                  )}
                >
                  {course.grade || "一般"}
                </span>
              </div>

              <h2>{race.raceName}</h2>

              <div className="raceDetailMeta">
                <span>{course.dayText}</span>
                <span>
                  {getRaceTypeLabel(
                    course.raceType
                  )}
                </span>
                <span>
                  締切予定 {race.deadline}
                </span>
              </div>
            </div>

            <span
              className={`raceDetailStatus ${statusInfo.className}`}
            >
              {statusInfo.label}
            </span>
          </div>
        </div>
      </header>

      <nav className="raceDetailTabs">
        <div className="raceDetailTabsInner">
          <button
            type="button"
            className={
              activeTab === "basic"
                ? "raceDetailTab active basic"
                : "raceDetailTab basic"
            }
            onClick={() => changeTab("basic")}
          >
            <span>📋</span>

            <div>
              <small>基本情報</small>
              <strong>出走表</strong>
            </div>
          </button>

          <button
            type="button"
            className={
              activeTab === "previous"
                ? "raceDetailTab active previous"
                : "raceDetailTab previous"
            }
            onClick={() =>
              changeTab("previous")
            }
          >
            <span>📰</span>

            <div>
              <small>AI予想</small>
              <strong>前日版</strong>
            </div>
          </button>

          <button
            type="button"
            className={
              activeTab === "live"
                ? "raceDetailTab active live"
                : "raceDetailTab live"
            }
            onClick={() => changeTab("live")}
          >
            <span>⚡</span>

            <div>
              <small>展示後更新</small>
              <strong>直前版</strong>
            </div>
          </button>
        </div>
      </nav>

      <div className="raceDetailContent">
        {activeTab === "basic" && (
          <BasicEntryTab race={race} />
        )}

        {activeTab === "previous" && (
          <PreviousTab
            race={race}
            prediction={previousPrediction}
          />
        )}

        {activeTab === "live" && (
          <LiveTab
            race={race}
            previousPrediction={
              previousPrediction
            }
            livePrediction={livePrediction}
          />
        )}

        <section className="raceMoveSection">
          {raceNo > 1 ? (
            <Link
              href={`/races/${courseCode}/${raceNo - 1}`}
              className="raceMoveButton previousRace"
            >
              <span>←</span>

              <div>
                <small>前のレース</small>
                <strong>{raceNo - 1}R</strong>
              </div>
            </Link>
          ) : (
            <div className="raceMoveSpacer" />
          )}

          {raceNo < 12 ? (
            <Link
              href={`/races/${courseCode}/${raceNo + 1}`}
              className="raceMoveButton nextRace"
            >
              <div>
                <small>次のレース</small>
                <strong>{raceNo + 1}R</strong>
              </div>

              <span>→</span>
            </Link>
          ) : (
            <div className="raceMoveSpacer" />
          )}
        </section>
      </div>

      <nav className="raceDetailBottomNav">
        <Link href="/races">
          <span>🚩</span>
          <small>開催場</small>
        </Link>

        <Link href={`/races/${courseCode}`}>
          <span>📑</span>
          <small>レース一覧</small>
        </Link>

        <Link href="/">
          <span>🏠</span>
          <small>ホーム</small>
        </Link>
      </nav>
    </main>
  );
}
