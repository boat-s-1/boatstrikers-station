// @supabase/supabase-js をテスト用の偽クライアントに差し替える Node のモジュールフック
export async function resolve(specifier, context, next) {
  if (specifier === "@supabase/supabase-js") return { url: new URL("./supabase-fake.mjs", import.meta.url).href, shortCircuit: true };
  return next(specifier, context);
}
