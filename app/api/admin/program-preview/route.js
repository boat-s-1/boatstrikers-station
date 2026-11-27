import { isAdminAuthenticated } from "../../../admin/sync/_lib/adminAuth";
import { loadPrivateProgram } from "../../../../scripts/cloud-sync-offline/site-private-program-gate.mjs";

export const dynamic = "force-dynamic";

export async function GET() {
  const program = await loadPrivateProgram({
    enabled: process.env.BS_ADMIN_PROGRAM_PREVIEW_ENABLED === "true",
    authenticate: isAdminAuthenticated,
    load: () => Array.from({ length: 6 }, (_, index) => ({
      boat: index + 1,
      registration: String(9001 + index),
      name: `検証用選手${index + 1}`,
      exhibition: null,
    })),
  });
  if (!program.allowed) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json({ synthetic: true, entries: program.data }, { headers: { "Cache-Control": "private, no-store" } });
}
