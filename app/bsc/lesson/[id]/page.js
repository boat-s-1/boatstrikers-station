import LessonClient from "./LessonClient";

const lessons = {
  1: {
    id: 1,
    title: "競艇ってどんな競技？",
    character: "🌸 一果",
    text: "競艇は、6艇のボートが水面を走って順位を競うレースです。基本は1号艇〜6号艇までの6人で走ります。まずは『6艇で走る競技』ということを覚えましょう。",
    badge: "競艇入門",
    questions: [
      {
        question: "競艇は基本的に何艇で走る？",
        choices: ["4艇", "6艇", "8艇"],
        answer: 1,
      },
      {
        question: "競艇で使うのは？",
        choices: ["ボート", "自転車", "馬"],
        answer: 0,
      },
      {
        question: "競艇はどこで行われる？",
        choices: ["水面", "芝生", "道路"],
        answer: 0,
      },
    ],
  },

  2: {
    id: 2,
    title: "6艇で走るってどういうこと？",
    character: "🌸 一果",
    text: "競艇では1号艇から6号艇までが出走します。色も決まっていて、1号艇は白、2号艇は黒、3号艇は赤、4号艇は青、5号艇は黄、6号艇は緑です。",
    badge: "6艇理解",
    questions: [
      {
        question: "1号艇の色は？",
        choices: ["白", "赤", "黄色"],
        answer: 0,
      },
      {
        question: "5号艇の色は？",
        choices: ["青", "黄", "緑"],
        answer: 1,
      },
      {
        question: "6号艇の色は？",
        choices: ["黒", "緑", "白"],
        answer: 1,
      },
    ],
  },

  3: {
    id: 3,
    title: "コースと枠番を学ぼう",
    character: "💜 初音",
    text: "枠番は1〜6号艇の番号です。コースは実際に走る位置のことです。基本は1号艇が内側、6号艇が外側になりやすいですが、進入が変わることもあります。",
    badge: "コース理解",
    questions: [
      {
        question: "一番内側になりやすいのは？",
        choices: ["1号艇", "3号艇", "6号艇"],
        answer: 0,
      },
      {
        question: "コースとは？",
        choices: ["走る位置", "選手の年齢", "配当"],
        answer: 0,
      },
      {
        question: "進入は変わることがある？",
        choices: ["ある", "絶対ない", "天気だけで決まる"],
        answer: 0,
      },
    ],
  },

  4: {
    id: 4,
    title: "1号艇とイン逃げとは？",
    character: "🌸 一果",
    text: "イン逃げとは、1コースの選手が先にターンして、そのまま1着になることです。競艇では1号艇が有利と言われますが、必ず勝つわけではありません。",
    badge: "イン逃げ初級",
    questions: [
      {
        question: "イン逃げとは？",
        choices: ["1コースが逃げて勝つ", "6号艇が勝つ", "全員同着"],
        answer: 0,
      },
      {
        question: "1号艇は必ず勝つ？",
        choices: ["必ず勝つ", "必ず負ける", "勝ちやすいが絶対ではない"],
        answer: 2,
      },
      {
        question: "イン逃げを見る時に大切なのは？",
        choices: ["スタートや展示", "選手の服装", "観客数"],
        answer: 0,
      },
    ],
  },

  5: {
    id: 5,
    title: "スタート展示ってなに？",
    character: "💜 初音",
    text: "展示は、本番前に選手の気配を見る大事な時間です。スタート展示では進入やスタートの雰囲気、周回展示ではターンや足の良さを確認します。",
    badge: "展示入門",
    questions: [
      {
        question: "展示はいつ見る？",
        choices: ["本番前", "レース後", "翌日"],
        answer: 0,
      },
      {
        question: "スタート展示で見るものは？",
        choices: ["進入やスタート", "選手の身長", "天気予報だけ"],
        answer: 0,
      },
      {
        question: "展示は予想に役立つ？",
        choices: ["役立つ", "まったく関係ない", "禁止されている"],
        answer: 0,
      },
    ],
  },
};

export default async function LessonPage({ params }) {
  const resolvedParams = await params;
  const lesson = lessons[resolvedParams.id] || lessons[1];

  return <LessonClient lesson={lesson} />;
}
