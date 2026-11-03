import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { adminCookie } from "../../../app/admin/sync/_lib/adminAuth";
import { dataLabArticles } from "../../../app/data-lab/allArticles";
import { blogRepository } from "../repository.mjs";
import { aiStore } from "./store.mjs";
import { callOpenAIJson } from "./openai.mjs";
import { approverSession } from "./approval.mjs";
import { readRaceRows } from "./data/reader.mjs";

// BLOG project only (same variables as lib/blog/server.js). Never falls back to the race DB.
export function aiServerDeps() {
  const url = process.env.BLOG_SUPABASE_URL, key = process.env.BLOG_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw Object.assign(new Error("BLOG検証環境が未設定です。"), { status: 503 });
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return { repo: blogRepository(client), store: aiStore(client, { bucket: process.env.BLOG_PRIVATE_MEDIA_BUCKET || null }) };
}

export function aiCaller(config) {
  return args => callOpenAIJson({ apiKey: config.apiKey, model: config.model, ...args });
}

export async function currentApproverSession() {
  return approverSession((await cookies()).get(adminCookie.name)?.value);
}

export function dataLabTitles() {
  return dataLabArticles.map(a => ({ title: a.title, path: `/data-lab/${a.slug}` }));
}

// PHASE 1 research themes read BoatStrikers' race results (read-only, SELECT on four tables).
// Dedicated variables only; there is no fallback to SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. When they are not set,
// research topics stop before calling the AI (the stadium themes keep working). Use a key limited to reading.
export function raceDataReader() {
  const url = process.env.BLOG_RACE_DATA_SUPABASE_URL, key = process.env.BLOG_RACE_DATA_SUPABASE_KEY;
  if (!url || !key) return null;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return args => readRaceRows(client, args);
}
