import { fetchBoatersOriginalTenji } from "./boatersOriginalTenji";
import { fetchOfficialOriginalTenji } from "./officialOriginalTenji";
import { fetchTsuOfficialOriginalTenji } from "./tsuOfficialOriginalTenji";
import { fetchAmagasakiOfficialOriginalTenji } from "./amagasakiOfficialOriginalTenji";

export async function fetchBestOriginalTenji(race, options = {}) {
  const boaters = await fetchBoatersOriginalTenji(race, options);
  if (boaters.ok) {
    return {
      ...boaters,
      source: "boaters_realtime",
      sourceKind: "boaters",
      fallbackUsed: false,
      diagnostics: { boaters },
    };
  }

  let tsu = null;
  if (Number(race?.courseCode) === 9) {
    tsu = await fetchTsuOfficialOriginalTenji(race, options);
    if (tsu.ok) {
      return {
        ...tsu,
        sourceKind: "official",
        fallbackUsed: true,
        diagnostics: { boaters, tsu },
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
        fallbackUsed: true,
        diagnostics: { boaters, tsu, amagasaki },
      };
    }
  }

  const official = await fetchOfficialOriginalTenji(race, options);
  if (official.ok) {
    return {
      ...official,
      sourceKind: "official",
      fallbackUsed: true,
      diagnostics: { boaters, tsu, amagasaki, official },
    };
  }

  return {
    ok: false,
    rows: [],
    source: null,
    sourceKind: null,
    fallbackUsed: false,
    status: boaters?.status ?? tsu?.status ?? amagasaki?.status ?? official?.status ?? null,
    reason: boaters?.reason || boaters?.error || tsu?.error || amagasaki?.error || official?.error || "detail_not_available",
    error: boaters?.error || tsu?.error || amagasaki?.error || official?.error || null,
    diagnostics: { boaters, tsu, amagasaki, official },
  };
}
