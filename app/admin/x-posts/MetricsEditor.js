"use client";

import { saveXMetrics } from "./metrics-actions";

export default function MetricsEditor({post,metric}){
 if(post.status!=="posted")return null;
 const m=metric||{};
 return <details style={{marginTop:10}}>
  <summary style={{cursor:"pointer",fontWeight:700}}>X反応を記録</summary>
  <form action={saveXMetrics} style={{display:"grid",gap:8,marginTop:10}}>
   <input type="hidden" name="draft_id" value={post.id}/>
   <input type="hidden" name="account_code" value={post.account_code}/>
   <input type="hidden" name="category" value={post.category}/>
   <input type="hidden" name="post_date" value={(post.posted_at||post.created_at||"").slice(0,10)}/>
   <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:8}}>
    <label>表示回数<input name="impressions" type="number" min="0" defaultValue={m.impressions||0}/></label>
    <label>いいね<input name="likes" type="number" min="0" defaultValue={m.likes||0}/></label>
    <label>リポスト<input name="reposts" type="number" min="0" defaultValue={m.reposts||0}/></label>
    <label>返信<input name="replies" type="number" min="0" defaultValue={m.replies||0}/></label>
    <label>ブックマーク<input name="bookmarks" type="number" min="0" defaultValue={m.bookmarks||0}/></label>
    <label>プロフィール遷移<input name="profile_visits" type="number" min="0" defaultValue={m.profile_visits||0}/></label>
    <label>リンククリック<input name="link_clicks" type="number" min="0" defaultValue={m.link_clicks||0}/></label>
    <label>フォロー増<input name="follows" type="number" min="0" defaultValue={m.follows||0}/></label>
   </div>
   <textarea name="notes" rows={2} defaultValue={m.notes||""} placeholder="メモ（画像あり、予想投稿、キャンペーン等）"/>
   <button type="submit">反応を保存</button>
  </form>
 </details>;
}
