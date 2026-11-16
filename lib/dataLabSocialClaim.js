// One shared lease for manual generation and Cron. No schema or scheduler changes.
export const DATA_LAB_TABLE = 'bs_data_lab_social_outputs';
export const GENERATING_STATUS = 'generating';
export const COOLDOWN_MS = 60_000;
export const STALE_MS = 300_000;
export function validDataLabDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
}
const columns = 'id,race_date,status,updated_at,x_post_text';
export async function claimDataLabGeneration(client, date, { now = Date.now(), allowDraft = false } = {}) {
  if (!validDataLabDate(date)) throw new Error('Invalid race date');
  const { data: row, error } = await client.from(DATA_LAB_TABLE).select(columns).eq('race_date', date).maybeSingle();
  if (error) throw error;
  if (row) {
    if (!['draft', GENERATING_STATUS].includes(row.status)) return { ok: false, reason: 'locked' };
    if (row.status === 'draft' && !allowDraft) return { ok: false, reason: 'exists' };
    const age = now - Date.parse(row.updated_at);
    if (!Number.isFinite(age)) return { ok: false, reason: 'invalid_timestamp' };
    if (age <= (row.status === 'draft' ? COOLDOWN_MS : STALE_MS)) {
      return { ok: false, reason: row.status === 'draft' ? 'recent' : 'busy' };
    }
  }
  const stamp = new Date(now).toISOString();
  const q = row
    ? client.from(DATA_LAB_TABLE).update({ status: GENERATING_STATUS, updated_at: stamp })
      .eq('id', row.id).eq('status', row.status).eq('updated_at', row.updated_at)
    : client.from(DATA_LAB_TABLE).upsert({ race_date: date, status: GENERATING_STATUS,
      generated_at: stamp, updated_at: stamp }, { onConflict: 'race_date', ignoreDuplicates: true });
  const result = await q.select(columns);
  if (result.error) throw result.error;
  if (!result.data?.length) return { ok: false, reason: 'busy' };
  const owned = result.data[0];
  if (!owned.updated_at || (row && owned.updated_at === row.updated_at)) throw new Error('Lease timestamp did not change');
  // Keep the exact DB-returned text, including microseconds. Do not round ownership timestamps.
  return { ok: true, id: owned.id, date, updatedAt: owned.updated_at,
    hadContent: Boolean(row), previousStatus: row?.status ?? null };
}
function owned(client, claim, patch) {
  const q = patch ? client.from(DATA_LAB_TABLE).update(patch) : client.from(DATA_LAB_TABLE).delete();
  return q.eq('id', claim.id).eq('race_date', claim.date)
    .eq('status', GENERATING_STATUS).eq('updated_at', claim.updatedAt);
}
export async function saveDataLabClaim(client, claim, payload) {
  if (!claim?.ok) throw new Error('Missing lease');
  const { data, error } = await owned(client, claim, { ...payload,
    race_date: claim.date, status: 'draft' }).select('*');
  if (error) throw error;
  if (data?.length !== 1) throw new Error('DATA LAB lease lost');
  return data[0];
}
export async function releaseDataLabClaim(client, claim) {
  if (!claim?.ok) return;
  const { data, error } = await owned(client, claim, claim.hadContent
    ? { status: claim.previousStatus === GENERATING_STATUS ? GENERATING_STATUS : 'draft',
        updated_at: new Date().toISOString() } : null).select('id');
  if (error) throw error;
  if (data?.length !== 1) throw new Error('DATA LAB lease cleanup lost');
}
export async function withDataLabClaim(client, date, options, build) {
  const claim = await claimDataLabGeneration(client, date, options);
  if (!claim.ok) return { ok: false, status: 'skipped', reason: claim.reason };
  try { return { ok: true, ...await saveDataLabClaim(client, claim, await build()) }; }
  catch (error) {
    try { await releaseDataLabClaim(client, claim); }
    catch (cleanupError) { throw new AggregateError([error, cleanupError], 'Generation failed; lease cleanup also failed'); }
    throw error;
  }
}
