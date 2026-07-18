import { createClient } from "@supabase/supabase-js";

const COURSE_NAMES = {
  1:"桐生",2:"戸田",3:"江戸川",4:"平和島",5:"多摩川",6:"浜名湖",
  7:"蒲郡",8:"常滑",9:"津",10:"三国",11:"びわこ",12:"住之江",
  13:"尼崎",14:"鳴門",15:"丸亀",16:"児島",17:"宮島",18:"徳山",
  19:"下関",20:"若松",21:"芦屋",22:"福岡",23:"唐津",24:"大村"
};

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("VercelのSupabase環境変数が未設定です。");
  return createClient(url, key, {
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:(input,init={})=>fetch(input,{...init,cache:"no-store"})}
  });
}

export const getCourseName = code => COURSE_NAMES[Number(code)] || `${Number(code)}場`;
export const getTodayJst = () => new Intl.DateTimeFormat("sv-SE",{
  timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"
}).format(new Date());
export const normalizeDate = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value||"")) ? String(value) : getTodayJst();
export const normalizeCourseCode = value => { const n=Number(value); return Number.isInteger(n)&&n>=1&&n<=24?n:null; };
export const normalizeRaceNo = value => { const n=Number(value); return Number.isInteger(n)&&n>=1&&n<=12?n:null; };
export const normalizeRacerName = name => String(name||"選手名未取得").replace(/\u3000/g," ").replace(/\s+/g," ").trim();
export const formatNumber = (value,digits=2) => value===null||value===undefined||value===""||!Number.isFinite(Number(value)) ? "-" : Number(value).toFixed(digits);
export function formatSyncedAt(value){
  if(!value) return "-";
  try{return new Intl.DateTimeFormat("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(value));}
  catch{return "-";}
}

export async function getAvailableDates(limit=14){
  const {data,error}=await client().from("bs_race_events").select("race_date").order("race_date",{ascending:false}).limit(1000);
  if(error) throw new Error(`開催日の取得に失敗しました: ${error.message}`);
  return [...new Set((data||[]).map(x=>x.race_date))].slice(0,limit);
}

export async function getCoursesByDate(raceDate){
  const {data,error}=await client().from("bs_race_events")
    .select("race_date,course_code,race_no,race_status,weather,synced_at")
    .eq("race_date",raceDate).order("course_code").order("race_no");
  if(error) throw new Error(`開催場一覧の取得に失敗しました: ${error.message}`);
  const map=new Map();
  for(const e of data||[]){
    if(!map.has(e.course_code)) map.set(e.course_code,{courseCode:e.course_code,courseName:getCourseName(e.course_code),raceCount:0,exhibitionCount:0,syncedAt:e.synced_at});
    const x=map.get(e.course_code); x.raceCount++; if(e.race_status==="exhibition") x.exhibitionCount++; if(e.synced_at>x.syncedAt)x.syncedAt=e.synced_at;
  }
  return [...map.values()];
}

export async function getCourseRacesByDate(raceDate,courseCode){
  const sb=client();
  const [{data:events,error:ee},{data:entries,error:enErr}]=await Promise.all([
    sb.from("bs_race_events").select("*").eq("race_date",raceDate).eq("course_code",courseCode).order("race_no"),
    sb.from("bs_race_entries").select("race_no,boat_no,racer_name,racer_class,national_win_rate,local_win_rate,exhibition_time,synced_at").eq("race_date",raceDate).eq("course_code",courseCode).order("race_no").order("boat_no")
  ]);
  if(ee) throw new Error(`レース一覧の取得に失敗しました: ${ee.message}`);
  if(enErr) throw new Error(`出走選手の取得に失敗しました: ${enErr.message}`);
  const m=new Map(); for(const e of entries||[]){if(!m.has(e.race_no))m.set(e.race_no,[]);m.get(e.race_no).push(e);}
  return (events||[]).map(e=>({...e,entries:m.get(e.race_no)||[]}));
}

export async function getRaceDetail(raceDate,courseCode,raceNo){
  const sb=client();
  const [{data:event,error:ee},{data:entries,error:enErr}]=await Promise.all([
    sb.from("bs_race_events").select("*").eq("race_date",raceDate).eq("course_code",courseCode).eq("race_no",raceNo).maybeSingle(),
    sb.from("bs_race_entries").select("*").eq("race_date",raceDate).eq("course_code",courseCode).eq("race_no",raceNo).order("boat_no")
  ]);
  if(ee) throw new Error(`レース情報の取得に失敗しました: ${ee.message}`);
  if(enErr) throw new Error(`出走表の取得に失敗しました: ${enErr.message}`);
  return {event,entries:entries||[]};
}
