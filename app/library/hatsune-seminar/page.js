import SeminarMagazineShelf from "../components/SeminarMagazineShelf";
import { seminarMagazines } from "../../../lib/seminarMagazines";
export const metadata = { title: "初音の女子戦攻略マガジン｜BoatStrikers", description: "初音の女子戦攻略マガジン バックナンバー一覧" };
export default function Page(){ return <SeminarMagazineShelf magazine={seminarMagazines.hatsune} />; }
