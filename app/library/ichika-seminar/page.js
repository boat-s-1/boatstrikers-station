import SeminarMagazineShelf from "../components/SeminarMagazineShelf";
import { getSeminarMagazine } from "../../../lib/seminarMagazineLibrary";
export const dynamic = "force-dynamic";
export const metadata = { title: "一果のイン逃げ鉄板ゼミ｜BoatStrikers" };
export default async function Page(){ const magazine=await getSeminarMagazine("ichika"); return <SeminarMagazineShelf magazine={magazine} />; }
