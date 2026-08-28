import { fetchMarugameVerifiedOriginalTenji } from './marugameVerifiedOriginalTenji.js';

// Incremental rollout: unchanged legacy behavior outside the verified venue.
export async function fetchBestOriginalTenji(race, options = {}) {
  if (Number(race?.courseCode) === 15) {
    const official = await fetchMarugameVerifiedOriginalTenji(race, options);
    // Never fall through to an unverified source after an identity failure.
    return { ...official, sourceKind: 'official', fallbackUsed: false,
      diagnostics: { verifiedOfficial: { ok: official.ok, error: official.error || null, identity: official.identity || null } } };
  }
  const legacy = await import('./originalTenjiSource.js');
  return legacy.fetchBestOriginalTenji(race, options);
}
