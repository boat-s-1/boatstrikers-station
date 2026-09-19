#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const OFFICIAL_PROFILE_BASE =
  'https://www.boatrace.jp/owpc/pc/data/racersearch/profile';

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.length ? rest.join('=') : true];
  }),
);

const write = args.get('write') === true;
const limit = Number(args.get('limit') ?? 20);
const recentDays = Number(args.get('recent-days') ?? 90);
const requestedRegistrationNo = args.get('registration-no');

if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
  throw new Error('--limit must be an integer between 1 and 500');
}

if (!Number.isInteger(recentDays) || recentDays < 1 || recentDays > 3650) {
  throw new Error('--recent-days must be an integer between 1 and 3650');
}

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function decodeHtml(value) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function htmlToLines(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(?:div|p|li|tr|td|th|h1|h2|h3|dt|dd)>/gi, '\n')
      .replace(/<[^>]+>/g, '\n'),
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/[\t ]+/g, ' ').trim())
    .filter(Boolean);
}

function valueAfterLabel(lines, label) {
  const index = lines.findIndex((line) => line === label);
  return index >= 0 ? lines[index + 1] ?? null : null;
}

function compactName(value) {
  return value?.replace(/[\s　]+/g, '') ?? null;
}

function normalizeOfficialRegistrationNo(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!digits) throw new Error(`Invalid registration number: ${value}`);
  const number = Number(digits);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`Invalid registration number: ${value}`);
  }
  return String(number);
}

function toBoatStrikersRegistrationNo(value) {
  return normalizeOfficialRegistrationNo(value).padStart(5, '0');
}

function parseInteger(value) {
  const match = String(value ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
}

function parseNumber(value) {
  const match = String(value ?? '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseBirthday(value) {
  const match = String(value ?? '').match(/(\d{4})\/(\d{2})\/(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function parseProfile(html, fallback = {}) {
  const lines = htmlToLines(html);
  const registration = valueAfterLabel(lines, '登録番号');

  if (!registration) {
    throw new Error('Official profile did not contain 登録番号');
  }

  const officialRegistrationNo = normalizeOfficialRegistrationNo(registration);
  const header = lines.find((line) => line.includes('（出場予定）'));
  const headerName = header?.replace(/（出場予定）.*$/, '').trim() ?? null;

  const name =
    compactName(fallback.racer_name) ||
    compactName(headerName);

  if (!name) {
    throw new Error(`Could not determine racer name for ${officialRegistrationNo}`);
  }

  const birthday = parseBirthday(valueAfterLabel(lines, '生年月日'));
  const heightCm = parseInteger(valueAfterLabel(lines, '身長'));
  const weightKg = parseNumber(valueAfterLabel(lines, '体重'));
  const bloodType = valueAfterLabel(lines, '血液型')?.replace(/型$/, '') ?? null;
  const branch = valueAfterLabel(lines, '支部');
  const birthplace = valueAfterLabel(lines, '出身地');
  const registrationTerm = parseInteger(valueAfterLabel(lines, '登録期'));
  const racerClass = valueAfterLabel(lines, '級別')?.replace(/級$/, '') ?? null;

  return {
    registration_no: toBoatStrikersRegistrationNo(officialRegistrationNo),
    official_registration_no: officialRegistrationNo,
    name,
    name_kana: fallback.racer_name_kana?.trim() || null,
    birthday,
    branch: branch || fallback.racer_branch || null,
    birthplace: birthplace || null,
    gender: fallback.gender || null,
    racer_class: racerClass || fallback.racer_class || null,
    registration_term: registrationTerm,
    height_cm: heightCm,
    weight_kg: weightKg,
    blood_type: bloodType,
    is_active: true,
    source: 'boatrace_official',
    source_url: `${OFFICIAL_PROFILE_BASE}?toban=${encodeURIComponent(officialRegistrationNo)}`,
    source_fetched_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function fetchOfficialProfile(registrationNo, fallback) {
  const officialRegistrationNo = normalizeOfficialRegistrationNo(registrationNo);
  const url =
    `${OFFICIAL_PROFILE_BASE}?toban=${encodeURIComponent(officialRegistrationNo)}`;

  const response = await fetch(url, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.8',
      'User-Agent': 'BoatStrikers racer-profile-sync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Official profile HTTP ${response.status}: ${url}`);
  }

  return parseProfile(await response.text(), fallback);
}

async function loadCandidates() {
  if (requestedRegistrationNo) {
    const registrationNo = toBoatStrikersRegistrationNo(requestedRegistrationNo);
    const { data, error } = await supabase
      .from('bs_race_entries')
      .select('racer_registration_no,racer_name,racer_name_kana,racer_branch,racer_class,gender')
      .eq('racer_registration_no', registrationNo)
      .order('race_date', { ascending: false })
      .limit(1);

    if (error) throw error;

    return [
      data?.[0] ?? {
        racer_registration_no: registrationNo,
        racer_name: null,
        racer_name_kana: null,
        racer_branch: null,
        racer_class: null,
        gender: null,
      },
    ];
  }

  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - recentDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('bs_race_entries')
    .select('racer_registration_no,racer_name,racer_name_kana,racer_branch,racer_class,gender,race_date')
    .gte('race_date', cutoffDate)
    .not('racer_registration_no', 'is', null)
    .order('race_date', { ascending: false })
    .limit(10000);

  if (error) throw error;

  const latestByRegistration = new Map();
  for (const row of data ?? []) {
    if (!row.racer_registration_no) continue;
    if (!latestByRegistration.has(row.racer_registration_no)) {
      latestByRegistration.set(row.racer_registration_no, row);
    }
  }

  const registrations = [...latestByRegistration.keys()];
  const { data: existing, error: existingError } = await supabase
    .from('bs_racers')
    .select('registration_no')
    .in('registration_no', registrations);

  // Before the migration is applied, dry-run can still be used with
  // --registration-no. For batch mode, the master table must exist.
  if (existingError) {
    throw new Error(
      `Could not read bs_racers. Apply the migration in a non-production test environment first, or use --registration-no for parser dry-run. ${existingError.message}`,
    );
  }

  const existingSet = new Set((existing ?? []).map((row) => row.registration_no));
  return [...latestByRegistration.values()]
    .filter((row) => !existingSet.has(row.racer_registration_no))
    .slice(0, limit);
}

async function main() {
  const candidates = await loadCandidates();

  if (!candidates.length) {
    console.log('No racer profiles need syncing.');
    return;
  }

  console.log(
    `${write ? 'WRITE' : 'DRY-RUN'}: checking ${candidates.length} racer profile(s)`,
  );

  let succeeded = 0;
  let failed = 0;

  for (const candidate of candidates) {
    try {
      const profile = await fetchOfficialProfile(
        candidate.racer_registration_no,
        candidate,
      );

      if (write) {
        const { error } = await supabase
          .from('bs_racers')
          .upsert(profile, { onConflict: 'registration_no' });
        if (error) throw error;
        console.log(`UPSERT ${profile.registration_no} ${profile.name}`);
      } else {
        console.log(
          JSON.stringify(
            {
              registration_no: profile.registration_no,
              name: profile.name,
              birthday: profile.birthday,
              branch: profile.branch,
              birthplace: profile.birthplace,
              racer_class: profile.racer_class,
              registration_term: profile.registration_term,
            },
            null,
            2,
          ),
        );
      }

      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(
        `FAILED ${candidate.racer_registration_no}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(
    `Done. succeeded=${succeeded} failed=${failed} mode=${write ? 'write' : 'dry-run'}`,
  );

  if (failed > 0) process.exitCode = 1;
}

await main();
