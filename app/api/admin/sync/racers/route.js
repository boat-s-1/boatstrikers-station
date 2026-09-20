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

async function fetchProfileOnce(candidate){
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

async function fetchProfile(candidate){
  try{
    return await fetchProfileOnce(candidate);
  }catch(firstError){
    await sleep(800);
    try{
      return await fetchProfileOnce(candidate);
    }catch(secondError){
      const first=firstError instanceof Error?firstError.message:String(firstError);
      const second=secondError instanceof Error?secondError.message:String(secondError);
      throw new Error(`retry_failed: ${first} -> ${second}`);
    }
  }
}

export async function POST(request){
  if(!(await isAdminAuthenticated()))return NextResponse.json({error:"unauthorized"},{status:401});
  let body={};
  try{body=await request.json();}catch{}
  const requested=Number(body?.limit??4);
  const limit=Number.isInteger(requested)?Math.min(Math.max(requested,1),8):4;
  const recentDays=7;
  const excluded=new Set(Array.isArray(body?.exclude)?body.exclude.map(v=>String(v||"").trim()).filter(v=>/^\d{5}$/.test(v)).slice(0,100):[]);
  const db=getAdminSupabase();

  const candidateLimit=Math.min(limit+excluded.size,100);
  const {data:candidates,error:candidateError}=await db.rpc("bs_racer_sync_candidates",{
    p_recent_days:recentDays,p_limit:candidateLimit,
  });
  if(candidateError)return NextResponse.json({error:candidateError.message},{status:500});

  const synced=[];
  const failed=[];
  const queue=(candidates||[]).filter(x=>!excluded.has(x.racer_registration_no)).slice(0,limit);
  for(let i=0;i<queue.length;i+=2){
    const chunk=queue.slice(i,i+2);
    const results=await Promise.all(chunk.map(async(candidate)=>{
      try{
        const profile=await fetchProfile(candidate);
        const {error}=await db.from("bs_racers").upsert(profile,{onConflict:"registration_no"});
        if(error)throw error;
        return {ok:true,profile};
      }catch(error){
        return {
          ok:false,
          candidate,
          error:error instanceof Error?error.message:String(error),
        };
      }
    }));
    for(const result of results){
      if(result.ok){
        synced.push({registration_no:result.profile.registration_no,name:result.profile.name,birthday:result.profile.birthday});
      }else{
        failed.push({
          registration_no:result.candidate.racer_registration_no,
          name:compact(result.candidate.racer_name)||result.candidate.racer_registration_no,
          error:result.error,
        });
      }
    }
    if(i+2<queue.length)await sleep(250);
  }

  const {count}=await db.from("bs_racers").select("registration_no",{count:"exact",head:true});
  return NextResponse.json({
    ok:failed.length===0,
    requested:limit,
    candidates:queue.length,
    synced:synced.length,
    failed,
    total_profiles:count||0,
  },{status:failed.length?207:200});
}
