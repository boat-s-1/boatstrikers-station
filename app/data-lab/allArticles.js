import { dataLabArticles as baseDataLabArticles } from "./articles";
import { extraDataLabArticles } from "./articles-extra";

export const dataLabArticles = [
  ...baseDataLabArticles,
  ...extraDataLabArticles,
];

export function getDataLabArticle(slug) {
  return dataLabArticles.find((article) => article.slug === slug);
}
