"use client";

import { useMemo, useState } from "react";

function statsMap(payload) {
  const map = {};
  const stats = Array.isArray(payload?.stats) ? payload.stats : [];
  stats.forEach((s) => {
    map[String(s.label || "")] = String(s.value || "");
  });
  return map;
}

function rankingLines(payload) {
  const ranking = Array.isArray(payload?.venue_manshu_ranking) ? payload.venue_manshu_ranking : [];
  if (!ranking.length) return "該当データなし";
  return ranking.slice(0, 5).map((r, i) => `${i + 1}. ${r.venue || ""} ${r.count || 0}本`).join("\n");
}

function topText(payload) {
  const top = payload?.max_payout;
  if (!top) return "該当データなし";
  return `${top.venue || ""}${top.race_no || ""}R ${top.trifecta || ""} / ${Number(top.payout || 0).toLocaleString("ja-JP")}円`;
}

function clean(value) {
  return value === null || value === undefined || value === "" ? "該当データなし" : String(value);
}

const selectStyle = { width: "100%", padding: 12, borderRadius: 10 };
const labelStyle = { display: "grid", gap: 7 };
const labelTextStyle = { fontSize: 13, opacity: 0.75 };

export default function MinamoComicPromptBuilder({ payload }) {
  const [mode, setMode] = useState("balanced");
  const [comicType, setComicType] = useState("daily");
  const [topic, setTopic] = useState("auto");
  const [protagonist, setProtagonist] = useState("all");
  const [punchline, setPunchline] = useState("character");
  const [audience, setAudience] = useState("general");
  const [dailyIdea, setDailyIdea] = useState("");
  const [news, setNews] = useState("");
  const [copied, setCopied] = useState(false);

  const prompt = useMemo(() => {
    const s = statsMap(payload);
    const date = payload?.date || "";

    const selectedMode = {
      fact: "ファクト重視。実データ・入力済みの確認済み事実を中心に構成し、事実関係を最優先する。",
      joke: "ネタ重視。実在データがなくても、ボートレースあるある・舟券あるある・学園の日常・キャラの掛け合いを自由に創作する。",
      balanced: "バランス型。入力された事実は厳密に守りつつ、日常ネタ・あるある・キャラの掛け合いを強める。",
    }[mode];

    const selectedComicType = {
      news: "ニュース・時事4コマ",
      result: "レース結果・データ4コマ",
      research: "研究・検証4コマ",
      daily: "ボートレース×学園日常4コマ",
      aruaru: "ボートレース・舟券あるある4コマ",
      beginner: "初心者向け4コマ",
      character: "キャラクター掛け合い4コマ",
    }[comicType];

    const selectedTopic = {
      auto: "AIが今回の入力から最も4コマ向きの話題を1つ選ぶ",
      payout: "高配当・万舟を主役にする",
      escape: "イン逃げ・1号艇を主役にする",
      boat5: "5号艇・穴狙いを主役にする",
      women: "女子戦・初音らしい視点を主役にする",
      ticket: "舟券を買う時の心理・迷い・あるあるを主役にする",
      deadline: "締切前のバタバタ・迷いを主役にする",
      exhibition: "展示を見た後に気持ちが揺れるあるあるを主役にする",
      school: "学園・部室の日常にボートレース要素を掛け合わせる",
      news: "入力された時事ネタ・ニュースを主役にする",
      research: "研究部らしいデータ検証を主役にする",
    }[topic] || "AIが今回の入力から最も4コマ向きの話題を1つ選ぶ";

    const selectedProtagonist = {
      all: "一果・初音・キイナの3人をバランスよく使う",
      ichika: "一果を主役にする",
      hatsune: "初音を主役にする",
      kiina: "キイナを主役にする",
    }[protagonist];

    const selectedPunchline = {
      character: "キャラ性が出るオチ",
      relatable: "読者が『あるある』と思える共感オチ",
      tsukkomi: "テンポのよいツッコミオチ",
      mismatch: "3人の考えが微妙に噛み合わないすれ違いオチ",
      warm: "かわいく、ほっこりするオチ",
      research: "最後に研究部らしい一言で締めるオチ",
    }[punchline];

    const selectedAudience = {
      beginner: "初心者にも意味が通じるよう専門用語をかみ砕く",
      general: "ボートレースを少し知っているSNSユーザー向け",
      core: "ボートレースファン向け。あるある感を強める",
    }[audience];

    const factData = `日付：${date}\n開催：${clean(s["開催"] || s["開催数"])}\n万舟：${clean(s["万舟"])}\n万舟率：${clean(s["万舟率"])}\n1号艇1着：${clean(s["1号艇1着"] || s["1号艇1着数"])}\n5号艇1着：${clean(s["5号艇1着"] || s["5号艇1着数"])}\n逃げ：${clean(s["逃げ"])}\n最高配当：${topText(payload)}\n万舟が多かった場TOP5：\n${rankingLines(payload)}\n事故・異常者：${clean(payload?.incident_races)}R\n優勝戦・DR：${clean(payload?.featured_races)}R`;

    return `あなたはBoatStrikersの学園4コマシリーズ「私立みなも学園〜ふなけん研究部〜」の専属脚本家・編集者・画像生成プロンプト担当です。\n\nこの作品は、ボートレースのニュースや実データだけでなく、ボートレースあるある、舟券あるある、学園の日常、初心者の疑問、キャラクター同士の掛け合いを、楽しく読みやすい4コマ漫画にするシリーズです。\n\n【今回の生成モード】\n${selectedMode}\n\n【漫画タイプ】\n${selectedComicType}\n\n【今回のテーマ方針】\n${selectedTopic}\n\n【主役】\n${selectedProtagonist}\n\n【オチ】\n${selectedPunchline}\n\n【読者レベル】\n${selectedAudience}\n\n【最重要ルール】\n・実在の開催場、日付、レース番号、艇番、選手名、着順、出目、配当、ST、展示タイム、事故内容、勝率、記録などを使う場合は、下記の実データまたは入力された確認済み情報だけを使用する\n・入力されていない実在情報を、知識・推測・類似例から補完しない\n・入力された数字は桁、単位、小数点、順位、艇番を変更せず完全一致させる\n・ネタモードでは、実データを使わない日常会話、リアクション、学園演出、ボケ、ツッコミ、あるある、オチは自由に創作してよい\n・ネタのために架空の具体的な選手名、開催場、レース番号、配当、事故情報を作らない\n・『インなら絶対』『5が必ず来る』など、予想を事実のように断定しない\n・セリフはスマホで読みやすい短さにし、1つの吹き出しへ説明を詰め込みすぎない\n\n【シリーズ名】\n私立みなも学園〜ふなけん研究部〜\n\n【舞台設定】\nみなも学園の「ふなけん研究部」。ボートレースをデータや日々のあるあるから研究する学園部活もの。\n部室、教室、廊下、掲示板前、放課後、購買、テスト勉強など普通の学園生活に、ボートレース的な考え方や言葉を自然に掛け合わせてよい。\nホワイトボード、モニター、競艇場資料、艇番カラーの小物なども必要に応じて使う。\n\n【キャラクター】\n一果：緑系。研究部リーダー。イン逃げを絞るタイプ。落ち着いたまとめ役だが、インへの自信が強い時は少し断言しがち。\n初音：紫系。女子戦オタクの不思議キャラ。普段はふわっとしているが、女子戦や気になるポイントでは急に詳しくなる。独特な視点で核心を突く。\nキイナ：黄色・ゴールド系。5アタマ狙いの穴党。ギャルっぽく元気で少し天然。高配当や穴の気配にテンションが上がり、リアクションは大きめ。\n\n【日常ネタ・あるある入力】\n${dailyIdea.trim() || "指定なし。漫画タイプ・テーマ・キャラ設定から自然なネタを考える。"}\n\n【確認済みの時事ネタ・ニュース補足】\n${news.trim() || "なし"}\n\n【DATA LAB 実データ】\n${factData}\n\n【実データの扱い】\n${mode === "joke" ? "今回はネタ重視。実データは無理に漫画へ入れなくてよい。使う場合だけ正確に引用する。" : mode === "fact" ? "今回はファクト重視。実データまたは確認済みニュースを中心に構成する。" : "実データは使える時だけ自然に使い、日常ネタを邪魔する場合は無理に詰め込まない。"}\n\n【4コマの作り方】\n1コマ目：日常の状況、疑問、あるあるのフリ、ニュース提示など、ひと目で状況が分かる導入。\n2コマ目：キャラクターらしい考え方や行動で話を展開する。\n3コマ目：別キャラのツッコミ、ズレた視点、感情の膨らみ、データの意味などで一段ひねる。\n4コマ目：${selectedPunchline}で短く締める。説明で終わらず、読後に『あるある』『それな』『かわいい』『なるほど』のどれかが残るようにする。\n\n【日常ネタで意識すること】\n・単なるボートレース解説ではなく、学校生活や日常行動とボートレースの感覚を掛け合わせる\n・例：テストの選択肢を舟券のように絞る、席替えで1枠を気にする、購買の行列を進入争いに見立てる、締切前に宿題を出す姿を舟券締切に重ねる、体育祭のスタートに反応する等\n・ただし、毎回同じ『予想が外れた』オチにしない\n・キャラクターの性格そのものがオチになる回も作る\n\n【出力してほしいもの】\n1. 4コマタイトル\n2. モード・漫画タイプ・採用テーマと理由を1行\n3. 1コマ目〜4コマ目の台本\n   ・役割\n   ・場面説明\n   ・登場キャラ\n   ・セリフ\n   ・画面に表示する文字や事実情報\n   ・表情・ポーズ・演出\n4. 使用した事実データ一覧。使っていない場合は「実データ使用なし」と明記\n5. そのまま画像生成AIへ渡せる完成版画像生成プロンプト\n6. X投稿文（140文字程度、ハッシュタグ込み）\n7. ファクトチェック\n   ・入力外の実在情報追加：なし / あり\n   ・数字変更：なし / あり\n   ・未確認情報の断定：なし / あり\n   ・キャラぶれ：なし / あり\n\n【画像生成プロンプトの固定条件】\n・日本語の縦長4コマ漫画\n・明るくポップなアニメ調\n・4つのコマを明確に分ける\n・一果＝緑、初音＝紫、キイナ＝黄色・ゴールドのキャラカラーと役割を維持\n・セリフは短く読みやすくする\n・数字、場名、出目、配当を使う場合は特に読みやすく正確にする\n・入力されていない具体的な数字や固有名詞を背景へ勝手に生成しない\n・下部に小さく「私立みなも学園〜ふなけん研究部〜」「BoatStrikers」\n・ニュース解説だけにせず、3人の掛け合いと学園コメディを作品の中心にする。`;
  }, [payload, mode, comicType, topic, protagonist, punchline, audience, dailyIdea, news]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <section style={{ marginTop: 28, padding: 20, borderRadius: 18, border: "1px solid rgba(255,255,255,.12)", background: "rgba(7,18,38,.72)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, letterSpacing: ".12em", opacity: 0.68 }}>MINAMO ACADEMY COMIC STUDIO</div>
          <h2 style={{ margin: "6px 0 8px" }}>私立みなも学園〜ふなけん研究部〜</h2>
          <p style={{ margin: 0, opacity: 0.78, lineHeight: 1.7 }}>実データ回だけでなく、ボートレースあるある・学園日常・キャラ掛け合いまで同じ画面から4コマ用プロンプトを作れます。</p>
        </div>
        <button type="button" onClick={copyPrompt} style={{ border: 0, borderRadius: 12, padding: "12px 18px", fontWeight: 700, cursor: "pointer" }}>{copied ? "コピーしました" : "プロンプトをコピー"}</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginTop: 18 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>生成モード</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)} style={selectStyle}>
            <option value="fact">ファクト重視</option>
            <option value="balanced">バランス型</option>
            <option value="joke">ネタ重視</option>
          </select>
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>漫画タイプ</span>
          <select value={comicType} onChange={(e) => setComicType(e.target.value)} style={selectStyle}>
            <option value="daily">学園日常</option>
            <option value="aruaru">ボート・舟券あるある</option>
            <option value="character">キャラ掛け合い</option>
            <option value="beginner">初心者向け</option>
            <option value="news">ニュース・時事</option>
            <option value="result">レース結果・データ</option>
            <option value="research">研究・検証</option>
          </select>
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>テーマ</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} style={selectStyle}>
            <option value="auto">自動選択</option>
            <option value="school">学園×ボートの日常</option>
            <option value="ticket">舟券あるある</option>
            <option value="deadline">締切前あるある</option>
            <option value="exhibition">展示で気持ちが揺れる</option>
            <option value="escape">イン逃げ・1号艇</option>
            <option value="boat5">5号艇・穴</option>
            <option value="women">女子戦</option>
            <option value="payout">高配当・万舟</option>
            <option value="news">時事ネタ・ニュース</option>
            <option value="research">研究・検証</option>
          </select>
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>主役</span>
          <select value={protagonist} onChange={(e) => setProtagonist(e.target.value)} style={selectStyle}>
            <option value="all">3人均等</option>
            <option value="ichika">一果</option>
            <option value="hatsune">初音</option>
            <option value="kiina">キイナ</option>
          </select>
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>オチ</span>
          <select value={punchline} onChange={(e) => setPunchline(e.target.value)} style={selectStyle}>
            <option value="character">キャラ性</option>
            <option value="relatable">あるある・共感</option>
            <option value="tsukkomi">ツッコミ</option>
            <option value="mismatch">すれ違い</option>
            <option value="warm">ほっこり</option>
            <option value="research">研究部らしく締める</option>
          </select>
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>読者</span>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} style={selectStyle}>
            <option value="beginner">初心者</option>
            <option value="general">一般SNS向け</option>
            <option value="core">ボートファン向け</option>
          </select>
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginTop: 14 }}>
        <label style={labelStyle}>
          <span style={labelTextStyle}>日常ネタ・あるある（任意）</span>
          <textarea value={dailyIdea} onChange={(e) => setDailyIdea(e.target.value)} placeholder="例：テストで答えを1つに絞れないキイナを、舟券の買い目にたとえて一果がツッコむ" style={{ width: "100%", minHeight: 105, padding: 12, borderRadius: 10, resize: "vertical" }} />
        </label>

        <label style={labelStyle}>
          <span style={labelTextStyle}>確認済みの時事ネタ・ニュース（任意）</span>
          <textarea value={news} onChange={(e) => setNews(e.target.value)} placeholder="実在情報を使う場合だけ入力。確認済みの事実のみ。" style={{ width: "100%", minHeight: 105, padding: 12, borderRadius: 10, resize: "vertical" }} />
        </label>
      </div>

      <div style={{ marginTop: 14, padding: 12, borderRadius: 12, background: "rgba(255,255,255,.05)", fontSize: 13, lineHeight: 1.7, opacity: 0.82 }}>
        <strong>使い分け：</strong> ニュース・実結果は「ファクト重視」、普段の投稿は「ネタ重視」、データを少し混ぜる日常回は「バランス型」がおすすめです。
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 7 }}>生成プロンプト</div>
        <textarea readOnly value={prompt} style={{ width: "100%", minHeight: 620, padding: 14, borderRadius: 12, resize: "vertical", lineHeight: 1.65, fontFamily: "inherit" }} />
      </div>
    </section>
  );
}
