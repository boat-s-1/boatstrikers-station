// Pure classification prototype. NOT wired into a production caller.
// The program/schedule identity and six-boat gates must run first.
export function classifyResultLayer(race) {
  if (!race || typeof race !== 'object' || Array.isArray(race)) {
    return { status: 'QUARANTINE', reason: 'RESULT_RACE_INVALID' };
  }
  const result = race.result;
  if (result === undefined || result === null) {
    return { status: 'PENDING', reason: null };
  }
  if (typeof result !== 'object' || Array.isArray(result)) {
    return { status: 'QUARANTINE', reason: 'RESULT_INVALID' };
  }
  const payouts = result.payouts;
  if (payouts !== undefined && payouts !== null &&
      (typeof payouts !== 'object' || Array.isArray(payouts))) {
    return { status: 'QUARANTINE', reason: 'PAYOUTS_INVALID' };
  }
  const kinds = ['trifecta', 'exacta', 'quinella', 'trio'];
  for (const kind of kinds) {
    const collection = payouts?.[kind];
    if (collection === undefined) continue;
    if (!Array.isArray(collection)) {
      return { status: 'QUARANTINE', reason: 'PAYOUT_COLLECTION_INVALID', field: kind };
    }
    if (collection.length > 1) {
      return { status: 'QUARANTINE', reason: 'MULTIPLE_PAYOUTS', field: kind };
    }
    if (collection.length === 1) {
      const p = collection[0];
      if (!p || typeof p !== 'object' || Array.isArray(p)) {
        return { status: 'QUARANTINE', reason: 'PAYOUT_ITEM_INVALID', field: kind };
      }
      const combo = p.combination;
      const amount = p.amount;
      if ((combo === undefined || combo === null || String(combo).trim() === '') !==
          (amount === undefined || amount === null || String(amount).trim() === '')) {
        return { status: 'QUARANTINE', reason: 'INCOMPLETE_PAYOUT', field: kind };
      }
      if (amount !== undefined && amount !== null &&
          !/^[0-9]+$/.test(String(amount))) {
        return { status: 'QUARANTINE', reason: 'PAYOUT_AMOUNT_INVALID', field: kind };
      }
    }
  }
  const finish = result.racers;
  if (finish !== undefined && finish !== null &&
      (typeof finish !== 'object' || Array.isArray(finish))) {
    return { status: 'QUARANTINE', reason: 'FINISH_INVALID' };
  }
  if (finish && Object.values(finish).some(v => !v || typeof v !== 'object' || Array.isArray(v))) {
    return { status: 'QUARANTINE', reason: 'FINISH_BOAT_INVALID' };
  }
  const places = Object.values(finish ?? {}).map(v => String(v.place_number ?? ''));
  if (['1','2','3'].some(p => places.filter(v => v === p).length > 1)) {
    return { status: 'QUARANTINE', reason: 'TIED_FINISH' };
  }
  if (payouts?.trifecta?.[0]?.combination != null &&
      (!finish || Object.keys(finish).length === 0)) {
    return { status: 'QUARANTINE', reason: 'PAYOUT_WITHOUT_FINISH' };
  }
  return { status: 'ACCEPT', reason: null };
}
