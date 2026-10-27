// 管理者 API の入力チェック（Next.js に依存しない部分。単体テストから直接読み込める）

function expectedOrigins(request) {
  const url = new URL(request.url);
  const origins = new Set([url.origin]);
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  if (host) origins.add(`${proto}://${host}`);
  return origins;
}

// CSRF 対策：書き込み要求が同じサイトの画面から来たことを確かめる。
// 1. Origin があれば、自サイトと一致すること（ブラウザは fetch の POST に必ず付ける）
// 2. Origin が無ければ Sec-Fetch-Site が same-origin であること
// 3. どちらも無ければ Referer が自サイトであること
// 4. いずれも無い要求（ブラウザ以外）は拒否する。/api/admin の書き込みを呼ぶ自動処理は無い
export function checkSameOrigin(request) {
  const origins = expectedOrigins(request);
  const origin = request.headers.get("origin");
  if (origin) return origins.has(origin) ? { ok: true, via: "origin" } : { ok: false, reason: "origin_mismatch" };
  const site = request.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" ? { ok: true, via: "sec-fetch-site" } : { ok: false, reason: "cross_site" };
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return origins.has(new URL(referer).origin) ? { ok: true, via: "referer" } : { ok: false, reason: "referer_mismatch" };
    } catch {
      return { ok: false, reason: "referer_invalid" };
    }
  }
  return { ok: false, reason: "origin_missing" };
}

export function jstToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftDate(ymd, days) {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// YYYY-MM-DD の実在する日付で、JST の今日から [-daysBack, +daysAhead] の範囲にあること
export function validDateInRange(value, { daysBack, daysAhead = 0, now = new Date() }) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return false;
  const today = jstToday(now);
  return value >= shiftDate(today, -daysBack) && value <= shiftDate(today, daysAhead);
}

export function intInRange(value, min, max) {
  return Number.isInteger(value) && value >= min && value <= max;
}

// アラート一覧（GET）の date（YYYY-MM-DD の実在日付）と mode（day / all）の確認。過去の日付も見られるよう範囲は限定しない
export function validAlertQuery(date, mode) {
  if (mode !== "day" && mode !== "all") return false;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}
