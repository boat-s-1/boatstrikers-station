import { MORNING_BACKGROUND } from "../../../races/components/courseCardBackgroundMorning";
import { DAY_BACKGROUND } from "../../../races/components/courseCardBackgroundDay";
import { NIGHT_BACKGROUND } from "../../../races/components/courseCardBackgroundNight";

const BACKGROUNDS = {
  morning: MORNING_BACKGROUND,
  day: DAY_BACKGROUND,
  night: NIGHT_BACKGROUND,
};

function decodeDataUri(dataUri) {
  const value = String(dataUri ?? "");
  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) return null;

  const base64 = value.slice(commaIndex + 1);
  if (!base64) return null;

  return Buffer.from(base64, "base64");
}

export async function GET(_request, { params }) {
  const { type } = await params;
  const dataUri = BACKGROUNDS[String(type ?? "").toLowerCase()];

  if (!dataUri) {
    return new Response("Not found", { status: 404 });
  }

  const image = decodeDataUri(dataUri);

  if (!image) {
    return new Response("Invalid image", { status: 500 });
  }

  return new Response(image, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
      "Vercel-CDN-Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
