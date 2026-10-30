import { randomUUID } from 'node:crypto';

export async function withGamagoriLease(db, collect) {
  const owner = randomUUID();
  const { data, error } = await db.rpc('bsc_gamagori_acquire_lease', { p_owner: owner });
  if (error) throw new Error('lease_acquire_failed');
  if (data !== true) return { busy: true };
  try {
    return { busy: false, value: await collect() };
  } finally {
    // If release fails, the 120s TTL recovers automatically; never release another owner.
    try {
      const { data: released, error: releaseError } = await db.rpc('bsc_gamagori_release_lease', { p_owner: owner });
      if (releaseError || released !== true) console.error('gamagori_chart_collect', 'lease_release_failed');
    } catch {
      console.error('gamagori_chart_collect', 'lease_release_failed');
    }
  }
}
