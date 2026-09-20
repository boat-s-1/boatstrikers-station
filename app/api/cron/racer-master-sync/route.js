import { NextResponse } from "next/server";
import { getAdminSupabase } from "../../../admin/sync/_lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PROFILE_BASE = "https://www.boatrace.jp/owpc/pc/data/racersearch/profile";

function authorized(request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}
function jstDateString(){
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
}
function decodeHtml(value){
  return value.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&lt;/gi,"<")
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
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  try{
    const res=await fetch(`${PROFILE_BASE}?toban=${official}`,{
      cache:"no-store",signal:controller.signal,
      headers:{"Accept":"text/html,application/xhtml+xml","Accept-Language":"ja,en;q=0.8","User-Agent":"BoatStrikers racer-profile-sync/1.0"},
    });
    if(!res.ok)throw new Error(`official_http_${res.status}`);
    return parseProfile(await res.text(),candidate);
  }finally{clearTimeout(timer);}
}
async function fetchProfile(candidate){
  try{return await fetchProfileOnce(candidate);}
  catch(first){
    await sleep(800);
    try{return await fetchProfileOnce(candidate);}
    catch(second){throw new Error(`retry_failed: ${String(first?.message||first)} -> ${String(second?.message||second)}`);}
  }
}

export async function GET(request){
  if(!authorized(request))return NextResponse.json({ok:false,error:"unauthorized"},{status:401});

  const db=getAdminSupabase();
  const today=jstDateString();

  try{
    const {data:entries,error:entriesError}=await db
      .from("bs_race_entries")
      .select("racer_registration_no,racer_name,racer_name_kana,racer_branch,racer_class,gender,race_date")
      .eq("race_date",today)
      .not("racer_registration_no","is",null);
    if(entriesError)throw entriesError;

    const unique=new Map();
    for(const row of entries||[]){
      const no=row.racer_registration_no;
      if(!no)continue;
      unique.set(no,{
        registration_no:no,
        racer_name:row.racer_name||null,
        racer_name_kana:row.racer_name_kana||null,
        racer_branch:row.racer_branch||null,
        racer_class:row.racer_class||null,
        gender:row.gender||null,
        last_seen_date:today,
        updated_at:new Date().toISOString(),
      });
    }

    if(unique.size){
      const {error:queueError}=await db
        .from("bs_racer_sync_queue")
        .upsert([...unique.values()],{onConflict:"registration_no"});
      if(queueError)throw queueError;
    }

    const {data:candidates,error:candidateError}=await db.rpc("bs_racer_sync_candidates",{
      p_recent_days:7,
      p_limit:4,
    });
    if(candidateError)throw candidateError;

    const synced=[];
    const failed=[];
    const queue=candidates||[];
    for(let i=0;i<queue.length;i+=2){
      const chunk=queue.slice(i,i+2);
      const results=await Promise.all(chunk.map(async candidate=>{
        try{
          const profile=await fetchProfile(candidate);
          const {error}=await db.from("bs_racers").upsert(profile,{onConflict:"registration_no"});
          if(error)throw error;
          return {ok:true,profile};
        }catch(error){
          return {ok:false,candidate,error:error instanceof Error?error.message:String(error)};
        }
      }));
      for(const result of results){
        if(result.ok){
          synced.push({registration_no:result.profile.registration_no,name:result.profile.name});
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
    console.info(JSON.stringify({
      level:"info",message:"daily racer master sync complete",today,
      queueRefreshed:unique.size,candidates:queue.length,synced:synced.length,failed:failed.length,total:count||0,
    }));

    return NextResponse.json({
      ok:failed.length===0,
      today,
      queue_refreshed:unique.size,
      candidates:queue.length,
      synced:synced.length,
      failed,
      total_profiles:count||0,
    },{status:failed.length?207:200});
  }catch(error){
    const message=String(error?.message||error).slice(0,1200);
    console.error(JSON.stringify({level:"error",message:"daily racer master sync failed",error:message}));
    return NextResponse.json({ok:false,error:message},{status:500});
  }
}
