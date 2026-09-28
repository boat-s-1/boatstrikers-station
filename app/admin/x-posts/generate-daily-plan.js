"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function db(){return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})}
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Tokyo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function isoJst(date,time){return new Date(`${date}T${time}:00+09:00`).toISOString()}
function grade(p){if(!Number.isFinite(p))return null;if(p>=.75)return"S";if(p>=.55)return"A";if(p>=.35)return"B";return"C"}
function clean(text){return String(text||"").replace(/AI\s*v?\d+(?:\.\d+)?/gi,"").replace(/shadow|model|raw|score/gi,"").replace(/\b\d+(?:\.\d+)?%\b/g,"").replace(/\s{2,}/g," ").trim()}
function seed(value){return String(value||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0)}
function variant(items,key){return items[seed(key)%items.length]}
function pick(rows,code){const list=rows.filter(r=>r.character_code===code);return list.find(r=>r.selected_for_social)||list[0]||null}
function courseName(events,row){const e=events.find(x=>String(x.course_code)===String(row?.course_code)&&Number(x.race_no)===Number(row?.race_no));return e?.course_name||`場コード${String(row?.course_code||"").padStart(2,"0")}`}
function charMeta(code,key){
 const all={
  ichika:{icon:"🌱",name:"一果",label:"イン逃げ注目",conclusions:["【結論】インを軸に見るなら、今日はここが気になります。","【結論】1号艇から考えるなら、まずここを見たいです。","【結論】今日のイン候補で最初に確認したいのはこの一戦。"],reasons:["【理由】1号艇だからだけでは決めず、相手関係とスタート気配まで見たい一戦です。","【理由】イン有利だけでなく、相手構成と直前のスタート気配まで合わせて判断したいです。","【理由】逃げ前提にせず、相手関係と直前気配が噛み合うかを確認したいレースです。"],closes:["【ひとこと】直前気配まで見て、インを信頼できるか最終確認します。","【ひとこと】最後は展示とスタートを見て、逃げを任せられるか決めます🌱","【ひとこと】前日評価だけで決めず、直前までインの信頼度を見直します。"]},
  hatsune:{icon:"🐰",name:"初音",label:"女子戦注目",conclusions:["【結論】女子戦なら、今日はここをチェックしたいです。","【結論】今日の女子戦で気になるのはこのレースです。","【結論】女子戦から一つ選ぶなら、まずここを見ます🐰"],reasons:["【理由】近況だけでなく、展示とスタート気配まで含めて見たい一戦です。","【理由】名前や人気だけではなく、近況とスタート気配のバランスを確認したいです。","【理由】女子戦は流れが変わりやすいので、展示まで見て判断したいレースです。"],closes:["【ひとこと】直前まで変化を追って、もう一度チェックします🐰","【ひとこと】展示が出たら、前日評価から変化がないか見直します。","【ひとこと】スタート気配まで確認してから最終判断します🐰"]},
  kiina:{icon:"⭐",name:"キイナ",label:"穴狙い注目",conclusions:["【結論】穴目線なら、今日はここが気になります。","【結論】人気どおりで決まるか疑って見たいのはここ⭐","【結論】穴を探すなら、この一戦は外したくないです。"],reasons:["【理由】高配当だからではなく、人気との差がありそうな材料を探したいレースです。","【理由】配当だけを追わず、人気と実力評価のズレがあるかを見たい一戦です。","【理由】穴狙いは人気薄そのものではなく、人気との差がある材料があるかが大事です。"],closes:["【ひとこと】オッズと展示を見て、狙える穴か最後まで見極めます⭐","【ひとこと】最後はオッズとのバランス。買う価値がある穴かを見ます。","【ひとこと】展示で気配が上がれば、穴としてもう一段注目します⭐"]}
 };
 const m=all[code];return {...m,conclusion:variant(m.conclusions,key),reason:variant(m.reasons,key+"r"),close:variant(m.closes,key+"c")};
}
function charBody(code,row,events,date){
 const key=`${date}:${code}:${row?.id||row?.race_no||"none"}`,meta=charMeta(code,key);
 if(!row)return `${meta.icon} ${meta.name}です。\n\n今日はまだ投稿候補データが揃っていないので、確定データが入ってから注目レースを更新します。\n\n#BoatStrikers #ボートレース`;
 const c=courseName(events,row),g=grade(Number(row.probability)),comment=clean(row.social_comment||row.summary);
 const reasonDetail=comment&&comment.length>=8?`【データメモ】${comment}`:null;
 return [`${meta.icon} ${meta.name}です。`,"",meta.conclusion,`${c}${row.race_no}R${g?`｜${meta.label}【${g}】`:""}`,"",meta.reason,reasonDetail,"",meta.close,"","#BoatStrikers #ボートレース"].filter(v=>v!==null).join("\n");
}
function refObject(refs){return Array.isArray(refs)?refs[0]:refs}

export async function generateDailyPlan(){
 const supabase=db(),date=today();let created=0,updated=0,skipped=0,predictionUpdated=0;const errors=[];
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
 const morningLead=variant(["🚤 今日のBoatStrikers","🚤 今日のボートレース、ここからチェック","🚤 BoatStrikers 朝のチェックポイント"],date+"morning");
 const eveningLead=variant(["📊 今日の注目3R","📊 今日のBoatStrikers注目まとめ","📊 3人の今日の注目をまとめます"],date+"evening");
 const plan=[
  {key:"official-morning",account:"official",category:"news",time:"08:15",body:`${morningLead}\n\n【開催】${venueText}\n【見るポイント】一果＝イン逃げ / 初音＝女子戦 / キイナ＝穴・5アタマ\n\n確定データから今日の注目を順次更新します。\n\n#BoatStrikers #ボートレース`,content_type:"official"},
  {key:"ichika-talk",account:"ichika",category:"character_chat",time:"10:15",body:charBody("ichika",ichika,safeEvents,date),content_type:"chat"},
  {key:"hatsune-talk",account:"hatsune",category:"character_chat",time:"12:15",body:charBody("hatsune",hatsune,safeEvents,date),content_type:"chat"},
  {key:"kiina-talk",account:"kiina",category:"character_chat",time:"14:15",body:charBody("kiina",kiina,safeEvents,date),content_type:"chat"},
  {key:"official-evening",account:"official",category:"news",time:"20:30",body:`${eveningLead}\n\n${picks||"各キャラの候補データを確認中です。"}\n\n結果確定後はDATA LABで振り返ります。\n\n#BoatStrikers #ボートレース`,content_type:"official"}
 ];
 for(const p of plan){
  const ref={kind:"x_daily_plan",id:`${date}:${p.key}`,post_date:date,slot:p.key,content_type:p.content_type,data_source:"bs_race_events+ai_v2_daily_rankings",copy_version:"character-v4"};
  const {data:rows,error:findError}=await supabase.from("bs_x_post_drafts").select("id,status,source_refs").eq("source_kind","x_daily_plan").eq("account_code",p.account).limit(50);
  if(findError){errors.push(findError.message);continue}
  const existing=(rows||[]).find(r=>Array.isArray(r.source_refs)&&r.source_refs.some(x=>x?.id===ref.id));
  if(existing){if(existing.status==="posted"){skipped++;continue}const {error}=await supabase.from("bs_x_post_drafts").update({category:p.category,body:p.body,scheduled_at:isoJst(date,p.time),source_refs:[ref],updated_at:new Date().toISOString()}).eq("id",existing.id);if(error)errors.push(`${p.account}: ${error.message}`);else updated++;continue}
  const {error}=await supabase.from("bs_x_post_drafts").insert({post_date:date,account_code:p.account,category:p.category,body:p.body,status:"draft",scheduled_at:isoJst(date,p.time),source_kind:"x_daily_plan",source_refs:[ref],updated_at:new Date().toISOString()});
  if(error)errors.push(`${p.account}: ${error.message}`);else created++;
 }
 const {data:predictionDrafts,error:predictionError}=await supabase.from("bs_x_post_drafts").select("id,account_code,status,source_refs").eq("post_date",date).eq("source_kind","ai_v2_daily_rankings").in("account_code",["ichika","hatsune","kiina"]);
 if(predictionError)errors.push(`予想下書き更新: ${predictionError.message}`);else{
  for(const post of predictionDrafts||[]){if(post.status==="posted")continue;const ref=refObject(post.source_refs);if(!ref)continue;const row=safeRankings.find(r=>String(r.id)===String(ref.id))||{...ref,character_code:post.account_code};const body=charBody(post.account_code,row,safeEvents,date);const nextRef={...ref,copy_version:"character-v4",last_refresh_at:new Date().toISOString(),data_timing:row.data_timing||ref.data_timing||null};const {error}=await supabase.from("bs_x_post_drafts").update({body,source_refs:[nextRef],updated_at:new Date().toISOString()}).eq("id",post.id);if(error)errors.push(`${post.account_code}予想更新: ${error.message}`);else predictionUpdated++}
 }
 revalidatePath("/admin/x-posts");
 const message=errors.length?`${created}件作成・${updated}件更新・予想${predictionUpdated}件更新 / ${errors.join(" / ").slice(0,500)}`:`1日分 ${created}件作成・${updated}件更新・予想${predictionUpdated}件更新・${skipped}件投稿済みスキップ`;
 redirect(`/admin/x-posts?gen=${errors.length?"error":"ok"}&created=${created}&skipped=${skipped}&message=${encodeURIComponent(message)}`);
}
