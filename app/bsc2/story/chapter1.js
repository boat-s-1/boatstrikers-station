const chapter1 = {
  id: "chapter1-lesson1",
  area: "beginner",
  title: "Chapter 1",
  subtitle: "競艇の世界へようこそ",
  teacher: "ichika",

  reward: {
    point: 100,
    bond: {
      ichika: 5,
    },
    badge: {
      id: "beginner_chapter1",
      name: "競艇入門認定",
      icon: "🏅",
    },
  },

  steps: [
    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "こんにちは😊\nBOAT STRIKERSへようこそ♪",
      autoNext: true,
      delay: 700,
    },
    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "私は一果！\n今日から一緒に競艇を勉強していこう✨",
      autoNext: true,
      delay: 900,
    },
    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "安心して♪\n最初はみんな初心者だから😊",
      autoNext: true,
      delay: 900,
    },
    {
      type: "talk",
      character: "ichika",
      face: "thinking",
      text: "じゃあまず最初の問題！",
      autoNext: true,
      delay: 700,
    },

    {
      type: "quiz",
      character: "ichika",
      face: "thinking",
      question: "競艇は何艇でレースをする？",
      choices: ["4艇", "6艇", "8艇"],
      answer: 1,
      correctText: "ピンポーン✨\n競艇は6艇で走るよ🚤",
      wrongText: "惜しい😊\n競艇は6艇で競走するんだ♪",
    },

    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "いい感じ♪\nじゃあ次いくよ😊",
      autoNext: true,
      delay: 900,
    },

    {
      type: "quiz",
      character: "ichika",
      face: "thinking",
      question: "競艇はどこで走る？",
      choices: ["水面", "芝生", "道路"],
      answer: 0,
      correctText: "その通り✨\n競艇は水上スポーツなんだ😊",
      wrongText: "惜しい！\n競艇は水面で走るレースだよ♪",
    },

    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "じゃあ少しレベルアップ♪",
      autoNext: true,
      delay: 900,
    },

    {
      type: "quiz",
      character: "ichika",
      face: "thinking",
      question: "競艇は何周する？",
      choices: ["2周", "3周", "4周"],
      answer: 1,
      correctText: "そう！\n競艇は3周して順位を競うよ🚤",
      wrongText: "惜しい😊\n競艇は基本的に3周するよ♪",
    },

    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "覚えておいてね♪\nここから舟券の基本も少しだけ見ていこう😊",
      autoNext: true,
      delay: 1000,
    },

    {
      type: "quiz",
      character: "ichika",
      face: "thinking",
      question: "1着・2着・3着を順番通りに当てる舟券は？",
      choices: ["単勝", "3連単", "ワイド"],
      answer: 1,
      correctText:
        "その通り✨\n3連単は\n1着→2着→3着\n全部順番まで当てる舟券なんだ😊",
      wrongText:
        "惜しい😊\n正解は3連単！\n1着→2着→3着を順番通りに当てる舟券だよ♪",
    },

    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "最後の確認問題だよ✨",
      autoNext: true,
      delay: 900,
    },

    {
      type: "quiz",
      character: "ichika",
      face: "thinking",
      question: "競艇場は全国に何場ある？",
      choices: ["12場", "24場", "48場"],
      answer: 1,
      correctText: "正解😊✨\n全国に24場あるよ♪",
      wrongText: "惜しい！\n競艇場は全国に24場あるよ😊",
    },

    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "すごい！\nこれだけ覚えれば今日から初心者卒業✨",
      autoNext: true,
      delay: 1000,
    },
    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "おめでとう😊✨\nこれで競艇の基本はバッチリ！",
      autoNext: true,
      delay: 1000,
    },
    {
      type: "talk",
      character: "ichika",
      face: "happy",
      text: "次は…\nスタート展示について勉強しよう♪",
      autoNext: true,
      delay: 1000,
    },
    {
      type: "clear",
      character: "ichika",
      face: "happy",
      text: "MISSION CLEAR！\nChapter1 Complete！\n競艇入門認定、GETだよ🏅",
    },
  ],
};

export default chapter1;
