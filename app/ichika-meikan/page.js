import SeminarMagazineShelf from "../library/components/SeminarMagazineShelf";
import {getIchikaBookSeries} from "../../lib/ichikaBookSeries";
import {listPublishedIchikaBooks} from "../../lib/ichikaBookDb";
export const dynamic="force-dynamic";
export default async function Page(){const base=getIchikaBookSeries("meikan");const issues=await listPublishedIchikaBooks("meikan");return <SeminarMagazineShelf magazine={{...base,issues}}/>;}
