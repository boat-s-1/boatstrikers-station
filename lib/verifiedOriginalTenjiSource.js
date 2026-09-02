import { fetchMarugameVerifiedOriginalTenji } from './marugameVerifiedOriginalTenji.js';
import { fetchNarutoKaratsu } from './narutoKaratsuVerifiedTenji.js';
import { fetchTamagawaVerifiedTenji } from './tamagawaVerifiedTenji.js';
import { fetchTsuOfficialOriginalTenji } from './tsuOfficialOriginalTenji.js';
import { fetchMikuniVerifiedOriginalTenji } from './mikuniVerifiedOriginalTenji.js';
import { fetchAmagasakiOfficialOriginalTenji } from './amagasakiOfficialOriginalTenji.js';
import { fetchTokuyamaVerifiedOriginalTenji } from './tokuyamaVerifiedOriginalTenji.js';
import { fetchShimonosekiWakamatsuVerifiedOriginalTenji } from './shimonosekiWakamatsuVerifiedOriginalTenji.js';
import { fetchSuminoeOmuraVerifiedOriginalTenji } from './suminoeOmuraVerifiedOriginalTenji.js';
import { fetchHamanakoAshiyaVerifiedOriginalTenji } from './hamanakoAshiyaVerifiedOriginalTenji.js';
import { fetchFukuokaVerifiedOriginalTenji } from './fukuokaVerifiedOriginalTenji.js';
import { fetchTodaVerifiedOriginalTenji } from './todaVerifiedOriginalTenji.js';

// Incremental rollout: unchanged legacy behavior outside the verified venue.
export async function fetchBestOriginalTenji(race, options = {}) {
  if ([2,5,6,9,10,12,13,14,15,18,19,20,21,22,23,24].includes(Number(race?.courseCode))) {
    const fetchers = {
      2: fetchTodaVerifiedOriginalTenji,
      5: fetchTamagawaVerifiedTenji,
      6: fetchHamanakoAshiyaVerifiedOriginalTenji,
      9: fetchTsuOfficialOriginalTenji,
      10: fetchMikuniVerifiedOriginalTenji,
      12: fetchSuminoeOmuraVerifiedOriginalTenji,
      13: fetchAmagasakiOfficialOriginalTenji,
      14: fetchNarutoKaratsu,
      15: fetchMarugameVerifiedOriginalTenji,
      18: fetchTokuyamaVerifiedOriginalTenji,
      19: fetchShimonosekiWakamatsuVerifiedOriginalTenji,
      20: fetchShimonosekiWakamatsuVerifiedOriginalTenji,
      21: fetchHamanakoAshiyaVerifiedOriginalTenji,
      22: fetchFukuokaVerifiedOriginalTenji,
      23: fetchNarutoKaratsu,
      24: fetchSuminoeOmuraVerifiedOriginalTenji,
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
