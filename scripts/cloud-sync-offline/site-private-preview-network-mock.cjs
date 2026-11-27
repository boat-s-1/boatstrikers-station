// CI-only network isolation for the local Next.js preview smoke.
// The child server cannot contact live Supabase or any external API.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url);
  if (url.hostname === "dummy.supabase.co") {
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json", "Content-Range": "0-0/0" },
    });
  }
  if (url.hostname === "127.0.0.1" || url.hostname === "localhost") {
    return originalFetch(input, options);
  }
  throw new Error("External network disabled in private preview smoke");
};
