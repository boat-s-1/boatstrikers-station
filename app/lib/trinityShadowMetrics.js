export function summarizeShadow(rows) {
  const ordered = [...rows].sort((a, b) => a.generated_at.localeCompare(b.generated_at) ||
    a.race_date.localeCompare(b.race_date) || a.course_code - b.course_code || a.race_no - b.race_no);
  const bought = ordered.filter(r => r.recommendation === 'BUY');
  const settled = ordered.filter(r => r.trinity_prediction_results);
  const settledBought = settled.filter(r => r.recommendation === 'BUY');
  const investment = settledBought.reduce((n, r) => n + r.investment_yen, 0);
  const payout = settledBought.reduce((n, r) => n + r.trinity_prediction_results.payout_yen, 0);
  const hits = settledBought.filter(r => r.trinity_prediction_results.hit).length;
  let losing = 0;
  let maxLosing = 0;
  for (const r of settledBought) {
    losing = r.trinity_prediction_results.hit ? 0 : losing + 1;
    maxLosing = Math.max(maxLosing, losing);
  }
  const highest = [...settledBought].filter(r => r.trinity_prediction_results.hit)
    .sort((a, b) => b.trinity_prediction_results.payout_yen - a.trinity_prediction_results.payout_yen);
  const without = n => {
    const excluded = new Set(highest.slice(0, n).map(r => r.prediction_id));
    const remaining = settledBought.filter(r => !excluded.has(r.prediction_id));
    const invested = remaining.reduce((sum, r) => sum + r.investment_yen, 0);
    return invested ? 100 * remaining.reduce((sum, r) => sum + r.trinity_prediction_results.payout_yen, 0) / invested : null;
  };
  return {
    races: ordered.length, settled_races: settled.length, bought_races: bought.length,
    settled_bought_races: settledBought.length,
    pass_rate: ordered.length ? 100 * (ordered.length - bought.length) / ordered.length : null,
    tickets: settledBought.reduce((n, r) => n + r.ticket_count, 0),
    investment, payout, profit: payout - investment, hits,
    hit_rate: settledBought.length ? 100 * hits / settledBought.length : null,
    roi: investment ? 100 * payout / investment : null,
    avg_tickets: settledBought.length ? settledBought.reduce((n, r) => n + r.ticket_count, 0) / settledBought.length : null,
    max_losing_streak: maxLosing,
    top1_excluded_roi: without(1), top3_excluded_roi: without(3), top5_excluded_roi: without(5),
  };
}
