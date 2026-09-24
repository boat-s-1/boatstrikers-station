export const ichikaBookSeries = {
  sensei: {
    key: "ichika-sensei",
    slug: "ichika-sensei",
    name: "教えて！一果センセー",
    shortName: "一果センセー",
    eyebrow: "BOAT RACE BEGINNER BOOKS",
    description: "初心者の『これって何？』を、マンガ風スライドと一果の解説でやさしく学ぶシリーズ。",
    hero: "/ichikabook/A5768AB1-3311-47EB-9883-3C5BFAB585B7.png",
    accent: "ichika",
    collectionLabel: "本の一覧",
    issues: [
      {
        id: "001",
        number: "LESSON 01",
        title: "ボートレースってどんな競技？",
        date: "2026-09-24T10:00:00+09:00",
        cover: "/ichikabook/A5768AB1-3311-47EB-9883-3C5BFAB585B7.png",
        freePages: [
          "/ichikabook/A5768AB1-3311-47EB-9883-3C5BFAB585B7.png"
        ],
        premiumPageCount: 0,
        article: {
          kicker: "一果センセーの詳しい解説",
          lead: "マンガを読んだあとに、ポイントを文章でもう一度確認できるコーナーです。",
          sections: [
            {
              heading: "ボートレースの基本",
              body: "ボートレースは6艇で行われる水上競技です。まずは艇の色やコース、スタートから1マークまでの流れを知ると、レースを見やすくなります。"
            },
            {
              heading: "最初に覚えたい3つ",
              body: "最初から専門用語を全部覚える必要はありません。『6艇で走る』『スタートをそろえる』『1マークの攻防が大きな見どころ』の3点から覚えていきましょう。"
            },
            {
              heading: "一果のチェックポイント",
              body: "次の本では、1号艇とインコースがなぜ注目されるのかを、図やマンガを使って少しずつ解説していきます。"
            }
          ]
        }
      }
    ]
  }
};

export function getIchikaBookSeries(key) {
  return ichikaBookSeries[key] || null;
}

export function getIchikaBookIssue(key, issueId) {
  const series = getIchikaBookSeries(key);
  return series?.issues.find((issue) => issue.id === issueId) || null;
}
