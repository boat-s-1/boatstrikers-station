import { createClient } from '@supabase/supabase-js';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseArgs(argv) {
  const args = { timing: 'both' };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--from') args.from = argv[++i];
    else if (token === '--to') args.to = argv[++i];
    else if (token === '--timing') args.timing = argv[++i];
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function usage() {
  console.log(`BoatStrikers AI v2 training-row generator\n\nUsage:\n  node --env-file=.env.local tools/ai-v2/generate-training-rows.mjs --from YYYY-MM-DD --to YYYY-MM-DD [--timing previous_day|after_exhibition|both]\n\nThis script only calls public.ai_v2_refresh_training_rows().\nIt does not train or activate any model.`);
}

function assertDate(label, value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  assertDate('--from', args.from);
  assertDate('--to', args.to);

  if (!['previous_day', 'after_exhibition', 'both'].includes(args.timing)) {
    throw new Error('--timing must be previous_day, after_exhibition, or both');
  }

  const supabase = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const timings = args.timing === 'both'
    ? ['previous_day', 'after_exhibition']
    : [args.timing];

  console.log('BoatStrikers AI v2 / training rows');
  console.log(`range=${args.from}..${args.to}`);

  for (const timing of timings) {
    console.log(`\n[${timing}] rebuilding...`);
    const { data, error } = await supabase.rpc('ai_v2_refresh_training_rows', {
      p_start_date: args.from,
      p_end_date: args.to,
      p_data_timing: timing,
    });

    if (error) {
      throw new Error(`[${timing}] ${error.message}`);
    }

    const summary = Array.isArray(data) ? data[0] : data;
    console.log(JSON.stringify({ timing, ...summary }, null, 2));
  }

  console.log('\nDone. No model was trained or activated.');
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exitCode = 1;
});
