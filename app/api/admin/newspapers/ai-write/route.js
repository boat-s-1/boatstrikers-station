import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";
import { getAiAdminSupabase } from "../../../../../lib/aiAdminSupabase";
import { runNewspaperAiWrite } from "../../../../../lib/newspaper/aiWriter.mjs";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  if (!(await isAdminAuthenticated())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { status, body } = await runNewspaperAiWrite({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_NEWSPAPER_MODEL,
    readBody: () => request.json(),
    getSupabase: getAiAdminSupabase,
  });
  return NextResponse.json(body, { status });
}
