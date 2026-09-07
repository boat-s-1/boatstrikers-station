const BASE_URL = 'https://www.boat-strike.online';
const PAGE_URL = `${BASE_URL}/library/stadium/shimonoseki`;

export default function ShimonosekiLayout({ children }) {
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '下関競艇場の特徴・水面・風・コース傾向',
    description: '下関競艇場の水面・風・潮位・コース傾向を、場別データと初心者向け解説で確認できます。',
    mainEntityOfPage: PAGE_URL,
    author: { '@type': 'Organization', name: 'BoatStrikers' },
    publisher: { '@type': 'Organization', name: 'BoatStrikers' },
  };

  const breadcrumbJsonLd = {
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
        name: '下関競艇場',
        item: PAGE_URL,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
