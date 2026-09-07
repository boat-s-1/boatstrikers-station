import StadiumGuideQuickNav from './StadiumGuideQuickNav';
import StadiumPremiumMemberArea from './StadiumPremiumMemberArea';
import StadiumSeoGuide from './StadiumSeoGuide';
import { resolveStadium } from '../../../../lib/stadiums';
import './unifiedStadiumGuide.css';

const BASE_URL = 'https://www.boat-strike.online';

export async function generateMetadata({ params }) {
  const route = await params;
  const stadium = resolveStadium(route?.place);

  if (!stadium) {
    return {
      title: '24場攻略｜BoatStrikers',
      description: '全国24ボートレース場の場別データと攻略情報を掲載しています。',
    };
  }

  const title = `${stadium.name}競艇場の特徴・水面・風・コース傾向｜BoatStrikers`;
  const description = `${stadium.name}競艇場の特徴を初心者向けに解説。1コース・イン逃げ、コース別傾向、風や水面、進入・展示で確認したいポイントをBoatStrikersの場別データとあわせて紹介します。`;
  const canonical = `/library/stadium/${stadium.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: 'article',
    },
  };
}

// Shared shell for all 24 BoatStrikers stadium strategy pages.
export default async function StadiumGuideLayout({ children, params }) {
  const route = await params;
  const stadium = resolveStadium(route?.place);

  const breadcrumbJsonLd = stadium ? {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'BoatStrikers',
        item: BASE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: '全国24場攻略',
        item: `${BASE_URL}/library/stadiums`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${stadium.name}競艇場`,
        item: `${BASE_URL}/library/stadium/${stadium.slug}`,
      },
    ],
  } : null;

  return (
    <div className="stadiumUnified24">
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
        />
      )}
      <StadiumGuideQuickNav />
      {children}
      <StadiumSeoGuide place={route?.place} />
      <StadiumPremiumMemberArea />
    </div>
  );
}
