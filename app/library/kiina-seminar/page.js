import SeminarMagazineShelf from "../components/SeminarMagazineShelf";
import { seminarMagazines } from "../../../lib/seminarMagazines";
export const metadata = { title: "キイナの穴党新聞｜BoatStrikers", description: "キイナの穴党新聞 バックナンバー一覧" };
export default function Page(){ return <SeminarMagazineShelf magazine={seminarMagazines.kiina} />; }
