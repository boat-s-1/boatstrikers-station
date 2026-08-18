import { seminarMagazines } from "./seminarMagazines";
import { getPublishedSeminarIssue, listPublishedSeminarIssues } from "./seminarMagazineDb";

export async function getSeminarMagazine(series) {
  const base = seminarMagazines[series];
  const dynamic = await listPublishedSeminarIssues(series);
  if (!dynamic.length) return base;
  const dynamicIds = new Set(dynamic.map((x) => x.id));
  const fallback = (base.issues || []).filter((x) => !dynamicIds.has(x.id));
  return { ...base, hero: dynamic[0]?.cover || base.hero, issues: [...dynamic, ...fallback] };
}

export async function getSeminarIssue(series, issueNo) {
  const dynamic = await getPublishedSeminarIssue(series, issueNo);
  if (dynamic) return dynamic;
  return (seminarMagazines[series]?.issues || []).find((x) => x.id === issueNo) || null;
}
