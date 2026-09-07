import { STADIUMS } from '../../../lib/stadiums';

const BASE_URL = 'https://www.boat-strike.online';

export default function StadiumsDirectoryLayout({ children }) {
  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: '全国24ボートレース場攻略',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: STADIUMS.length,
    itemListElement: STADIUMS.map((stadium, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: `${stadium.name}競艇場`,
      url: `${BASE_URL}/library/stadium/${stadium.slug}`,
    })),
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
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {children}
    </>
  );
}
