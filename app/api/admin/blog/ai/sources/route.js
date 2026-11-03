import { blogBody, blogResponse, requireBlogAdmin } from "../../../../../../lib/blog/server";
import { aiServerDeps } from "../../../../../../lib/blog/ai/server";
import { requireAiEnabled } from "../../../../../../lib/blog/ai/config.mjs";
import { defaultSourceUrls, normalizeSourceUrl } from "../../../../../../lib/blog/ai/officialSources.mjs";
import { refreshOfficialSources } from "../../../../../../lib/blog/ai/pipeline.mjs";
import { stadiumBySlug } from "../../../../../../lib/blog/ai/topics.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const bad = message => Object.assign(new Error(message), { status: 400 });
function stadium(value) { if (!stadiumBySlug(value)) throw bad("場を確認してください。"); return value; }

export async function GET(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request);
    const slug = stadium(new URL(request.url).searchParams.get("stadium")), { store } = aiServerDeps();
    const [registered, documents] = await Promise.all([store.sourceUrls(slug), store.documents(slug, { withText: false })]);
    const defaults = defaultSourceUrls(slug).filter(d => !registered.some(r => r.url === d.url)).map(d => ({ ...d, id: null, active: true, pending: true }));
    return { urls: [...defaults, ...registered], documents };
  });
}

export async function POST(request) {
  return blogResponse(async () => {
    await requireBlogAdmin(request, { write: true });
    requireAiEnabled();
    const body = await blogBody(request), slug = stadium(body.stadium_slug), { store } = aiServerDeps();
    if (body.action === "register") {
      const url = normalizeSourceUrl(body.url), label = String(body.label || "").trim(), registeredBy = String(body.registered_by || "").trim();
      if (!url) throw bad("https で始まる正しいURLを入力してください。");
      if (!label || label.length > 200) throw bad("出典名（200文字以内）を入力してください。");
      if (!["official_site", "manual"].includes(body.kind)) throw bad("種類を確認してください。");
      if (!registeredBy || registeredBy.length > 80) throw bad("登録者名（80文字以内）を入力してください。");
      return store.addSourceUrl({ stadium_slug: slug, url, label, kind: body.kind, registered_by: registeredBy });
    }
    if (body.action === "fetch") return { results: await refreshOfficialSources({ store, stadiumSlug: slug, fetchImpl: fetch }) };
    throw bad("操作を確認してください。");
  });
}
