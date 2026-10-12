// NEWS FACT：出典の見出し・要約から確認できる事実だけを取り出し、BoatStrikers の文で組み立て直す（純粋関数）。
// 取り出せない情報は書かない（推測で補わない）。出典の文をそのまま並べることもしない。

import { detectNewsEvent } from "../newsImportance.js";
import { cleanSourceSummary, detectVenue, foldNameVariants, splitHeadline } from "./sourceText.js";

const NAME_CHARS = "一-龥々〆ヶぁ-んァ-ヶー";
const NOT_NAME_RE = /優勝|予選|準優|今節|当地|地元|初日|最終|開催|女子|男子|選手|レース|ボート|モーター|結果|大会|周年|記念|賞金|節目|連勝|連覇|戦/;
const STYLE_ORDER = ["まくり差し", "イン逃げ", "逃げ", "まくり", "差し", "抜き", "恵まれ"];
const STYLE_PATTERNS = {
  "まくり差し": /まくり差し|捲り差し/,
  "イン逃げ": /イン逃げ|イン速攻|インから(?:堂々と)?(?:押し切|逃げ)/,
  逃げ: /逃げ切|逃げ(?:て|で|を決)/,
  まくり: /まくっ|まくり(?!差|切っていない)|まくって/,
  差し: /差し切|差して|差しを決/,
  抜き: /抜け出|抜き(?:去|で)/,
  恵まれ: /恵まれ/,
};
// 「通算17度目Vへ」「優勝を目指す」のような目標・展望は、達成した記録として扱わない。
const GOAL_AFTER_RE = /^(?:の)?(?:V|優勝)?(?:へ|を目指|目指|を狙|狙|に挑|に向|なるか)/;
// 1着を示す表現。
const WIN_WORD_RE = /1着|勝利|白星|勝ち(?!上が)|勝目|連勝|圧勝|快勝|完勝/;
// 決まり手だけの文節（「2コースからまくり」）。着順は書かれていないので1着とはみなさない。
const STYLE_WORD_RE = /逃げ切|まくり切|差し切|抜け出|まくって|まくり(?:で|を決|。|$)|差して/;
const STYLE_DONE = { "まくり差し": "まくり差しを決めた", "イン逃げ": "イン逃げを決めた", 逃げ: "逃げ切った", まくり: "まくった", 差し: "差し切った", 抜き: "抜け出した", 恵まれ: "展開に恵まれた" };
// 目標・展望・敗戦の言い回し（「初勝利を目指す」「まくりを許す」など）。
const GOAL_RE = /(?:勝利|白星|勝ち|1着|V|優勝)(?:を|に)?(?:目指|狙|へ|向|ならず|逃)|許|敗れ|届かず/;
const STYLE_KIMARITE = { "イン逃げ": "逃げ" };
const STYLE_PHRASE = { "まくり差し": "まくり差しを決めて", "イン逃げ": "イン逃げを決めて", 逃げ: "逃げ切って", まくり: "まくって", 差し: "差し切って", 抜き: "抜け出して", 恵まれ: "展開に恵まれて" };

function withoutQuotes(text) {
  return String(text || "").replace(/「[^」]*」|『[^』]*』/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

// 選手名。DB の選手名（同じ場・期間に出走した選手）が渡されればそれを優先し、見出し→要約の順に最初に出てくる人を主役にする。
function detectRacer({ headlineMain, summaryText, knownNames }) {
  const compactHeadline = headlineMain.replace(/\s+/g, "");
  const compactSummary = summaryText.replace(/\s+/g, "");
  const foldedHeadline = foldNameVariants(compactHeadline);
  const foldedSummary = foldNameVariants(compactSummary);
  const profile = summaryText.match(new RegExp(`([${NAME_CHARS}]{2,6})\\s*\\((\\d{2})=([一-龥]{2,3})\\)`));
  const known = (knownNames || []).filter((name) => name.length >= 2);
  // 異体字（大滝/大瀧 など）は同一視して探し、見つかった場合は記事側の表記を使う。
  const position = (name) => {
    const folded = foldNameVariants(name);
    const inHeadline = foldedHeadline.indexOf(folded);
    if (inHeadline >= 0) return inHeadline;
    const inSummary = foldedSummary.indexOf(folded);
    return inSummary >= 0 ? 1000 + inSummary : -1;
  };
  const ranked = known.map((name) => ({ name, at: position(name) })).filter((m) => m.at >= 0).sort((a, b) => a.at - b.at || b.name.length - a.name.length);
  let name = "";
  let dbName = "";
  let source = "";
  if (ranked.length) {
    // 見出しに複数の選手名がある場合は、「○○が/は」の主語になっている選手だけを主役にする。
    const inHeadline = ranked.filter((m) => m.at < 1000);
    const subject = inHeadline.find((m) => new RegExp(`${foldNameVariants(m.name)}(?:が|は)`).test(foldedHeadline));
    const chosen = inHeadline.length > 1 ? subject : ranked[0];
    if (chosen) {
      const at = chosen.at < 1000 ? chosen.at : chosen.at - 1000;
      const written = (chosen.at < 1000 ? compactHeadline : compactSummary).slice(at, at + chosen.name.length);
      name = written || chosen.name;
      dbName = chosen.name;
      source = written && written !== chosen.name ? "db_name_variant" : "db_name";
    }
  }
  if (!name && profile) {
    name = profile[1].replace(/^.*の/, "");
    source = "summary_profile";
  }
  if (!name) {
    const fromHeadline = compactHeadline.match(new RegExp(`(?:^|[のは、])([一-龥々ヶ]{3,5}|[一-龥々ヶ]{2,3}[ぁ-んァ-ヶ]{1,3})が`));
    if (fromHeadline && !NOT_NAME_RE.test(fromHeadline[1])) {
      name = fromHeadline[1];
      source = "headline";
    }
  }
  if (!name) return null;
  const age = profile && profile[1].endsWith(name) ? Number(profile[2]) : null;
  const branch = profile && profile[1].endsWith(name) ? profile[3] : "";
  return { name, dbName: dbName || name, age, branch, source };
}

function detectStyle(text) {
  for (const key of STYLE_ORDER) if (STYLE_PATTERNS[key].test(text)) return key;
  return "";
}

function detectCounts(text) {
  const counts = [];
  const add = (label) => counts.push(label);
  for (const m of text.matchAll(/(今年|通算|自身|地元|当地|([一-龥]{1,4})では|G1制覇は通算|G1は通算|SG制覇は通算)\s*(\d+)度目(?:の)?(?:V|優勝)?(?!へ|を目指|目指|を狙|狙|に挑|に向)/g)) {
    if (GOAL_AFTER_RE.test(text.slice(m.index + m[0].length, m.index + m[0].length + 6))) continue;
    const scope = m[1].startsWith("G1") ? "G1優勝は通算" : m[1].startsWith("SG") ? "SG優勝は通算" : m[2] && m[2] !== "通算" ? `${m[2]}では` : m[2] ? "通算" : m[1];
    add(`${scope}${m[3]}度目${/^(?:G1|SG)/.test(scope) ? "" : "の優勝"}`);
  }
  for (const m of text.matchAll(/([一-龥A-Za-z0-9]{2,8})は(\d+)大会ぶり(\d+)度目/g)) add(`${m[1]}は${m[2]}大会ぶり${m[3]}度目の優勝`);
  for (const m of text.matchAll(/(\d+)年ぶり(?:の)?(?:V|優勝)/g)) add(`${m[1]}年ぶりの優勝`);
  if (/今年初(?:優勝|V)/.test(text)) add("今年初優勝");
  for (const m of text.matchAll(/通算(\d+)度目(?:の)?V/g)) {
    if (!GOAL_AFTER_RE.test(text.slice(m.index + m[0].length, m.index + m[0].length + 6))) add(`通算${m[1]}度目の優勝`);
  }
  return unique(counts);
}

function detectRace(text) {

  const stage = (text.match(/(?<!準)優勝戦|準優|ドリーム戦|(?<!セミ)ファイナル/) || [""])[0];
  const races = unique([...text.matchAll(/(?<![\d.])(\d{1,2})R(?![A-Za-z])/g)].map((m) => Number(m[1])).filter((n) => n >= 1 && n <= 12));
  const final = text.match(/(\d{1,2})R(?:の)?(優勝戦|準優勝戦|準優|ドリーム戦)|(優勝戦|準優勝戦|準優|ドリーム戦)(\d{1,2})R/);
  if (final) return { raceNo: Number(final[1] || final[4]), races, stage: (final[2] || final[3]).replace("準優勝戦", "準優") };
  return { raceNo: races.length === 1 ? races[0] : null, races, stage };
}

function detectRefund(text) {
  const sale = text.match(/発売額\s*([\d億万千,]+円)/);
  const refund = text.match(/うち、?\s*([\d億万千,]+円)(?:、|が)/) || text.match(/返還(?:額)?(?:は)?\s*([\d億万千,]+円)/);
  const rate = text.match(/約?(\d{1,3})\s*[%％](?:が)?返還|返還(?:率)?(?:は)?約?(\d{1,3})\s*[%％]/);
  if (!sale && !refund && !rate) return null;
  return { sale: sale?.[1] || "", refund: refund?.[1] || "", rate: rate ? Number(rate[1] || rate[2]) : null };
}

function detectDigest(text) {
  const venues = text.match(/(\d+)場/);
  const races = text.match(/(\d+)(?:R|レース)/);
  const manshu = text.match(/万舟(?:券)?(?:が)?(\d+)本/);
  const max = text.match(/最高(?:配当)?(?:は)?([^\s、。の]{2,4}?)(\d{1,2})Rの?\s*(?:(\d-\d-\d)\s*)?([\d,]+万?[\d,]*)円/);
  return {
    venueCount: venues ? Number(venues[1]) : null,
    raceCount: races ? Number(races[1]) : null,
    manshuCount: manshu ? Number(manshu[1]) : null,
    maxPayout: max ? { venue: max[1], raceNo: Number(max[2]), trifecta: max[3] || "", text: max[4] } : null,
  };
}

function detectDate(text, publishedAt) {
  const full = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日/);
  if (full) return `${full[1]}-${full[2].padStart(2, "0")}-${full[3].padStart(2, "0")}`;
  const short = text.match(/【?(\d{1,2})月(\d{1,2})日】?/);
  if (short && publishedAt) {
    const year = new Date(new Date(publishedAt).getTime() + 9 * 3600000).getUTCFullYear();
    return `${year}-${short[1].padStart(2, "0")}-${short[2].padStart(2, "0")}`;
  }
  return "";
}

// 事実の抽出。knownNames は同じ場・期間のレースDBに出走している選手名（空白を除いた表記）。
export function extractNewsFacts(row, { knownNames = [] } = {}) {
  const { headline, main, eventLabel } = splitHeadline(row);
  const summary = cleanSourceSummary(row?.summary);
  const summaryText = summary.sentences.join("");
  // 見出しの談話（数字だけ・短すぎるものは談話として扱わない）。
  const quoteMatch = main.match(/「([^」]*[^\d\s」][^」]*)」/);
  const headlineFacts = withoutQuotes(main);
  const summaryFacts = withoutQuotes(summaryText);
  const text = `${headlineFacts}。${summaryFacts}`;
  const event = detectNewsEvent(row);
  const venue = detectVenue(row, { eventLabel, text });
  const racer = detectRacer({ headlineMain: headlineFacts, summaryText: summaryFacts, knownNames });

  // 枠・コース・ST・決まり手は、主役の選手についての文だけから取る（他の選手の数値を混ぜない）。
  const foldedText = foldNameVariants(text);
  const otherNames = (knownNames || []).map(foldNameVariants).filter((name) => name.length >= 2 && name !== foldNameVariants(racer?.dbName) && foldedText.includes(name));
  const sentences = [headlineFacts, ...summary.sentences.map(withoutQuotes)];
  const own = sentences.filter((sentence) => {
    const compact = foldNameVariants(sentence);
    // 他の選手が主語（「○○が/は」）か、枠・コースの説明対象（「3コースの○○」）になっている文は除く。
    return !otherNames.some((name) => new RegExp(`${name}(?:が|は)|(?:\\d(?:コース|枠|号艇))の${name}`).test(compact));
  });
  const ownText = own.join("。");
  // レース結果は文節（、で区切った単位）ごとに読む。同じ文の別レース・他選手の決まり手を混ぜないため。
  let raceClause = null;
  for (const sentence of own) {
    // 「5、9Rを5着、4着」のような並記は、どのレースが何着か文節では対応づけられないので読まない。
    if (/\d[、,]\s*\d{1,2}R/.test(sentence)) continue;
    let lastRace = null;
    for (const clause of sentence.split(/[、,]/)) {
      const r = clause.match(/(?<![\d.])(\d{1,2})R/);
      if (r) lastRace = { no: Number(r[1]), clause };
      const place = clause.match(/(?<!\d)([1-6])着(?!以上|以内|まで|なら|でも|を条件)/);
      if (/(?<!\d)[1-6]着(?:以上|以内|まで|なら|でも)/.test(clause)) continue;
      const winWord = !place && WIN_WORD_RE.test(clause) && !GOAL_RE.test(clause);
      const styleOnly = !place && !winWord && STYLE_WORD_RE.test(clause) && !GOAL_RE.test(clause);
      if (lastRace && (place || winWord || styleOnly)) {
        raceClause = { raceNo: lastRace.no, finish: place ? Number(place[1]) : winWord ? 1 : null, text: lastRace.clause === clause ? clause : `${lastRace.clause}、${clause}` };
        break;
      }
    }
    if (raceClause) break;
  }
  const race = detectRace(text);
  const isRaceEvent = ["win", "incident", "final", "final_result", "race_result"].includes(event.type);
  const raceNo = isRaceEvent ? race.raceNo : raceClause ? raceClause.raceNo : null;
  const scope = isRaceEvent ? ownText : raceClause?.text || "";
  const frame = scope.match(/(?:^|[^\d])([1-6])(?:枠(?!番)|号艇)/);
  const course = scope.match(/(?:^|[^\d])([1-6])コース/);
  const stMatch = scope.match(/コンマ(\d{2})/);
  const style = raceClause && raceClause.finish != null && raceClause.finish !== 1 ? "" : detectStyle(isRaceEvent ? ownText : scope);
  const won = event.type === "win" && /(?<!準)優勝戦[^。]{0,20}(?:優勝|V)|優勝(?:した|を飾|を決め|を果た)|度目(?:の)?(?:V|優勝)|V(?:$|[、。 ]|を飾)|初優勝/.test(text);
  // R番号が無い記事（「白星」だけの見出しなど）は、目標・展望でない勝利表現がある場合に限り1着とする。
  const plainWin = !raceClause && !race.races.length && !isRaceEvent && own.some((sentence) => WIN_WORD_RE.test(sentence) && !GOAL_RE.test(sentence));
  const result = won ? "優勝" : raceClause?.finish ? `${raceClause.finish}着` : plainWin ? "1着" : "";
  const motor = text.match(/(\d{1,3})号機[^。]{0,12}?(?:2連(?:対)?率)?\s*([\d.]+)\s*%/);
  const rank = text.match(/賞金ランク(?:は)?(\d+)位/);
  const sales = text.match(/総売り?上げ(?:は)?\s*([\d億万千,]+円)/);
  const salesTarget = text.match(/目標(?:の|額)?(?:は)?\s*([\d億万千,]+円)/);
  const entry = summaryFacts.match(/進入は([^。、]{2,12})/);
  const streak = ownText.match(/予選(?:を|は)?(?:無傷の)?(\d{1,2})連勝|(?<!\d)(\d{1,2})連勝|連勝(?:スタート|発進)|日またぎ連勝/);
  const standing = ownText.match(/得点率(首位|\d+位)/);
  const debut = text.match(/(愛娘|長女|次女|長男|次男|息子|娘)、?(\d{3})期の([ぁ-んァ-ヶ一-龥]{1,5})\((\d{2})\)[^。]*?(\d{1,2})月(\d{1,2})日に([一-龥]{1,3})デビュー/);
  const nextSemi = ownText.match(/準優(\d{1,2})R(\d)枠/);
  const pole = /ポールポジション(?!へ|を狙|争|を目指|獲り)/.test(text) ? 1 : null;

  return {
    headline,
    claimText: text,
    womenScope: /女子戦|女子レーサー/.test(text),
    eventLabel,
    eventType: event.type,
    venue,
    racer,
    raceNo,
    races: race.races,
    stage: race.stage,
    result,
    style,
    kimarite: STYLE_KIMARITE[style] || style,
    frame: frame ? Number(frame[1]) : pole,
    course: course ? Number(course[1]) : style === "イン逃げ" ? 1 : null,
    st: stMatch ? Number(`0.${stMatch[1]}`) : null,
    topStart: /トップスタート/.test(scope),
    flying: /フライング/.test(ownText),
    counts: detectCounts(text),
    rank: rank ? Number(rank[1]) : null,
    refund: detectRefund(text),
    sales: sales ? { total: sales[1], target: salesTarget?.[1] || "", cleared: /クリア|突破|上回/.test(text) } : null,
    entry: entry ? entry[1] : "",
    streak: streak ? streak[0] : "",
    standing: standing ? standing[1] : "",
    nextSemi: nextSemi ? { raceNo: Number(nextSemi[1]), frame: Number(nextSemi[2]) } : null,
    debut: debut ? { relation: debut[1], term: Number(debut[2]), name: debut[3], age: Number(debut[4]), month: Number(debut[5]), day: Number(debut[6]), venue: debut[7] } : null,
    motor: motor ? { no: Number(motor[1]), rate: Number(motor[2]) } : null,
    digest: event.type === "digest" ? detectDigest(`${headline}。${summaryText}`) : null,
    raceDate: detectDate(`${headline}${summaryText}`, row?.published_at),
    quote: quoteMatch ? quoteMatch[1] : "",
    summaryUsable: summary.sentences.length > 0,
    sourceRemoved: summary.removed,
  };
}

function who(racer) {
  if (!racer) return "";
  const profile = racer.age && racer.branch ? `（${racer.age}歳・${racer.branch}支部）` : "";
  return `${racer.name}${profile}`;
}

function raceLabel(facts) {
  if (facts.raceNo && facts.stage) return `${facts.raceNo}R${facts.stage}`;
  if (facts.stage) return facts.stage;
  return facts.raceNo ? `${facts.raceNo}R` : "";
}

function place(facts) {
  return facts.eventLabel || facts.venue || "";
}

// リード文（1文）。主語・場所・出来事がそろわない場合は作らない。
function buildLead(facts) {
  const where = place(facts);
  const person = who(facts.racer);
  const race = raceLabel(facts);
  const style = STYLE_PHRASE[facts.style] || "";
  switch (facts.eventType) {
    case "win":
      if (!person || !where) return "";
      return race ? `${where}の${race}で、${person}が${style}優勝した。` : `${where}で、${person}が${style}優勝した。`;
    case "final":
      if (!person || !where || !facts.frame) return "";
      return `${where}の${facts.stage === "ファイナル" ? "ファイナル" : "優勝戦"}で、${person}が${facts.frame}枠に入った。`;
    case "incident":
      if (!person || !where || !facts.flying) return "";
      return `${where}${race ? `の${race}` : ""}で、${person}${facts.frame ? `（${facts.frame}号艇）` : ""}がフライングとなった。`;
    case "digest": {
      const d = facts.digest || {};
      if (!facts.raceDate || !d.raceCount) return "";
      const [, m, day] = facts.raceDate.split("-").map(Number);
      return `${m}月${day}日のボートレースは${d.venueCount ? `${d.venueCount}場・` : ""}${d.raceCount}レースが行われた。`;
    }
    case "race_result":
    case "final_result": {
      if (!facts.venue || !facts.raceNo || !facts.raceDate) return "";
      const [, m, day] = facts.raceDate.split("-").map(Number);
      return `${m}月${day}日の${facts.venue}${facts.raceNo}Rの結果が確定した。`;
    }
    case "bs_motor":
      if (!person || !facts.motor || !facts.venue) return "";
      return `${facts.venue}${facts.womenScope ? "の女子戦" : ""}で、出場選手のモーター2連対率は${person}の${facts.motor.no}号機（${facts.motor.rate}%）が最も高い。`;
    case "column":
      if (facts.sales && where) return `${where}の総売上は${facts.sales.total}${facts.sales.target && facts.sales.cleared ? `で、目標の${facts.sales.target}を上回った` : ""}。`;
      return "";
    default: {
      if (facts.debut && person) {
        const d = facts.debut;
        return `${person}の${d.relation}・${d.name}（${d.age}歳、${d.term}期）が、${d.month}月${d.day}日に${d.venue}でデビューする予定。`;
      }
      if (!person || !where) return "";
      if (/^\d着$/.test(facts.result)) {
        const how = `${facts.course ? `${facts.course}コースから` : ""}${facts.result === "1着" ? style : ""}`;
        return `${where}${facts.raceNo ? `の${facts.raceNo}R` : ""}で、${person}が${how}${facts.result}となった。`;
      }
      if (facts.raceNo && facts.style && !facts.result) {
        return `${where}の${facts.raceNo}Rで、${person}が${facts.course ? `${facts.course}コースから` : ""}${STYLE_DONE[facts.style]}。`;
      }
      if (/初日/.test(facts.claimText) && /連勝/.test(facts.streak)) return `${where}で、${person}が初日に連勝した。`;
      if (/初日/.test(facts.headline + facts.streak) && /連勝/.test(facts.streak)) return `${where}で、${person}が初日に連勝した。`;
      if (/日またぎ連勝/.test(facts.streak)) return `${where}で、${person}が日をまたいで連勝した。`;
      if (/^\d連勝$/.test(facts.streak)) return `${where}で、${person}が${facts.streak}とした。`;
      return "";
    }
  }
}

// 箇条書きの事実（ラベル付き）。出典にある数値・表現だけを使う。
function buildPoints(facts) {
  const points = [];
  const push = (label, value) => value && points.push({ label, value });
  for (const count of facts.counts) push("記録", count);
  if (facts.rank) push("賞金ランク", `${facts.rank}位`);
  if (facts.entry) push("進入", facts.entry);
  if (facts.st != null && facts.eventType !== "incident" && facts.eventType !== "final") push("スタート", `コンマ${String(facts.st).slice(2).padEnd(2, "0")}${facts.topStart ? "（トップスタート）" : ""}`);
  if (facts.flying && facts.st != null && facts.eventType === "incident") push("スタート", `コンマ${String(facts.st).slice(2).padEnd(2, "0")}のフライング`);
  if (facts.refund) {
    const { sale, refund, rate } = facts.refund;
    push("返還", [refund && `${refund}`, sale && `発売額${sale}`, rate != null && `約${rate}%`].filter(Boolean).join("／"));
  }
  if (facts.sales) push("売上", `${facts.sales.total}${facts.sales.target ? `（目標${facts.sales.target}）` : ""}`);
  if (facts.standing) push("得点率", facts.standing);
  if (facts.streak && facts.eventType !== "win") push("戦績", facts.streak.replace(/^予選(?:を|は)?/, "予選で"));
  if (facts.nextSemi) push("準優", `${facts.nextSemi.raceNo}R・${facts.nextSemi.frame}枠`);
  if (facts.digest) {
    const d = facts.digest;
    if (d.manshuCount != null) push("万舟", `${d.manshuCount}本`);
    if (d.maxPayout) push("最高配当", `${d.maxPayout.venue}${d.maxPayout.raceNo}R${d.maxPayout.trifecta ? ` ${d.maxPayout.trifecta}` : ""} ${d.maxPayout.text}円`);
  }
  if (facts.quote) push("談話（見出し）", `「${facts.quote}」`);
  return points;
}

// NEWS FACT の組み立て。lead も points も無い場合は null（創作しない）。
export function buildNewsFact(row, options = {}) {
  const facts = extractNewsFacts(row, options);
  const lead = buildLead(facts);
  const points = buildPoints(facts);
  if (!lead && !points.length) return { facts, section: null };
  return { facts, section: { lead, points } };
}

