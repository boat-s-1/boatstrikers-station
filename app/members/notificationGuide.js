export const LINE_GUIDE = {
  label: "公式LINE",
  audience: "どなたでも追加OK / 会員ID連携は無料会員以上",
  role: "無料情報・重要なお知らせ・会員ID連携",
  description:
    "今日の注目情報、無料記事、YouTube更新、キャンペーンなどの公式案内を受け取る窓口です。会員はLINEと会員IDを連携できます。",
  note: "PREMIUMのリアルタイム通知はLINEではなくDiscordで配信します。",
  href: "https://lin.ee/Pf3FEEQ",
};

export const DISCORD_GUIDE = {
  label: "Discord",
  audience: "コミュニティ参加 / PREMIUM対象会員はリアルタイム通知を利用可能",
  role: "コミュニティ・PREMIUMリアルタイム通知",
  description:
    "BoatStrikersコミュニティの参加先です。PREMIUM対象会員は、一果・初音・キイナのリアルタイム通知を個別にON/OFFできます。",
  note: "リアルタイム通知を使う場合はBoatStrikers会員としてログイン後、Discord連携が必要です。",
  href: "/members/discord",
};

export const DISCORD_NOTIFICATION_PREFS = [
  { key: "ichika", icon: "🏁", title: "一果通知", description: "隠れイン・イン逃げ急上昇" },
  { key: "hatsune", icon: "🌸", title: "初音通知", description: "女子イン崩れ・箱推し" },
  { key: "kiina", icon: "🚨", title: "キイナ通知", description: "カド攻め理論" },
];
