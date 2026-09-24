import {notFound} from "next/navigation";
import BookIssueReader from "../../../library/components/BookIssueReader";
import {getCharacterBookSeries,getCharacterBookIssue} from "../../../../lib/characterBookSeries";
import {getPublishedIchikaBook} from "../../../../lib/ichikaBookDb";
export const dynamic="force-dynamic";
const map={women:"hatsune-women",sensei:"hatsune-sensei",meikan:"hatsune-meikan","data-lab":"hatsune-data-lab"};
export default async function HatsuneBookIssuePage({params}){const {series:slug,issue:issueId}=await params;const key=map[slug],series=getCharacterBookSeries(key);const managed=key?await getPublishedIchikaBook(key,issueId):null;const issue=managed||getCharacterBookIssue(key,issueId);if(!series||!issue)notFound();return <BookIssueReader series={series} issue={issue}/>;}
