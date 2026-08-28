import { fetchMarugameVerifiedOriginalTenji } from './marugameVerifiedOriginalTenji.js';
import { fetchNarutoKaratsu } from './narutoKaratsuVerifiedTenji.js';

// Incremental rollout: unchanged legacy behavior outside the verified venue.
export async function fetchBestOriginalTenji(race, options = {}) {
  if ([14,15,23].includes(Number(race?.courseCode))) {
    const official = await (Number(race.courseCode) === 15 ? fetchMarugameVerifiedOriginalTenji : fetchNarutoKaratsu)(race, options);
    // Never fall through to an unverified source after an identity failure.
    return { ...official, sourceKind: 'official', fallbackUsed: false,
      diagnostics: { verifiedOfficial: { ok: official.ok, error: official.error || null, identity: official.identity || null } } };
  }
  const legacy = await import('./originalTenjiSource.js');
  return legacy.fetchBestOriginalTenji(race, options);
}
