function httpError(status, message) { return Object.assign(new Error(message), { status }); }
export async function blogBody(request) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw httpError(415, "JSON形式で送信してください。");
  const reader = request.body?.getReader();
  if (!reader) throw httpError(400, "入力を確認してください。");
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1000000) { await reader.cancel(); throw httpError(413, "記事データが大きすぎます。"); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  let value;
  try { value = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw httpError(400, "JSONの形式を確認してください。"); }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw httpError(400, "JSONオブジェクトを送信してください。");
  return value;
}

export async function blogResponse(operation) {
  const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
  try { return Response.json(await operation(), { headers }); }
  catch (error) {
    const code = error.code;
    const status = error.status || (code === "40001" ? 409 : code === "P0002" ? 404 : ["22023", "22P02", "23502", "23503", "23505", "23514"].includes(code) ? 400 : 500);
    const message = status === 409 ? "別の保存や公開操作が先に完了しました。未保存の内容を保持して、最新版を確認してください。"
      : error.status ? error.message : status === 404 ? "記事が見つかりません。" : status === 400 ? "記事・画像・公開設定を確認してください。" : "BLOGの処理に失敗しました。";
    return Response.json({ error: message }, { status, headers });
  }
}
