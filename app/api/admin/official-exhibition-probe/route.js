// Isolated, read-only investigation endpoint. No database or notification imports.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const homes = [
  'https://www.kiryu-kyotei.com/', 'https://www.boatrace-toda.jp/',
  'https://www.boatrace-edogawa.com/', 'https://www.heiwajima.gr.jp/',
  'https://www.boatrace-tamagawa.com/', 'https://www.boatrace-hamanako.jp/',
  'https://www.gamagori-kyotei.com/', 'https://www.boatrace-tokoname.jp/',
  'https://www.boatrace-tsu.com/', 'https://www.mikuniks-web.jp/races',
  'https://www.boatrace-biwako.jp/', 'https://www.boatrace-suminoe.jp/',
  'https://www.boatrace-amagasaki.jp/', 'https://www.n14.jp/',
  'https://www.marugameboat.jp/', 'https://www.kojimaboat.jp/',
  'https://www.boatrace-miyajima.com/', 'https://www.boatrace-tokuyama.jp/',
  'https://www.boatrace-shimonoseki.jp/', 'https://www.wmb.jp/',
  'https://www.boatrace-ashiya.com/', 'https://www.boatrace-fukuoka.com/',
  'https://www.boatrace-karatsu.jp/', 'https://omurakyotei.jp/',
];
const cache = new Map();
const pending = new Map();
let lastStart = 0;
const clean = (s) => s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();

function source(course, day, race, mode) {
  if (mode === 'reference') return course === 5 ? `https://www.boatrace.jp/owpc/pc/race/beforeinfo?rno=${race}&jcd=05&hd=${day}` : null;
  if (mode === 'ajax') return course === 9 ? `https://www.boatrace-tsu.com/sp/ajax/ajax_yosou.php?targetday=${day}&race=${race}&req=cyokuzen&run=0` : null;
  if (mode === 'sttenji') return course === 9 ? `https://www.boatrace-tsu.com/sp/ajax/ajax_yosou.php?targetday=${day}&race=${race}&req=sttenji&run=0` : null;
  if (mode === 'asset') return course === 9 ? 'https://www.boatrace-tsu.com/sp/page/yosou/js/get_yosou.js' : null;
  if (mode === 'home') return homes[course - 1];
  const rr = String(race).padStart(2, '0');
  const paths = {
    1: `/sp/ajax/ajax_cyokuzen.php?race=${race}`,
    3: `/sp/index.php?page=yosou-race_index&race=${race}`,
    4: `/asp/kyogi/04/sp/yoso05${rr}.htm`,
    5: `/modules/yosou/oriten.php?day=${day}&race=${race}&jo=05&if=1`,
    7: `https://www1.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/recomend${day}07${rr}.htm`,
    9: `/sp/index.php?page=yosou-yosou&race=${race}`,
    10: '/races',
    11: `/sp/index.php?page=yosou-cyokuzen&race=${race}`,
    12: `/asp/kyogi/12/sp/yoso05${rr}.htm`,
    13: `/sp/ajax/ajax_yosou.php?targetday=${day}&race=${race}&req=cyokuzen&run=0`,
    14: `/modules/yosou/group-cyokuzen.php?day=${day}&race=${race}&kind=2&if=1`,
    15: `/asp/kyogi/15/sp/yoso05${rr}.htm`,
    16: `/asp/kyogi/16/sp/yoso05${rr}.htm`,
    // The official HTTPS endpoint redirects to this exact HTTP URL.
    18: `http://www.boatrace-tokuyama.jp/tenji-keisoku/m/?day=${day}&race=${race}`,
    21: `/sp/index.php?page=yosou&race=${race}`,
    22: `/sp/ajax/ajax_cyokuzen.php?race=${race}`,
    23: `/sp/index.php?page=yosou-cyokuzen&race=${race}`,
    24: `/yosou/m/chokuzen.php?day=${day}&race=${race}`,
  };
  return paths[course] ? new URL(paths[course], homes[course - 1]).href : null;
}

async function inspect(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    // Do not follow redirects: no request may escape the fixed source catalog.
    const res = await fetch(url, { redirect: 'manual', cache: 'no-store', signal: controller.signal,
      headers: { 'User-Agent': 'BoatStrikers-ExhibitionDiagnostic/1.0', 'X-Requested-With': 'XMLHttpRequest', Referer: new URL('/', url).href } });
    if (!res.ok) {
      await res.body?.cancel();
      return { ok: false, upstreamStatus: res.status, location: res.headers.get('location') };
    }
    const reader = res.body?.getReader();
    if (!reader) return { ok: false, error: 'empty_body' };
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 1000000) { await reader.cancel(); return { ok: false, error: 'body_too_large' }; }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks);
    const sniff = bytes.subarray(0, 4000).toString('ascii');
    const charset = /(?:shift[_-]?jis|sjis)/i.test(res.headers.get('content-type') + sniff) ? 'shift_jis' : 'utf-8';
    const html = new TextDecoder(charset).decode(bytes);
    const tables = [...html.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map(m => m[0]).filter(t => /展示|一周|1周|半周|まわり足|直線/.test(t));
    const links = [...html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/gi)].map(m => m[1]);
    const snippets = [...html.matchAll(/.{0,160}(?:ajax|cyokuzen|chokuzen|oriten|tenji|オリジナル|まわり足|半周).{0,240}/gi)].slice(0, 60).map(m => m[0]);
    return { ok: true, upstreamStatus: res.status, bytes: size, charset,
      title: clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || ''),
      pageText: clean(html).slice(0, 18000),
      identityMarkup: /^(https:\/\/www\.boatrace\.jp\/owpc\/pc\/race\/beforeinfo\?|http:\/\/www\.boatrace-tokuyama\.jp\/tenji-keisoku\/m\/|https:\/\/www\.boatrace-suminoe\.jp\/asp\/kyogi\/12\/sp\/|https:\/\/omurakyotei\.jp\/yosou\/m\/)/.test(url) ? html.slice(0, 100000) : undefined,
      timingTables: tables.slice(0, 8).map(t => t.slice(0, 20000)),
      links: [...new Set(links)].filter(x => /\.js|yosou|tenji|race|cyokuzen|chokuzen/i.test(x)).slice(0, 100),
      snippets, fetchedAt: new Date().toISOString(),
      warning: 'Inspection only; requested date/race are NOT proof of source freshness or six-boat completeness.' };
  } finally { clearTimeout(timer); }
}

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const course = Number(q.get('course'));
  const race = Number(q.get('race') || '1');
  const date = q.get('date') || new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' });
  const mode = q.get('mode') || 'data';
  const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  if (!Number.isInteger(course) || course < 1 || course > 24 || !Number.isInteger(race) || race < 1 || race > 12 || !/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || !['home', 'data', 'reference', 'ajax', 'sttenji', 'asset'].includes(mode) || [...q.keys()].some(k => !['course', 'race', 'date', 'mode', '_vercel_share', 'x-vercel-protection-bypass', 'x-vercel-set-bypass-cookie'].includes(k))) return reply({ ok: false, error: 'invalid_parameters' }, 400);
  const url = source(course, date.replaceAll('-', ''), race, mode);
  if (!url) return reply({ ok: false, error: 'data_source_not_registered', hint: 'Use mode=home to inspect official links.' }, 422);
  for (const [key, entry] of cache) if (entry.expires < Date.now()) cache.delete(key);
  if (cache.has(url)) return reply({ ...cache.get(url).body, cached: true });
  if (pending.has(url)) return reply(await pending.get(url));
  // Best-effort per-instance throttling; this is not a distributed rate limiter.
  if (Date.now() - lastStart < 1000 || pending.size >= 2) return reply({ ok: false, error: 'retry_later' }, 429);
  lastStart = Date.now();
  const task = inspect(url).catch(e => ({ ok: false, error: e.name === 'AbortError' ? 'upstream_timeout' : 'upstream_fetch_failed' })).then(result => {
    const body = { diagnosticVersion: 1, readOnly: true, sourceUrl: url, requested: { course, race, date }, ...result };
    if (cache.size >= 48) cache.delete(cache.keys().next().value);
    cache.set(url, { body, expires: Date.now() + 60000 });
    return body;
  });
  pending.set(url, task);
  try { return reply(await task); } finally { pending.delete(url); }
}
