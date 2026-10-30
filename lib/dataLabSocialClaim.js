// DATA LAB の手動生成（管理画面のボタン）の排他。
// bs_data_lab_social_outputs は race_date が一意なので、その行を「生成中」にできた要求だけが生成する。
// 行が無い日は一意制約つきの INSERT（ON CONFLICT DO NOTHING）、行がある日は条件付き UPDATE で取る。
// どちらも DB が1件だけ成功させるため、同時に届いた要求でも生成は1回になる。

export const DATA_LAB_TABLE = "bs_data_lab_social_outputs";
export const GENERATING_STATUS = "generating";
export const COOLDOWN_MS = 60 * 1000; // 直前に生成・着手した下書きは作り直さない
export const STALE_MS = 5 * 60 * 1000; // 生成中のまま残った行（処理落ち）は5分で取り直せる

function iso(ms) {
  return new Date(ms).toISOString();
}

// 戻り値：{ ok: true, id, created, hadContent } または { ok: false, reason: "locked" | "recent" | "busy" | "error", message }
export async function claimDataLabGeneration(client, date, { now = Date.now() } = {}) {
  const at = iso(now);
  const { data: current, error: readError } = await client
    .from(DATA_LAB_TABLE)
    .select("id,status,updated_at,x_post_text")
    .eq("race_date", date)
    .maybeSingle();
  if (readError) return { ok: false, reason: "error", message: readError.message };

  if (!current) {
    const { data, error } = await client
      .from(DATA_LAB_TABLE)
      .upsert({ race_date: date, status: GENERATING_STATUS, generated_at: at, updated_at: at }, { onConflict: "race_date", ignoreDuplicates: true })
      .select("id");
    if (error) return { ok: false, reason: "error", message: error.message };
    if (data?.length) return { ok: true, id: data[0].id, created: true, hadContent: false };
    return { ok: false, reason: "busy" }; // 同時に別の要求が先に行を作った
  }

  if (current.status !== "draft" && current.status !== GENERATING_STATUS) return { ok: false, reason: "locked" };
  const updatedAt = new Date(current.updated_at).getTime();
  if (current.status === "draft" && now - updatedAt < COOLDOWN_MS) return { ok: false, reason: "recent" };
  if (current.status === GENERATING_STATUS && now - updatedAt < STALE_MS) return { ok: false, reason: "busy" };

  const { data, error } = await client
    .from(DATA_LAB_TABLE)
    .update({ status: GENERATING_STATUS, updated_at: at })
    .eq("race_date", date)
    .or(`and(status.eq.draft,updated_at.lt.${iso(now - COOLDOWN_MS)}),and(status.eq.${GENERATING_STATUS},updated_at.lt.${iso(now - STALE_MS)})`)
    .select("id");
  if (error) return { ok: false, reason: "error", message: error.message };
  if (data?.length) return { ok: true, id: data[0].id, created: false, hadContent: Boolean(current.x_post_text) };
  return { ok: false, reason: "busy" }; // 読んだ後に別の要求が先に取った
}

// 生成に失敗したときの後始末。成功時は生成処理の upsert が status を draft に戻すので呼ばない。
// 自分が取った「生成中」の行だけを対象にする（id と status の両方で絞る）。
export async function releaseDataLabClaim(client, claim) {
  if (!claim?.ok) return;
  // 中身のある行は下書きに戻し、中身の無い行（今回または処理落ちした回が作った仮の行）は消す
  const query = claim.hadContent
    ? client.from(DATA_LAB_TABLE).update({ status: "draft" })
    : client.from(DATA_LAB_TABLE).delete();
  await query.eq("id", claim.id).eq("status", GENERATING_STATUS);
}
