"use client";

import { useState } from "react";
import { saveDraft, markPosted } from "./actions";

export default function PostEditor({ post, accounts }) {
  const [body, setBody] = useState(post?.body || "");
  const copy = async () => { if (body) await navigator.clipboard.writeText(body); };
  return (
    <form action={saveDraft} style={{display:"grid",gap:8}}>
      {post?.id ? <input type="hidden" name="id" value={post.id} /> : null}
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <select name="account" defaultValue={post?.account_code || "official"}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select name="category" defaultValue={post?.category || "prediction"}><option value="prediction">予想</option><option value="result">結果</option><option value="news">NEWS</option><option value="data_lab">DATA LAB</option><option value="character_chat">会話・小ネタ</option><option value="beginner">初心者講座</option><option value="announcement">告知</option></select>
        <select name="status" defaultValue={post?.status || "draft"}><option value="draft">下書き</option><option value="review">確認待ち</option><option value="ready">投稿準備OK</option><option value="posted">投稿済み</option></select>
        <input name="scheduled_at" type="datetime-local" defaultValue={post?.scheduled_local || ""} />
      </div>
      <textarea name="body" value={body} onChange={e=>setBody(e.target.value)} rows={6} maxLength={1000} placeholder="投稿本文" style={{width:"100%",padding:12,borderRadius:12}} />
      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        <button type="submit">保存</button>
        <button type="button" onClick={copy}>コピー</button>
        {post?.id && post.status !== "posted" ? <button formAction={markPosted} name="id" value={post.id}>投稿済みにする</button> : null}
        <small>{body.length}文字</small>
      </div>
    </form>
  );
}
