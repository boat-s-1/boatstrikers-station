import SeminarMagazineShelf from "../components/SeminarMagazineShelf";
import { getSeminarMagazine } from "../../../lib/seminarMagazineLibrary";
export const dynamic = "force-dynamic";
export const metadata = { title: "初音の女子戦攻略マガジン｜BoatStrikers" };
export default async function Page(){ const magazine=await getSeminarMagazine("hatsune"); return <SeminarMagazineShelf magazine={magazine} />; }
