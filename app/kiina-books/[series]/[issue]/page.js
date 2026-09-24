import {notFound} from "next/navigation";
import BookIssueReader from "../../../library/components/BookIssueReader";
import {getCharacterBookSeries,getCharacterBookIssue} from "../../../../lib/characterBookSeries";
import {getPublishedIchikaBook} from "../../../../lib/ichikaBookDb";
export const dynamic="force-dynamic";
const map={hole:"kiina-hole",sensei:"kiina-sensei",meikan:"kiina-meikan","data-lab":"kiina-data-lab"};
export default async function KiinaBookIssuePage({params}){const {series:slug,issue:issueId}=await params;const key=map[slug],series=getCharacterBookSeries(key);const managed=key?await getPublishedIchikaBook(key,issueId):null;const issue=managed||getCharacterBookIssue(key,issueId);if(!series||!issue)notFound();return <BookIssueReader series={series} issue={issue}/>;}
