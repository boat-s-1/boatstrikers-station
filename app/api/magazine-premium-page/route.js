import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getRadioAdminSupabase } from "../../../lib/supabaseRadioAdmin";
import { SEMINAR_BUCKET } from "../../../lib/seminarMagazineDb";
import { getMemberEntitlementFromRequest } from "../../../lib/memberEntitlement";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const ALLOWED=new Set(["ichika","hatsune","kiina"]);

export async function GET(request){
  try{
    const entitlement=await getMemberEntitlementFromRequest(request);
    if(!entitlement.plus)return new NextResponse("Membership Required",{status:401,headers:{"Cache-Control":"private, no-store, max-age=0"}});

    const {searchParams}=new URL(request.url);
    const magazine=searchParams.get("magazine")||"";
    const issue=searchParams.get("issue")||"";
    const pageNumber=Number(searchParams.get("page")||0);
    const source=searchParams.get("source")||"local";
    if(!ALLOWED.has(magazine)||!/^\d{3,4}$/.test(issue)||!Number.isInteger(pageNumber)||pageNumber<1||pageNumber>99)return new NextResponse("Bad Request",{status:400});

    if(source==="supabase"){
      const supabase=getRadioAdminSupabase();
      const {data:row,error}=await supabase.from("seminar_magazine_issues")
        .select("page_paths,premium_start_page,status,published_at")
        .eq("series",magazine).eq("issue_no",issue).eq("status","published").maybeSingle();
      if(error||!row)return new NextResponse("Not Found",{status:404});
      if(pageNumber<Number(row.premium_start_page||999))return new NextResponse("Bad Request",{status:400});
      const pages=Array.isArray(row.page_paths)?row.page_paths:[];
      const item=pages.find(p=>Number(p.page)===pageNumber);
      if(!item?.path)return new NextResponse("Not Found",{status:404});
      const {data,error:downloadError}=await supabase.storage.from(SEMINAR_BUCKET).download(item.path);
      if(downloadError||!data)return new NextResponse("Not Found",{status:404});
      return new NextResponse(await data.arrayBuffer(),{status:200,headers:{"Content-Type":data.type||"image/jpeg","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
    }

    const filename=`page-${String(pageNumber).padStart(2,"0")}.png`;
    const root=path.join(process.cwd(),"private","magazines");
    const filePath=path.join(root,magazine,issue,filename);
    const resolved=path.resolve(filePath),resolvedRoot=path.resolve(root)+path.sep;
    if(!resolved.startsWith(resolvedRoot))return new NextResponse("Bad Request",{status:400});
    const data=await fs.readFile(resolved);
    return new NextResponse(data,{status:200,headers:{"Content-Type":"image/png","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff"}});
  }catch(error){
    if(error?.code==="ENOENT")return new NextResponse("Not Found",{status:404});
    console.error("[magazine-premium-page]",error);
    return new NextResponse("Internal Server Error",{status:500});
  }
}
