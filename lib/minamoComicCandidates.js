function statsMap(payload) {
  const map = {};
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  stats.forEach((s) => {
    map[String(s?.label || "")] = String(s?.value || "");
  });
  return map;
}

function fact(label, value) {
  const text = value === null || value === undefined ? "" : String(value).trim();
  return text ? { label, value: text } : null;
}

function compactFacts(list) {
  return list.filter(Boolean).slice(0, 5);
}

function topText(payload) {
  const top = payload?.max_payout;
  if (!top) return "";
  const payout = Number(top.payout || 0);
  return `${top.venue || ""}${top.race_no || ""}R ${top.trifecta || ""}${payout ? ` / ${payout.toLocaleString("ja-JP")}円` : ""}`.trim();
}

function headlineOf(item) {
  return String(item?.list_headline || item?.title || "").trim();
}

function summaryOf(item) {
  return String(item?.summary || item?.article_body || "").replace(/\s+/g, " ").trim().slice(0, 180);
}

function newsScore(item) {
  const text = `${headlineOf(item)} ${summaryOf(item)} ${item?.category || ""}`;
  let score = Number(item?.priority || 0) * 2 + (item?.is_featured ? 20 : 0);
  if (/SG|G1|GⅠ|優勝戦|ドリーム|優勝|万舟|高配当|失格|転覆|妨害|事故/.test(text)) score += 24;
  if (/女子|ヴィーナス|オールレディース|レディース/.test(text)) score += 12;
  if (/イン|1号艇|逃げ/.test(text)) score += 8;
  return score;
}

function characterForNews(item) {
  const text = `${headlineOf(item)} ${summaryOf(item)}`;
  if (/女子|ヴィーナス|オールレディース|レディース/.test(text)) return ["hatsune", "ichika", "kiina"];
  if (/万舟|高配当|波乱|5号艇|6号艇|失格|転覆|妨害|事故/.test(text)) return ["kiina", "ichika", "hatsune"];
  if (/イン|1号艇|逃げ/.test(text)) return ["ichika", "kiina", "hatsune"];
  return ["ichika", "hatsune", "kiina"];
}

export function buildMinamoComicCandidates({ payload, newsItems = [] } = {}) {
  const s = statsMap(payload);
  const date = String(payload?.date || "");
  const manshu = s["万舟"] || "";
  const manshuRate = s["万舟率"] || "";
  const boat1 = s["1号艇1着"] || s["1号艇1着数"] || "";
  const boat5 = s["5号艇1着"] || s["5号艇1着数"] || "";
  const escape = s["逃げ"] || "";
  const held = s["開催"] || s["開催数"] || "";
  const maxPayout = topText(payload);

  const highPayout = {
    id: `${date}-payout`,
    topicType: "payout",
    badge: "高配当",
    title: maxPayout ? `最高配当 ${maxPayout.split(" / ")[0]}を研究！` : "昨日の万舟を研究！",
    lead: [maxPayout && `最高配当は${maxPayout}`, manshu && `万舟は${manshu}`, boat5 && `5号艇1着は${boat5}`].filter(Boolean).join("。") + "。",
    facts: compactFacts([
      fact("万舟", manshu),
      fact("万舟率", manshuRate),
      fact("最高配当", maxPayout),
      fact("5号艇1着", boat5),
    ]),
    newsSummary: "",
    recommendedCharacters: ["kiina", "ichika", "hatsune"],
    comicAngle: "キイナが高配当に大きく反応し、一果が実データを整理、初音が静かに核心を突く学園コメディ。",
    priority: 95,
  };

  const rankedNews = [...(Array.isArray(newsItems) ? newsItems : [])]
    .filter((item) => headlineOf(item))
    .sort((a, b) => newsScore(b) - newsScore(a));
  const news = rankedNews[0] || null;

  const newsCandidate = news ? {
    id: `${date}-news-${news.id || "top"}`,
    topicType: "news",
    badge: "時事ニュース",
    title: headlineOf(news),
    lead: summaryOf(news) || "BoatStrikers NEWSの注目トピックを、ふなけん研究部で4コマ化します。",
    facts: compactFacts([
      fact("ニュース見出し", headlineOf(news)),
      fact("カテゴリ", news.category),
      fact("開催場", news.place),
      fact("公開日時", news.published_at),
    ]),
    newsSummary: [headlineOf(news), summaryOf(news)].filter(Boolean).join("\n"),
    recommendedCharacters: characterForNews(news),
    comicAngle: "部室に速報が入り、3人がニュースの事実だけを材料に研究会を始める。事実を誇張せず、最後は研究部らしいオチにする。",
    priority: 90 + Math.min(9, Math.round(newsScore(news) / 10)),
  } : {
    id: `${date}-boat5`,
    topicType: "boat5",
    badge: "穴・5号艇",
    title: boat5 ? `5号艇1着 ${boat5}を研究！` : "穴決着のヒントを研究！",
    lead: [boat5 && `5号艇1着は${boat5}`, manshu && `万舟は${manshu}`, maxPayout && `最高配当は${maxPayout}`].filter(Boolean).join("。") + "。",
    facts: compactFacts([fact("5号艇1着", boat5), fact("万舟", manshu), fact("万舟率", manshuRate), fact("最高配当", maxPayout)]),
    newsSummary: "",
    recommendedCharacters: ["kiina", "ichika", "hatsune"],
    comicAngle: "キイナが5号艇と穴決着を研究テーマに持ち込み、一果と初音が数字を確認しながらツッコむ。",
    priority: 88,
  };

  const research = {
    id: `${date}-research`,
    topicType: "research",
    badge: "研究・検証",
    title: escape ? `逃げ ${escape}を研究！` : "昨日の決まり手を研究！",
    lead: [held && `対象は${held}`, escape && `逃げは${escape}`, boat1 && `1号艇1着は${boat1}`].filter(Boolean).join("。") + "。",
    facts: compactFacts([fact("開催", held), fact("逃げ", escape), fact("1号艇1着", boat1), fact("5号艇1着", boat5)]),
    newsSummary: "",
    recommendedCharacters: ["ichika", "hatsune", "kiina"],
    comicAngle: "一果の研究発表として始まり、初音が独特な視点を出し、キイナが穴目線で反応する。数字から言える範囲だけでまとめる。",
    priority: 86,
  };

  return [highPayout, newsCandidate, research];
}
