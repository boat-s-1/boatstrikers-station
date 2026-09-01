import { createClient } from "@supabase/supabase-js";
import { generateEditorialMaterials } from "./editorialProductionAi";

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase環境変数がありません。");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function classifyPublicCategory(item) {
  const category = String(item?.category || "").toLowerCase();
  const text = `${item?.title || ""} ${item?.summary || ""} ${item?.category || ""}`;

  if (
    /^(sg|g1|g2|g3|sg\/g1\/g2)$/i.test(String(item?.category || "")) ||
    /\bSG\b|\bG1\b|GⅠ|\bG2\b|GⅡ|グランプリ|周年記念|グレードレース/.test(text)
  ) return "grade";

  if (
    ["選手動向", "a1/a2・級別", "欠場・f", "水神祭", "昇格", "復帰", "引退"].includes(category) ||
    /水神祭|昇級|A1昇格|A2昇格|級別|選手動向|復帰|引退|欠場|F休み|記録達成|レーサー特集|選手特集/.test(text)
  ) return "suijinsai";

  return null;
}

export async function autoPublishGradeAndRacerNews({ limit = 6, scanLimit = 40 } = {}) {
  const client = getClient();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: candidates, error: readError } = await client
    .from("bs_news_candidates")
    .select("id,collected_at,published_at,title,category,summary,source_name,source_url,importance,target_character,status,raw_payload")
    .eq("status", "unreviewed")
    .gte("collected_at", since)
    .order("importance", { ascending: false })
    .order("collected_at", { ascending: false })
    .limit(scanLimit);

  if (readError) throw readError;

  const eligible = (candidates || [])
    .map((item) => ({ item, publicCategory: classifyPublicCategory(item) }))
    .filter(({ publicCategory, item }) => publicCategory && Number(item.importance || 0) >= 3)
    .slice(0, limit);

  const result = { scanned: candidates?.length || 0, eligible: eligible.length, published: 0, skipped: 0, errors: [] };

  for (const { item, publicCategory } of eligible) {
    try {
      const sourceKey = `editorial:${item.id}`;
      const { data: existing, error: existingError } = await client
        .from("hatsune_news")
        .select("id,is_published")
        .eq("source_key", sourceKey)
        .maybeSingle();
      if (existingError) throw existingError;

      if (existing?.id) {
        if (!existing.is_published) {
          const { error: publishExistingError } = await client
            .from("hatsune_news")
            .update({ is_published: true, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (publishExistingError) throw publishExistingError;
        }
        await client.from("bs_news_candidates").update({ status: "published", updated_at: new Date().toISOString() }).eq("id", item.id);
        result.skipped += 1;
        continue;
      }

      const materials = item.raw_payload?.editorial_materials || await generateEditorialMaterials(item);
      const autoHeadline = item.raw_payload?.editorial_list_headline?.headline || materials.list_headline || null;
      const now = new Date().toISOString();

      const { error: insertError } = await client.from("hatsune_news").insert({
        source_key: sourceKey,
        source_type: "news",
        title: materials.news_title || item.title,
        list_headline: materials.list_headline || autoHeadline,
        summary: item.summary,
        category: publicCategory,
        source_name: item.source_name,
        source_url: item.source_url,
        published_at: item.published_at || item.collected_at || now,
        article_body: materials.news_body || null,
        article_body_source: materials.news_body ? "ai_editorial" : "template",
        article_ai_model: materials.model || null,
        article_ai_generated_at: materials.generated_at || now,
        is_published: true,
        is_featured: Number(item.importance || 0) >= 5,
        priority: Math.max(1, Math.min(10, Number(item.importance || 3))),
        collected_at: now,
      });
      if (insertError) throw insertError;

      const rawPayload = { ...(item.raw_payload || {}), editorial_materials: materials, auto_published_at: now, auto_public_category: publicCategory };
      const { error: updateError } = await client
        .from("bs_news_candidates")
        .update({ status: "published", raw_payload: rawPayload, updated_at: now })
        .eq("id", item.id);
      if (updateError) throw updateError;

      result.published += 1;
    } catch (error) {
      result.errors.push({ id: item.id, error: error?.message || String(error) });
    }
  }

  return result;
}
