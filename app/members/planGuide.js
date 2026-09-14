export const BETA_ACCESS_END_LABEL = "2026年12月31日";

export const MEMBERSHIP_GUIDE = {
  free: {
    key: "free",
    label: "FREE",
    title: "無料会員",
    status: "基本無料",
    description:
      "BoatStrikersの基本会員枠です。会員ログイン、公式LINEとの会員ID連携、無料コンテンツや基本機能を利用できます。",
    benefits: ["会員ログイン", "公式LINE会員ID連携", "無料コンテンツ・基本機能"],
  },
  beta_premium: {
    key: "beta_premium",
    label: "β PREMIUM",
    title: "β PREMIUM",
    status: `${BETA_ACCESS_END_LABEL}まで`,
    description:
      `現在のβ期間中は、有効な会員にPREMIUM相当機能を無料開放しています。${BETA_ACCESS_END_LABEL}までは追加料金なしで利用できます。`,
    benefits: ["FREEのすべて", "Discordリアルタイム通知", "会員向け場別Premiumデータ"],
    current: true,
  },
  premium: {
    key: "premium",
    label: "PREMIUM",
    title: "PREMIUM",
    status: "正式提供予定",
    description:
      "β期間終了後に正式提供を予定している有料上位プランです。料金・開始時期は決定後に案内します。",
    benefits: ["FREEのすべて", "Discordリアルタイム通知", "会員向け場別Premiumデータ", "上位機能は順次追加予定"],
  },
};

export const MEMBERSHIP_GUIDE_ORDER = ["free", "beta_premium", "premium"];

export const CURRENT_BETA_MESSAGE =
  `現在は無料会員登録するとβ PREMIUMとして案内し、${BETA_ACCESS_END_LABEL}までPREMIUM相当機能を無料開放しています。`;

export function publicPlanLabel(plan){
  if(plan === "premium") return MEMBERSHIP_GUIDE.premium.label;
  if(plan === "beta_premium" || plan === "plus") return MEMBERSHIP_GUIDE.beta_premium.label;
  return MEMBERSHIP_GUIDE.free.label;
}
