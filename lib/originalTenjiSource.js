import { fetchBoatersOriginalTenji } from "./boatersOriginalTenji";
import { fetchOfficialOriginalTenji } from "./officialOriginalTenji";

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

  const official = await fetchOfficialOriginalTenji(race, options);
  if (official.ok) {
    return {
      ...official,
      sourceKind: "official",
      fallbackUsed: true,
      diagnostics: { boaters, official },
    };
  }

  return {
    ok: false,
    rows: [],
    source: null,
    sourceKind: null,
    fallbackUsed: false,
    status: boaters?.status ?? official?.status ?? null,
    reason: boaters?.reason || boaters?.error || official?.error || "detail_not_available",
    error: boaters?.error || official?.error || null,
    diagnostics: { boaters, official },
  };
}
