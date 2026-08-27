import { fetchBoatersOriginalTenji } from "./boatersOriginalTenji";
import { fetchOfficialOriginalTenji } from "./officialOriginalTenji";
import { fetchTsuOfficialOriginalTenji } from "./tsuOfficialOriginalTenji";

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

  const official = await fetchOfficialOriginalTenji(race, options);
  if (official.ok) {
    return {
      ...official,
      sourceKind: "official",
      fallbackUsed: true,
      diagnostics: { boaters, tsu, official },
    };
  }

  return {
    ok: false,
    rows: [],
    source: null,
    sourceKind: null,
    fallbackUsed: false,
    status: boaters?.status ?? tsu?.status ?? official?.status ?? null,
    reason: boaters?.reason || boaters?.error || tsu?.error || official?.error || "detail_not_available",
    error: boaters?.error || tsu?.error || official?.error || null,
    diagnostics: { boaters, tsu, official },
  };
}
