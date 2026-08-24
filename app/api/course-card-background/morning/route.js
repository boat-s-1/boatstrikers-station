import { MORNING_BACKGROUND } from "../../../races/components/courseCardBackgroundMorning";

export const dynamic = "force-static";
export const revalidate = false;

function decodeDataUri(dataUri) {
  const value = String(dataUri ?? "");
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) return null;
  const base64 = value.slice(commaIndex + 1);
  return base64 ? Buffer.from(base64, "base64") : null;
}

export async function GET() {
  const image = decodeDataUri(MORNING_BACKGROUND);
  if (!image) return new Response("Invalid image", { status: 500 });

  return new Response(image, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
