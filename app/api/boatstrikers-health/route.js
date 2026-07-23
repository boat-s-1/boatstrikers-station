import { NextResponse } from "next/server";
import {
  getAvailableDates,
  getCoursesByDate,
} from "../../lib/boatstrikersPlatform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dates = await getAvailableDates(3);
    const latestDate = dates[0] ?? null;
    const courses = latestDate
      ? await getCoursesByDate(latestDate)
      : [];

    return NextResponse.json({
      status: "success",
      latestDate,
      availableDates: dates,
      courseCount: courses.length,
      raceCount: courses.reduce(
        (sum, course) => sum + course.races.length,
        0
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message:
          error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
