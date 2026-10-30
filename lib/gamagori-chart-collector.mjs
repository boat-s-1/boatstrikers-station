// Dependencies are injected so tests never contact the official site or production DB.
export async function collectCharts({ db, parse, date, first, limit = 3,
  fetcher = fetch, sleep = ms => new Promise(r => setTimeout(r, ms)), now = Date.now }) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 3 || !Number.isInteger(first) || first < 1 || first > 12) {
    throw new Error('invalid_batch');
  }
  const deadline = now() + 50000;
  const end = Math.min(12, first + limit - 1);
  const { data: events, error } = await db.from('bs_race_events').select('race_no')
    .eq('race_date', date).eq('course_code', 7).gte('race_no', first).lte('race_no', end);
  if (error) throw new Error('event_lookup_failed');
  const valid = new Set((events || []).map(e => Number(e.race_no)));
  const results = [];
  let lastFetch = -Infinity;
  for (let race = first; race <= end; race++) {
    if (now() > deadline - 6000) { results.push({ race, status: 'failed', reason: 'time_budget_exhausted' }); break; }
    if (!valid.has(race)) { results.push({ race, status: 'skipped_no_event' }); continue; }
    const { data: existing, error: readError } = await db.from('bsc_gamagori_chart_ratings')
      .select('boat_no').eq('race_date', date).eq('race_no', race);
    if (readError) throw new Error('existing_lookup_failed');
    if (existing?.length) {
      const complete = existing.length === 6 && new Set(existing.map(x => x.boat_no)).size === 6;
      results.push({ race, status: complete ? 'skipped_existing' : 'blocked_partial_existing' });
      continue;
    }
    const source = `https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/recomend${date.replaceAll('-', '')}07${String(race).padStart(2, '0')}.htm`;
    let html;
    let failure = 'upstream_unavailable';
    let stop = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      const pause = Math.max(0, 1500 - (now() - lastFetch));
      if (now() + pause + 8000 > deadline) { failure = 'time_budget_exhausted'; stop = true; break; }
      if (pause) await sleep(pause);
      lastFetch = now();
      try {
        const response = await fetcher(source, { signal: AbortSignal.timeout(8000), cache: 'no-store',
          headers: { 'User-Agent': 'BoatStrikers chart research collector (contact via boat-strike.online)' } });
        if (!response.ok) {
          await response.body?.cancel();
          failure = `upstream_http_${response.status}`;
          if ([403, 429].includes(response.status)) { stop = true; break; }
          if (response.status < 500) break;
          continue;
        }
        // Bound the stream before decoding, not after allocating an unlimited body.
        const reader = response.body.getReader();
        const chunks = []; let bytes = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > 400000) { await reader.cancel(); throw new Error('document_too_large'); }
          chunks.push(value);
        }
        html = new TextDecoder().decode(Buffer.concat(chunks));
        break;
      } catch (e) {
        failure = e.message === 'document_too_large' ? 'document_too_large' : 'upstream_timeout_or_network';
        if (failure === 'document_too_large') break;
      }
    }
    if (html === undefined) {
      results.push({ race, status: 'failed', reason: failure });
      if (stop) break;
      continue;
    }
    let marks;
    try { marks = parse(html); } catch {
      results.push({ race, status: 'failed', reason: 'invalid_chart' }); continue;
    }
    const { data: inserted, error: insertError } = await db.from('bsc_gamagori_chart_ratings')
      .upsert(marks.map(mark => ({ race_date: date, race_no: race, ...mark, source_url: source })),
        { onConflict: 'race_date,race_no,boat_no', ignoreDuplicates: true }).select('boat_no');
    // A single INSERT statement saves all six atomically. Never update existing rows.
    results.push(insertError ? { race, status: 'failed', reason: 'database_insert_failed' } :
      { race, status: inserted?.length === 6 ? 'saved' : 'concurrent_existing', inserted: inserted?.length ?? 0 });
  }
  // Retry failed/blocked races explicitly; nextRace is only the next window, not a success checkpoint.
  return { date, results, nextRace: results.length < end - first + 1 ? first + results.length : end < 12 ? end + 1 : null };
}
