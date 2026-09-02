const clean = value => String(value || '')
  .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/[\s\u3000]+/g, ' ').trim();

const metric = label => /半周/.test(label) ? 'halfLap' : /まわり足/.test(label) ? 'turn' : /直線/.test(label) ? 'straight' : null;
const boats = value => [...new Set([...clean(value)].filter(char => /^[1-6]$/.test(char)).map(Number))];

function rankingTable(table) {
  const result = { halfLap: [], turn: [], straight: [] };
  for (const match of String(table || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...match[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(item => item[1]);
    const kind = metric(clean(cells[0]));
    if (!kind) continue;
    cells.slice(1, 4).forEach((cell, index) => {
      const values = boats(cell);
      if (values.length) result[kind].push({ rank: index + 1, boats: values });
    });
  }
  const complete = Object.values(result).every(rows => rows.length > 0 && new Set(rows.flatMap(row => row.boats)).size >= 3);
  return complete ? result : null;
}

export function classifyKiryuExhibition(html) {
  const text = clean(html);
  if (/非開催|次節開催まで|開催はございません/.test(text)) return { classification:'not_published', persistenceAllowed:false, reason:'venue_not_racing' };
  const tables = [...String(html || '').matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(match => match[0]);
  for (const table of tables) {
    const ranking = rankingTable(table);
    if (ranking) return { classification:'rank_only', persistenceAllowed:false, reason:'official_rankings_are_not_measurement_times', rankings:ranking, theoryUse:{ kiinaRankCandidate:true, ichika:false, hatsune:false } };
  }
  if (/半周(?:ラップ)?/.test(text) && /まわり足/.test(text) && /直線/.test(text)) return { classification:'measurement_candidate', persistenceAllowed:false, reason:'live_six_boat_values_and_identity_verification_required' };
  return { classification:'structure_unconfirmed', persistenceAllowed:false, reason:'expected_kiryu_metrics_not_found' };
}
