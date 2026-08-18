import { seminarMagazines } from "./seminarMagazines";
import { getPublishedSeminarIssue, listPublishedSeminarIssues } from "./seminarMagazineDb";

function isReleased(issue) {
  if (!issue?.date) return true;
  const releaseAt = new Date(issue.date).getTime();
  return Number.isNaN(releaseAt) || releaseAt <= Date.now();
}

export async function getSeminarMagazine(series) {
  const base = seminarMagazines[series];
  const dynamic = await listPublishedSeminarIssues(series);
  const dynamicIds = new Set(dynamic.map((x) => x.id));
  const fallback = (base.issues || []).filter((x) => !dynamicIds.has(x.id) && isReleased(x));
  const issues = [...dynamic, ...fallback];
  return { ...base, hero: issues[0]?.cover || base.hero, issues };
}

export async function getSeminarIssue(series, issueNo) {
  const dynamic = await getPublishedSeminarIssue(series, issueNo);
  if (dynamic) return dynamic;
  const fallback = (seminarMagazines[series]?.issues || []).find((x) => x.id === issueNo) || null;
  return fallback && isReleased(fallback) ? fallback : null;
}
