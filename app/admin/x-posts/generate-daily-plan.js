"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function isoJst(date,time){return new Date(`${date}T${time}:00+09:00`).toISOString()}
function grade(p){if(!Number.isFinite(p))return null;if(p>=.75)return"S";if(p>=.55)return"A";if(p>=.35)return"B";return"C"}
function clean(text){
 const s=String(text||"")
  .replace(/AI\s*v?\d+(?:\.\d+)?/gi,"")
  .replace(/shadow|model|raw|score/gi,"")
  .replace(/^\s*\d+(?:\.\d+)?%\s*$/gm,"")
  .replace(/\s{2,}/g," ")
  .trim();
 return s;
}
function pick(rows,code){const list=rows.filter(r=>r.character_code===code);return list.find(r=>r.selected_for_social)||list[0]||null}
function courseName(events,row){const e=events.find(x=>String(x.course_code)===String(row?.course_code)&&Number(x.race_no)===Number(row?.race_no));return e?.course_name||`場コード${String(row?.course_code||"").padStart(2,"0")}`}
function charBody(code,row,events){
 const meta={
  ichika:{icon:"🌱",name:"一果",label:"イン逃げ注目",headline:"今日はここをイン目線でチェック。",reason:"1号艇だからではなく、相手関係と直前気配まで見て判断したいレースです。",voice:"私は最後まで『逃げを信頼できるか』を見ます🌱"},
  hatsune:{icon:"🐰",name:"初音",label:"女子戦注目",headline:"今日の女子戦、まず見るならここ。",reason:"女子戦は近況・スタート気配・相手関係まで重ねて見ると印象が変わります。",voice:"展示まで見て、直前にもう一度チェックします🐰"},
  kiina:{icon:"⭐",name:"キイナ",label:"穴狙い注目",headline:"穴目線なら、今日はここが気になります。",reason:"高配当だからではなく、人気との差がありそうな材料を探したいレースです。",voice:"オッズと展示を見て、狙える穴か最後まで見極めます⭐"}
 }[code];
 if(!row)return `${meta.icon} ${meta.name}です。\n\n今日はまだ投稿候補データが揃っていません。確定データが入り次第、注目レースを更新します。\n\n#BoatStrikers #ボートレース`;
 const c=courseName(events,row),g=grade(Number(row.probability)),comment=clean(row.social_comment||row.summary);
 const reason=comment&&comment.length>=8?comment:meta.reason;
 return [
  `${meta.icon} ${meta.name}｜今日の注目`,
  "",
  `【結論】${meta.headline}`,
  `${c}${row.race_no}R${g?`｜${meta.label}【${g}】`:""}`,
  "",
  `【理由】${reason}`,
  "",
  `【ひとこと】${meta.voice}`,
  "",
  "#BoatStrikers #ボートレース"
 ].join("\n");
}

export async function generateDailyPlan(){
 const supabase=db(),date=today();let created=0,updated=0,skipped=0;const errors=[];
 const [{data:events,error:eventError},{data:rankings,error:rankError}]=await Promise.all([
  supabase.from("bs_race_events").select("course_code,race_no,course_name,race_name").eq("race_date",date).order("course_code").order("race_no"),
  supabase.from("ai_v2_daily_rankings").select("id,character_code,rank_no,course_code,race_no,probability,summary,social_comment,selected_for_social,data_timing").eq("ranking_date",date).in("character_code",["ichika","hatsune","kiina"]).order("rank_no")
 ]);
 if(eventError)errors.push(`開催データ: ${eventError.message}`);if(rankError)errors.push(`ランキング: ${rankError.message}`);
 const safeEvents=events||[],safeRankings=rankings||[];
 const venues=[...new Map(safeEvents.map(e=>[String(e.course_code),e.course_name||`場コード${e.course_code}`])).values()];
 const ichika=pick(safeRankings,"ichika"),hatsune=pick(safeRankings,"hatsune"),kiina=pick(safeRankings,"kiina");
 const venueText=venues.length?`${venues.length}場開催予定（${venues.slice(0,5).join("・")}${venues.length>5?"ほか":""}）`:"開催データを確認中";
 const picks=[ichika,hatsune,kiina].filter(Boolean).map(r=>`${courseName(safeEvents,r)}${r.race_no}R`).join("・");
 const plan=[
  {key:"official-morning",account:"official",category:"news",time:"08:15",body:`🚤 今日のBoatStrikers\n\n【開催】${venueText}\n【注目】3キャラの候補を確定データから順次公開します。\n\n一果＝イン逃げ\n初音＝女子戦\nキイナ＝穴・5アタマ\n\n#BoatStrikers #ボートレース`,content_type:"official"},
  {key:"ichika-talk",account:"ichika",category:"character_chat",time:"10:15",body:charBody("ichika",ichika,safeEvents),content_type:"chat"},
  {key:"hatsune-talk",account:"hatsune",category:"character_chat",time:"12:15",body:charBody("hatsune",hatsune,safeEvents),content_type:"chat"},
  {key:"kiina-talk",account:"kiina",category:"character_chat",time:"14:15",body:charBody("kiina",kiina,safeEvents),content_type:"chat"},
  {key:"official-evening",account:"official",category:"news",time:"20:30",body:`📊 今日の注目3R\n\n${picks||"各キャラの候補データを確認中です。"}\n\n一果・初音・キイナ、それぞれ違う目線で選んだ3レースです。\n結果確定後はDATA LABで振り返ります。\n\n#BoatStrikers #ボートレース`,content_type:"official"}
 ];
 for(const p of plan){
  const ref={kind:"x_daily_plan",id:`${date}:${p.key}`,post_date:date,slot:p.key,content_type:p.content_type,data_source:"bs_race_events+ai_v2_daily_rankings",copy_version:"three-part-v1"};
  const {data:rows,error:findError}=await supabase.from("bs_x_post_drafts").select("id,status,source_refs").eq("source_kind","x_daily_plan").eq("account_code",p.account).limit(50);
  if(findError){errors.push(findError.message);continue}
  const existing=(rows||[]).find(r=>Array.isArray(r.source_refs)&&r.source_refs.some(x=>x?.id===ref.id));
  if(existing){
   if(existing.status==="posted"){skipped++;continue}
   const {error}=await supabase.from("bs_x_post_drafts").update({category:p.category,body:p.body,scheduled_at:isoJst(date,p.time),source_refs:[ref],updated_at:new Date().toISOString()}).eq("id",existing.id);
   if(error)errors.push(`${p.account}: ${error.message}`);else updated++;
   continue;
  }
  const {error}=await supabase.from("bs_x_post_drafts").insert({post_date:date,account_code:p.account,category:p.category,body:p.body,status:"draft",scheduled_at:isoJst(date,p.time),source_kind:"x_daily_plan",source_refs:[ref],updated_at:new Date().toISOString()});
  if(error)errors.push(`${p.account}: ${error.message}`);else created++;
 }
 revalidatePath("/admin/x-posts");
 const message=errors.length?`${created}件作成・${updated}件更新 / ${errors.join(" / ").slice(0,500)}`:`1日分 ${created}件作成・${updated}件更新・${skipped}件投稿済みスキップ`;
 redirect(`/admin/x-posts?gen=${errors.length?"error":"ok"}&created=${created}&skipped=${skipped}&message=${encodeURIComponent(message)}`);
}
