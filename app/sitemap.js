import { STADIUMS } from '../lib/stadiums';
import { GUIDE_ARTICLES } from './guide/guideData';
import { dataLabArticles } from './data-lab/allArticles';

const BASE_URL = 'https://www.boat-strike.online';
const CONTENT_UPDATED_AT = new Date('2026-09-12T00:00:00+09:00');

const DEEP_DIVE_GUIDES = [
  'course-entry',
  'racer-class',
  'tilt',
  'flying-late-start',
  'first-turn-mark',
  'course-characteristics',
  'start-exhibition',
  'lap-exhibition',
  'local-win-rate',
  'series-performance',
  'exhibition-time',
  'straight-line-time',
  'motor-change',
  'stabilizer',
  'tide-level',
];

const STATIC_PAGES = [
  ['', 'daily', 1],
  ['/races', 'daily', 1],
  ['/news', 'daily', 0.9],
  ['/results', 'daily', 0.8],
  ['/schedule', 'weekly', 0.7],
  ['/guide', 'weekly', 0.9],
  ['/data-lab', 'weekly', 0.9],
  ['/library', 'weekly', 0.8],
  ['/library/free', 'weekly', 0.6],
  ['/library/ichika-seminar', 'weekly', 0.7],
  ['/library/hatsune-seminar', 'weekly', 0.7],
  ['/library/kiina-seminar', 'weekly', 0.7],
  ['/library/stadiums', 'weekly', 0.9],
  ['/ichika', 'daily', 0.8],
  ['/hatsune', 'daily', 0.8],
  ['/kiina', 'daily', 0.8],
  ['/bsc2', 'weekly', 0.6],
  ['/comic', 'weekly', 0.6],
  ['/ichika-sensei', 'weekly', 0.7],
  ['/radio', 'weekly', 0.6],
  ['/about', 'monthly', 0.4],
  ['/contact', 'monthly', 0.3],
  ['/privacy', 'yearly', 0.2],
  ['/terms', 'yearly', 0.2],
  ['/disclaimer', 'yearly', 0.2],
  ['/sitemap', 'monthly', 0.3],
];

export default function sitemap() {
  const staticEntries = STATIC_PAGES.map(([path, changeFrequency, priority]) => ({
    url: `${BASE_URL}${path}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency,
    priority,
  }));

  const beginnerGuideEntries = GUIDE_ARTICLES.map((article) => ({
    url: `${BASE_URL}/guide/${article.slug}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const deepDiveGuideEntries = DEEP_DIVE_GUIDES.map((slug) => ({
    url: `${BASE_URL}/guide/${slug}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const dataLabEntries = dataLabArticles.map((article) => ({
    url: `${BASE_URL}/data-lab/${article.slug}`,
    lastModified: new Date(`${article.updatedAt || article.publishedAt}T00:00:00+09:00`),
    changeFrequency: 'monthly',
    priority: 0.8,
  }));

  const stadiumEntries = STADIUMS.map((stadium) => ({
    url: `${BASE_URL}/library/stadium/${stadium.slug}`,
    lastModified: CONTENT_UPDATED_AT,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  return [
    ...staticEntries,
    ...beginnerGuideEntries,
    ...deepDiveGuideEntries,
    ...dataLabEntries,
    ...stadiumEntries,
  ];
}
