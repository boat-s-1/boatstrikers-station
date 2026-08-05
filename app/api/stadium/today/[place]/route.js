import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const STADIUMS = {
  kiryu: { code: 1, name: '桐生' }, toda: { code: 2, name: '戸田' }, edogawa: { code: 3, name: '江戸川' },
  heiwajima: { code: 4, name: '平和島' }, tamagawa: { code: 5, name: '多摩川' }, hamana: { code: 6, name: '浜名湖' },
  gamagori: { code: 7, name: '蒲郡' }, toki: { code: 8, name: '常滑' }, tsu: { code: 9, name: '津' },
  mikuni: { code: 10, name: '三国' }, biwako: { code: 11, name: 'びわこ' }, suminoe: { code: 12, name: '住之江' },
  amagasaki: { code: 13, name: '尼崎' }, naruto: { code: 14, name: '鳴門' }, marugame: { code: 15, name: '丸亀' },
  kojima: { code: 16, name: '児島' }, miyajima: { code: 17, name: '宮島' }, tokuyama: { code: 18, name: '徳山' },
  shimonoseki: { code: 19, name: '下関' }, wakamatsu: { code: 20, name: '若松' }, ashiya: { code: 21, name: '芦屋' },
  fukuoka: { code: 22, name: '福岡' }, karatsu: { code: 23, name: '唐津' }, omura: { code: 24, name: '大村' },
};

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase環境変数が未設定です。');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request, { params }) {
  try {
    const route = await params;
    const stadium = STADIUMS[route.place];
    if (!stadium) return NextResponse.json({ error: '場コードが見つかりません。' }, { status: 404 });
    const db = supabase();
    const requestedDate = new URL(request.url).searchParams.get('date');
    const raceDate = requestedDate || await resolveLatestDate(db, stadium.code);
    if (!raceDate) return NextResponse.json({ stadium, raceDate: null, races: [], generatedAt: new Date().toISOString() });

    const [{ data: eventRows, error: eventError }, { data: entryRows, error: entryError }] = await Promise.all([
      db.from('bs_race_events').select('*').eq('race_date', raceDate).eq('course_code', stadium.code).order('race_no'),
      db.from('bs_race_entries').select('*').eq('race_date', raceDate).eq('course_code', stadium.code).order('race_no').order('boat_no'),
    ]);
    if (eventError) throw eventError;
    if (entryError) throw entryError;

    const eventMap = new Map((eventRows || []).map(row => [Number(row.race_no), row]));
    const groups = new Map();
    for (const row of entryRows || []) {
      const raceNo = Number(row.race_no);
      if (!groups.has(raceNo)) groups.set(raceNo, []);
      groups.get(raceNo).push(row);
    }

    const races = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([raceNo, entries]) => {
      const event = eventMap.get(raceNo) || {};
      return buildRace(raceDate, raceNo, entries, event);
    });

    return NextResponse.json({ stadium, raceDate, races, generatedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    console.error('today stadium api error', error);
    return NextResponse.json({ error: error?.message || '今日のレース取得に失敗しました。' }, { status: 500 });
  }
}

async function resolveLatestDate(db, courseCode) {
  const todayJst = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const { data: todayRows } = await db.from('bs_race_events').select('race_date').eq('course_code', courseCode).eq('race_date', todayJst).limit(1);
  if (todayRows?.length) return todayJst;
  const { data, error } = await db.from('bs_race_events').select('race_date').eq('course_code', courseCode).lte('race_date', todayJst).order('race_date', { ascending: false }).limit(1);
  if (error) throw error;
  return data?.[0]?.race_date || null;
}

function buildRace(raceDate, raceNo, rawEntries, event) {
  const entries = rawEntries.map(normalizeEntry);
  const exhibitionRows = entries.filter(item => Number.isFinite(item.exhibitionTime));
  const hasExhibition = exhibitionRows.length >= 4;
  const times = [...new Set(exhibitionRows.map(item => item.exhibitionTime))].sort((a, b) => a - b);
  const fastest = times[0];
  const second = times[1];
  const gap = fastest != null && second != null ? round(second - fastest, 2) : null;
  const ranked = [...entries].sort((a, b) => compareNullable(a.exhibitionTime, b.exhibitionTime));
  let rank = 0;
  let previous = null;
  ranked.forEach((item, index) => {
    if (!Number.isFinite(item.exhibitionTime)) return;
    if (previous == null || item.exhibitionTime !== previous) rank = index + 1;
    item.exhibitionRank = rank;
    previous = item.exhibitionTime;
  });

  const before = scoreBefore(entries);
  const live = hasExhibition ? scoreLive(entries, before, event, gap) : before;
  entries.forEach(item => { item.liveScore = scoreEntry(item, hasExhibition); });
  const recommended = [...entries].sort((a, b) => (b.liveScore || 0) - (a.liveScore || 0))[0];
  const phase = hasExhibition ? 'live' : entries.length ? 'waiting' : 'pre';
  const wind = normalizeWind(event);
  const reasons = buildReasons(entries, before, live, phase, gap, wind);
  const verdict = live.inside >= 80 ? 'イン有力' : live.inside >= 68 ? 'イン優勢' : live.inside >= 55 ? 'インやや優勢' : live.upset >= 65 ? '穴警戒' : '混戦';

  return {
    raceDate, raceNo, deadline: first(event, ['closing_time', 'deadline', 'shimekiri_yotei_jikoku', 'scheduled_close_time']),
    phase, phaseLabel: phase === 'live' ? '● 直前版' : phase === 'waiting' ? '○ 展示待ち' : '○ 前日版',
    status: 'open', windLabel: wind.label, beforeScores: before, scores: live, verdict,
    recommendedBoat: recommended?.boatNo || null, reasons, sampleCount: null, entries,
  };
}

function normalizeEntry(row) {
  return {
    boatNo: integer(first(row, ['boat_no', 'teiban'])), racerName: first(row, ['racer_name', 'shimei']),
    racerClass: first(row, ['racer_class', 'kyubetsu']), racerRegistrationNo: first(row, ['racer_registration_no', 'toroku_bango']),
    nationalWinRate: number(first(row, ['national_win_rate', 'zenkoku_ritsu_1'])), localWinRate: number(first(row, ['local_win_rate', 'touchi_ritsu_1'])),
    motor2Rate: number(first(row, ['motor_2_rate', 'motor_ritsu_2'])), avgSt: number(first(row, ['avg_st', 'average_st'])),
    exhibitionTime: normalizeExhibition(first(row, ['official_exhibition_time', 'exhibition_time', 'tenji_time'])),
    exhibitionSt: number(first(row, ['official_exhibition_st', 'exhibition_st', 'tenji_st'])), exhibitionCourse: integer(first(row, ['official_exhibition_course', 'exhibition_course', 'tenji_shinnyu_course'])),
    exhibitionRank: null, liveScore: null,
  };
}

function scoreBefore(entries) {
  const one = entries.find(item => item.boatNo === 1) || {};
  const center = entries.filter(item => [3,4].includes(item.boatNo));
  let inside = 54;
  inside += classScore(one.racerClass);
  inside += scale(one.nationalWinRate, 4.0, 8.0, -6, 10);
  inside += scale(one.localWinRate, 3.5, 8.0, -5, 8);
  inside += scale(one.motor2Rate, 20, 55, -5, 7);
  if (Number.isFinite(one.avgSt)) inside += scale(0.19 - one.avgSt, 0, 0.08, -5, 7);
  const centerPower = avg(center.map(item => Number(item.nationalWinRate)).filter(Number.isFinite));
  if (Number.isFinite(centerPower)) inside -= scale(centerPower, 4.5, 7.5, 0, 7);
  inside = clamp(inside);
  const upset = clamp(100 - inside + (centerPower >= 6 ? 7 : 0));
  return { inside, upset, exhibition: 0, wind: 50 };
}

function scoreLive(entries, before, event, gap) {
  const one = entries.find(item => item.boatNo === 1) || {};
  let inside = before.inside;
  let exhibition = 50;
  if (one.exhibitionRank === 1) { inside += 9; exhibition += 22; }
  else if (one.exhibitionRank === 2) { inside += 4; exhibition += 12; }
  else if (one.exhibitionRank >= 4) { inside -= 8; exhibition -= 10; }
  if (gap != null) {
    if (one.exhibitionRank === 1 && gap >= 0.04) { inside += 5; exhibition += 10; }
    if (gap <= 0.01) exhibition -= 5;
  }
  const oneMotorRank = rankDescending(entries, 'motor2Rate', one.boatNo);
  if (oneMotorRank <= 2) inside += 4;
  if (oneMotorRank >= 5) inside -= 4;
  const wind = normalizeWind(event);
  let windScore = 50;
  if (wind.speed >= 4) windScore += 12;
  if (wind.speed >= 6) windScore += 8;
  if (wind.type === 'head') inside -= Math.min(7, wind.speed);
  if (wind.type === 'tail') inside += Math.min(5, wind.speed * 0.8);
  const upset = clamp(100 - inside + (one.exhibitionRank >= 4 ? 10 : 0));
  return { inside: clamp(inside), upset, exhibition: clamp(exhibition), wind: clamp(windScore) };
}

function scoreEntry(item, hasExhibition) {
  let score = 45;
  score += classScore(item.racerClass);
  score += scale(item.nationalWinRate, 4, 8, -5, 12);
  score += scale(item.motor2Rate, 20, 55, -5, 9);
  if (item.boatNo === 1) score += 7;
  if (hasExhibition) {
    if (item.exhibitionRank === 1) score += 15;
    else if (item.exhibitionRank === 2) score += 10;
    else if (item.exhibitionRank === 3) score += 6;
    else if (item.exhibitionRank >= 5) score -= 5;
    if (Number.isFinite(item.exhibitionSt)) score += scale(0.18 - item.exhibitionSt, -0.05, 0.15, -5, 8);
  }
  return clamp(score);
}

function buildReasons(entries, before, live, phase, gap, wind) {
  const one = entries.find(item => item.boatNo === 1) || {};
  const reasons = [];
  if (phase === 'live') {
    if (one.exhibitionRank === 1) reasons.push('1号艇が展示タイム1位');
    else if (one.exhibitionRank) reasons.push(`1号艇の展示タイムは${one.exhibitionRank}位`);
    if (gap != null) reasons.push(`展示1位と次位のタイム差は${gap.toFixed(2)}秒`);
    const motorRank = rankDescending(entries, 'motor2Rate', one.boatNo);
    if (motorRank) reasons.push(`1号艇のモーター2連率はレース内${motorRank}位`);
    if (wind.label) reasons.push(`風条件：${wind.label}`);
    if (live.inside > before.inside) reasons.push(`展示反映でイン信頼度が${live.inside - before.inside}点上昇`);
    if (live.inside < before.inside) reasons.push(`展示反映でイン信頼度が${before.inside - live.inside}点低下`);
  } else {
    reasons.push('1号艇の級別・全国勝率・当地勝率を評価');
    reasons.push('1号艇とセンター艇の選手力を比較');
    reasons.push('モーター2連率と平均STを加味');
  }
  return reasons.slice(0, 6);
}

function normalizeWind(event) {
  const speed = number(first(event, ['wind_speed', 'wind_speed_mps', 'wind_velocity', 'fusoku'])) || 0;
  const direction = String(first(event, ['wind_direction', 'wind_direction_code', 'wind_dir', 'fuko_code']) || '');
  let type = 'other';
  if (['09','10','11','南','南南西','南西'].includes(direction)) type = 'tail';
  if (['01','02','15','16','北','北北東','北西','北北西'].includes(direction)) type = 'head';
  const label = speed ? `${direction || '風向不明'} ${speed}m` : '';
  return { speed, direction, type, label };
}

function first(obj, keys) { for (const key of keys) if (obj?.[key] !== null && obj?.[key] !== undefined && obj?.[key] !== '') return obj[key]; return null; }
function number(value) { if (value == null || value === '') return null; const n = Number(String(value).replace(/[^0-9+-.]/g, '')); return Number.isFinite(n) ? n : null; }
function integer(value) { const n = number(value); return Number.isFinite(n) ? Math.trunc(n) : null; }
function normalizeExhibition(value) { let n = number(value); if (!Number.isFinite(n)) return null; while (n > 20) n /= 10; return round(n, 2); }
function round(value, digits = 0) { const p = 10 ** digits; return Math.round(value * p) / p; }
function clamp(value) { return Math.max(0, Math.min(100, Math.round(Number(value || 0)))); }
function scale(value, min, max, outMin, outMax) { if (!Number.isFinite(value)) return 0; const ratio = Math.max(0, Math.min(1, (value - min) / (max - min))); return outMin + ratio * (outMax - outMin); }
function classScore(value) { const text = String(value || '').toUpperCase(); return text === 'A1' ? 10 : text === 'A2' ? 5 : text === 'B1' ? 0 : -3; }
function avg(values) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null; }
function compareNullable(a, b) { if (!Number.isFinite(a) && !Number.isFinite(b)) return 0; if (!Number.isFinite(a)) return 1; if (!Number.isFinite(b)) return -1; return a - b; }
function rankDescending(entries, key, boatNo) { const sorted = entries.filter(item => Number.isFinite(item[key])).sort((a,b) => b[key]-a[key]); const index = sorted.findIndex(item => item.boatNo === boatNo); return index >= 0 ? index + 1 : null; }
