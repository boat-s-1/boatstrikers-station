import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const encoded = await readFile(
      path.join(process.cwd(), "public", "discord", "hatsune.b64"),
      "utf8"
    );
    const image = Buffer.from(encoded.trim(), "base64");
    return new Response(image, {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(image.length),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("[hatsune avatar asset]", error);
    return new Response("Avatar unavailable", { status: 500 });
  }
}
