import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";
import { handleCandidatesRequest, newsSupabaseFromEnv } from "../../../../../lib/newspaper/predictionSources.mjs";

export async function GET(request) {
  if (!(await isAdminAuthenticated().catch(() => false))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const { status, body } = await handleCandidatesRequest("ichika", searchParams, () => newsSupabaseFromEnv(createClient));
  return NextResponse.json(body, { status });
}
