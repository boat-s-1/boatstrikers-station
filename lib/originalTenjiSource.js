import { fetchBoatersOriginalTenji } from "./boatersOriginalTenji";
import { fetchOfficialOriginalTenji } from "./officialOriginalTenji";
import { fetchTsuOfficialOriginalTenji } from "./tsuOfficialOriginalTenji";
import { fetchAmagasakiOfficialOriginalTenji } from "./amagasakiOfficialOriginalTenji";

export async function fetchBestOriginalTenji(race, options = {}) {
  let tsu = null;
  if (Number(race?.courseCode) === 9) {
    tsu = await fetchTsuOfficialOriginalTenji(race, options);
    if (tsu.ok) {
      return {
        ...tsu,
        sourceKind: "official",
        fallbackUsed: false,
        diagnostics: { tsu },
      };
    }
  }

  let amagasaki = null;
  if (Number(race?.courseCode) === 13) {
    amagasaki = await fetchAmagasakiOfficialOriginalTenji(race, options);
    if (amagasaki.ok) {
      return {
        ...amagasaki,
        sourceKind: "official",
        fallbackUsed: false,
        diagnostics: { tsu, amagasaki },
      };
    }
  }

  const official = await fetchOfficialOriginalTenji(race, options);
  if (official.ok) {
    return {
      ...official,
      sourceKind: "official",
      fallbackUsed: false,
      diagnostics: { tsu, amagasaki, official },
    };
  }

  const boaters = await fetchBoatersOriginalTenji(race, options);
  if (boaters.ok) {
    return {
      ...boaters,
      source: "boaters_realtime",
      sourceKind: "boaters",
      fallbackUsed: true,
      diagnostics: { tsu, amagasaki, official, boaters },
    };
  }

  return {
    ok: false,
    rows: [],
    source: null,
    sourceKind: null,
    fallbackUsed: false,
    status: tsu?.status ?? amagasaki?.status ?? official?.status ?? boaters?.status ?? null,
    reason: tsu?.error || amagasaki?.error || official?.error || boaters?.reason || boaters?.error || "detail_not_available",
    error: tsu?.error || amagasaki?.error || official?.error || boaters?.error || null,
    diagnostics: { tsu, amagasaki, official, boaters },
  };
}
