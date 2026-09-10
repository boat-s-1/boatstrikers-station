import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["ichika", "hatsune", "kiina"]);

export async function GET(_request, { params }) {
  const resolved = await params;
  const character = resolved?.character;
  if (!ALLOWED.has(character)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const encoded = await readFile(
      path.join(process.cwd(), "public", "discord", `${character}.b64`),
      "utf8"
    );
    const image = Buffer.from(encoded.trim(), "base64");
    return new Response(image, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("[discord avatar]", character, error);
    return new Response("Avatar unavailable", { status: 500 });
  }
}
