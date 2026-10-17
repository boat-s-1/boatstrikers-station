import { COPY_POLICY_VERSION } from './copyPolicy.mjs';
const PROTECTED = new Set(['source_title', 'quote', 'statistic']);
const SHORT_FIELDS = new Set(['character_comment', 'callout', 'social_comment', 'template_comment']);
const HARD_PATTERNS = [
  /(?:この予想なら)?(?:必ず|絶対に?)勝てる[!！。]?/u,
  /(?:必ず|絶対に?)(?:当たる|的中する|稼げる|儲かる)[!！。]?/u,
  /高配当を(?:\s|\n)*ぶち抜く(?:よ)?[!！。]?/u,
  /イン逃げ鉄板予想/u,
  /一撃回収[!！。]?/u,
  /負けを取り戻すために(?:追加|もっと|買)/u,
];
export function reviewGeneratedCopy({ text, field, origin = 'unknown' }) {
  const value = String(text ?? '');
  const result = { field, ruleVersion: COPY_POLICY_VERSION, status: 'ok', findings: [] };
  if (PROTECTED.has(origin)) return result;
  for (const pattern of HARD_PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    // A negation/quote is NOT automatically a source declaration. Long/free text
    // is reviewed by the editor rather than rewritten by this narrow checker.
    const hard = origin === 'own_copy' && SHORT_FIELDS.has(field) && value.trim() === match[0];
    result.findings.push({ code: hard ? 'promotional_copy' : 'context_review', match: match[0] });
    result.status = hard ? 'blocked' : 'warning';
  }
  if (origin === 'unknown' && /競艇|高配当|絶対|必勝|稼げる/u.test(value) && !result.findings.length) {
    result.status = 'warning';
    result.findings.push({ code: 'context_review' });
  }
  return result;
}
export function checkedShortCopy(text, { field, fallback }) {
  const review = reviewGeneratedCopy({ text, field, origin: 'own_copy' });
  if (review.status !== 'blocked') return { text: String(text ?? ''), review };
  const safeReview = reviewGeneratedCopy({ text: fallback, field, origin: 'own_copy' });
  if (!fallback || safeReview.status !== 'ok') throw new Error('editorial_copy_review_required');
  return { text: fallback, review: { ...review, fallbackUsed: true } };
}
export function reviewFreeTextFields(fields) {
  return Object.entries(fields).map(([field, text]) => reviewGeneratedCopy({ field, text, origin: 'unknown' }))
    .filter(item => item.status !== 'ok');
}
