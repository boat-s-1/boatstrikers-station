import { fetchMarugameVerifiedOriginalTenji } from './marugameVerifiedOriginalTenji.js';
import { fetchNarutoKaratsu } from './narutoKaratsuVerifiedTenji.js';
import { fetchTamagawaVerifiedTenji } from './tamagawaVerifiedTenji.js';
import { fetchTsuOfficialOriginalTenji } from './tsuOfficialOriginalTenji.js';
import { fetchMikuniVerifiedOriginalTenji } from './mikuniVerifiedOriginalTenji.js';
import { fetchAmagasakiOfficialOriginalTenji } from './amagasakiOfficialOriginalTenji.js';
import { fetchTokuyamaVerifiedOriginalTenji } from './tokuyamaVerifiedOriginalTenji.js';

// Incremental rollout: unchanged legacy behavior outside the verified venue.
export async function fetchBestOriginalTenji(race, options = {}) {
  if ([5,9,10,13,14,15,18,23].includes(Number(race?.courseCode))) {
    const fetchers = {
      5: fetchTamagawaVerifiedTenji,
      9: fetchTsuOfficialOriginalTenji,
      10: fetchMikuniVerifiedOriginalTenji,
      13: fetchAmagasakiOfficialOriginalTenji,
      14: fetchNarutoKaratsu,
      15: fetchMarugameVerifiedOriginalTenji,
      18: fetchTokuyamaVerifiedOriginalTenji,
      23: fetchNarutoKaratsu,
    };
    const fetcher = fetchers[Number(race.courseCode)];
    const official = await fetcher(race, options);
    // Never fall through to an unverified source after an identity failure.
    return { ...official, sourceKind: 'official', fallbackUsed: false,
      diagnostics: { verifiedOfficial: { ok: official.ok, error: official.error || null, identity: official.identity || null } } };
  }
  const legacy = await import('./originalTenjiSource.js');
  return legacy.fetchBestOriginalTenji(race, options);
}
