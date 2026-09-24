import {notFound} from "next/navigation";
import SeminarMagazineShelf from "../../library/components/SeminarMagazineShelf";
import {getCharacterBookSeries} from "../../../lib/characterBookSeries";
import {listPublishedIchikaBooks} from "../../../lib/ichikaBookDb";
export const dynamic="force-dynamic";
const map={women:"hatsune-women",sensei:"hatsune-sensei",meikan:"hatsune-meikan","data-lab":"hatsune-data-lab"};
export default async function HatsuneBooksPage({params}){const {series:slug}=await params;const key=map[slug];const base=getCharacterBookSeries(key);if(!base)notFound();const managed=await listPublishedIchikaBooks(key);return <SeminarMagazineShelf magazine={{...base,issues:managed.length?managed:base.issues}}/>;}
