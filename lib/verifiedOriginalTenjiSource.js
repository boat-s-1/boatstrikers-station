import { fetchMarugameVerifiedOriginalTenji } from './marugameVerifiedOriginalTenji.js';
import { fetchNarutoKaratsu } from './narutoKaratsuVerifiedTenji.js';
import { fetchTamagawaVerifiedTenji } from './tamagawaVerifiedTenji.js';

// Incremental rollout: unchanged legacy behavior outside the verified venue.
export async function fetchBestOriginalTenji(race, options = {}) {
  if ([5,14,15,23].includes(Number(race?.courseCode))) {
    const fetcher = Number(race.courseCode) === 5 ? fetchTamagawaVerifiedTenji : Number(race.courseCode) === 15 ? fetchMarugameVerifiedOriginalTenji : fetchNarutoKaratsu;
    const official = await fetcher(race, options);
    // Never fall through to an unverified source after an identity failure.
    return { ...official, sourceKind: 'official', fallbackUsed: false,
      diagnostics: { verifiedOfficial: { ok: official.ok, error: official.error || null, identity: official.identity || null } } };
  }
  const legacy = await import('./originalTenjiSource.js');
  return legacy.fetchBestOriginalTenji(race, options);
}
