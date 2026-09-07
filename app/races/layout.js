import RacesSeoIntro from './RacesSeoIntro';

export const metadata = {
  title: '本日のボートレース出走表・レース情報｜BoatStrikers',
  description: '今日のボートレース開催場、出走表、締切時刻、選手・モーター・展示情報、AI注目レースをBoatStrikersでまとめて確認できます。',
  alternates: { canonical: '/races' },
  openGraph: {
    title: '本日のボートレース出走表・レース情報｜BoatStrikers',
    description: '今日の開催場・出走表・展示・モーター・AI注目レースをまとめて確認。',
    url: '/races',
    type: 'website',
  },
};

function getJstDateString() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export default function RacesLayout({ children }) {
  const today = getJstDateString();

  return (
    <>
      {children}
      <RacesSeoIntro raceDate={today} />
    </>
  );
}
