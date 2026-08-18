import SeminarMagazineShelf from "../components/SeminarMagazineShelf";
import { seminarMagazines } from "../../../lib/seminarMagazines";
export const metadata = { title: "一果のイン逃げ鉄板ゼミ｜BoatStrikers", description: "一果のイン逃げ鉄板ゼミ バックナンバー一覧" };
export default function Page(){ return <SeminarMagazineShelf magazine={seminarMagazines.ichika} />; }
