import LessonClient from "./LessonClient";

const lessons = {
  1: {
    id: 1,
    title: "競艇ってどんな競技？",
    badge: "競艇入門",
    characterName: "一果",
    characterImage: "/characters/ichika-talk.png",
    steps: [
      {
        type: "talk",
        text: "BOAT STRIKERSへようこそ♪今日は競艇の基本を一緒に覚えよう！",
      },
      {
        type: "talk",
        text: "まず大事なのは、競艇は6艇で走るレースってことだよ。",
      },
      {
        type: "quiz",
        question: "競艇は基本的に何艇で走る？",
        choices: ["4艇", "6艇", "8艇"],
        answer: 1,
        correct: "正解！競艇は6艇で走るよ✨",
        wrong: "惜しい！競艇は6艇で走るんだよ♪",
      },
      {
        type: "talk",
        text: "次は、競艇がどこで行われるか確認してみよう！",
      },
      {
        type: "quiz",
        question: "競艇はどこで行われる？",
        choices: ["水面", "芝生", "道路"],
        answer: 0,
        correct: "ピンポーン！水面を走るレースだよ🚤",
        wrong: "惜しい！競艇は水面で行われるよ。",
      },
      {
        type: "talk",
        text: "最後の確認だよ♪",
      },
      {
        type: "quiz",
        question: "競艇で使う乗り物は？",
        choices: ["ボート", "自転車", "馬"],
        answer: 0,
        correct: "正解！これで基本はバッチリ♪",
        wrong: "惜しい！競艇はボートで走る競技だよ。",
      },
    ],
  },

  2: {
    id: 2,
    title: "6艇の色を覚えよう",
    badge: "6艇理解",
    characterName: "一果",
    characterImage: "/characters/ichika-talk.png",
    steps: [
      {
        type: "talk",
        text: "競艇には1号艇から6号艇まであって、それぞれ色が決まっているよ♪",
      },
      {
        type: "talk",
        text: "1号艇は白、2号艇は黒、3号艇は赤、4号艇は青、5号艇は黄、6号艇は緑だよ！",
      },
      {
        type: "quiz",
        question: "1号艇の色は？",
        choices: ["白", "赤", "黄色"],
        answer: 0,
        correct: "正解！1号艇は白だよ🌸",
        wrong: "惜しい！1号艇は白だよ。",
      },
      {
        type: "quiz",
        question: "5号艇の色は？",
        choices: ["青", "黄", "緑"],
        answer: 1,
        correct: "正解！5号艇は黄色だよ⚡",
        wrong: "惜しい！5号艇は黄色だよ。",
      },
      {
        type: "quiz",
        question: "6号艇の色は？",
        choices: ["黒", "緑", "白"],
        answer: 1,
        correct: "正解！6号艇は緑だよ！",
        wrong: "惜しい！6号艇は緑だよ。",
      },
    ],
  },

  3: {
    id: 3,
    title: "コースと枠番を学ぼう",
    badge: "コース理解",
    characterName: "初音",
    characterImage: "/characters/hatsune-talk.png",
    steps: [
      {
        type: "talk",
        text: "ここでは枠番とコースの違いを覚えましょう♪",
      },
      {
        type: "talk",
        text: "枠番は1号艇〜6号艇の番号、コースは実際に走る位置のことです。",
      },
      {
        type: "quiz",
        question: "コースとは何のこと？",
        choices: ["走る位置", "選手の年齢", "配当"],
        answer: 0,
        correct: "正解です♪ コースは実際に走る位置です。",
        wrong: "惜しいです。コースは走る位置のことです。",
      },
      {
        type: "quiz",
        question: "一番内側になりやすいのは？",
        choices: ["1号艇", "3号艇", "6号艇"],
        answer: 0,
        correct: "正解♪ 1号艇は内側になりやすいです。",
        wrong: "惜しいです。基本は1号艇が内側です。",
      },
      {
        type: "quiz",
        question: "進入は変わることがある？",
        choices: ["ある", "絶対ない", "天気だけで決まる"],
        answer: 0,
        correct: "正解です！進入が変わることもあります。",
        wrong: "惜しいです。進入は変わることがあります。",
      },
    ],
  },
};

export default async function LessonPage({ params }) {
  const resolvedParams = await params;
  const lesson = lessons[resolvedParams.id] || lessons[1];

  return <LessonClient lesson={lesson} />;
}
