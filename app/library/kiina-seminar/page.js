import SeminarMagazineShelf from "../components/SeminarMagazineShelf";
import { getSeminarMagazine } from "../../../lib/seminarMagazineLibrary";
export const dynamic = "force-dynamic";
export const metadata = { title: "キイナの穴党新聞｜BoatStrikers" };
export default async function Page(){ const magazine=await getSeminarMagazine("kiina"); return <SeminarMagazineShelf magazine={magazine} />; }
