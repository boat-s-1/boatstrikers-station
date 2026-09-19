import { NextResponse } from "next/server";
import { isAdminAuthenticated } from "../../../../admin/sync/_lib/adminAuth";
import { getAdminSupabase } from "../../../../admin/sync/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROFILE_BASE = "https://www.boatrace.jp/owpc/pc/data/racersearch/profile";

function decodeHtml(value){
  return value
    .replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">").replace(/&#39;/gi,"'").replace(/&quot;/gi,'"')
    .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)));
}
function lines(html){
  return decodeHtml(html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,"")
    .replace(/<br\s*\/?>/gi,"\n")
    .replace(/<\/(?:div|p|li|tr|td|th|h1|h2|h3|dt|dd)>/gi,"\n")
    .replace(/<[^>]+>/g,"\n"))
    .split(/\r?\n/).map(x=>x.replace(/[\t ]+/g," ").trim()).filter(Boolean);
}
function after(xs,label){const i=xs.findIndex(x=>x===label);return i>=0?(xs[i+1]||null):null;}
function digits(v){const d=String(v||"").replace(/\D/g,"");const n=Number(d);if(!Number.isInteger(n)||n<=0)throw new Error("invalid_registration");return String(n);}
function bsNo(v){return digits(v).padStart(5,"0");}
function int(v){const m=String(v||"").match(/\d+/);return m?Number(m[0]):null;}
function num(v){const m=String(v||"").match(/\d+(?:\.\d+)?/);return m?Number(m[0]):null;}
function date(v){const m=String(v||"").match(/(\d{4})\/(\d{2})\/(\d{2})/);return m?`${m[1]}-${m[2]}-${m[3]}`:null;}
function compact(v){return v?String(v).replace(/[\s　]+/g,""):null;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function parseProfile(html,fallback){
  const xs=lines(html);
  const official=digits(after(xs,"登録番号"));
  const header=xs.find(x=>/（[^）]*出場予定[^）]*）/.test(x));
  const headerName=header?.replace(/（[^）]*出場予定[^）]*）.*$/,"").trim()||null;
  const birthday=date(after(xs,"生年月日"));
  const name=compact(fallback?.racer_name)||compact(headerName);
  if(!birthday||!name)throw new Error("profile_parse_failed");
  return {
    registration_no:bsNo(official),
    official_registration_no:official,
    name,
    name_kana:fallback?.racer_name_kana?.trim()||null,
    birthday,
    branch:after(xs,"支部")||fallback?.racer_branch||null,
    birthplace:after(xs,"出身地")||null,
    gender:fallback?.gender||null,
    racer_class:(after(xs,"級別")||fallback?.racer_class||"").replace(/級$/,"")||null,
    registration_term:int(after(xs,"登録期")),
    height_cm:int(after(xs,"身長")),
    weight_kg:num(after(xs,"体重")),
    blood_type:(after(xs,"血液型")||"").replace(/型$/,"")||null,
    is_active:true,
    source:"boatrace_official",
    source_url:`${PROFILE_BASE}?toban=${official}`,
    source_fetched_at:new Date().toISOString(),
    updated_at:new Date().toISOString(),
  };
}

async function fetchProfile(candidate){
  const official=digits(candidate.racer_registration_no);
  const url=`${PROFILE_BASE}?toban=${official}`;
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const res=await fetch(url,{cache:"no-store",signal:controller.signal,headers:{
      "Accept":"text/html,application/xhtml+xml",
      "Accept-Language":"ja,en;q=0.8",
      "User-Agent":"BoatStrikers racer-profile-sync/1.0",
    }});
    if(!res.ok)throw new Error(`official_http_${res.status}`);
    return parseProfile(await res.text(),candidate);
  }finally{clearTimeout(timer);}
}

export async function POST(request){
  if(!(await isAdminAuthenticated()))return NextResponse.json({error:"unauthorized"},{status:401});
  let body={};
  try{body=await request.json();}catch{}
  const requested=Number(body?.limit??5);
  const limit=Number.isInteger(requested)?Math.min(Math.max(requested,1),10):5;
  const recentDays=14;
  const db=getAdminSupabase();

  const {data:candidates,error:candidateError}=await db.rpc("bs_racer_sync_candidates",{
    p_recent_days:recentDays,p_limit:limit,
  });
  if(candidateError)return NextResponse.json({error:candidateError.message},{status:500});

  const synced=[];
  const failed=[];
  for(const candidate of candidates||[]){
    try{
      const profile=await fetchProfile(candidate);
      const {error}=await db.from("bs_racers").upsert(profile,{onConflict:"registration_no"});
      if(error)throw error;
      synced.push({registration_no:profile.registration_no,name:profile.name,birthday:profile.birthday});
    }catch(error){
      failed.push({
        registration_no:candidate.racer_registration_no,
        name:candidate.racer_name,
        error:error instanceof Error?error.message:String(error),
      });
    }
    await sleep(180);
  }

  const {count}=await db.from("bs_racers").select("registration_no",{count:"exact",head:true});
  return NextResponse.json({
    ok:failed.length===0,
    requested:limit,
    candidates:(candidates||[]).length,
    synced:synced.length,
    failed,
    total_profiles:count||0,
  },{status:failed.length?207:200});
}
