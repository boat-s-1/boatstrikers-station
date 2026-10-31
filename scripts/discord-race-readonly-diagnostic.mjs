#!/usr/bin/env node
// Read-only Discord API diagnostics. Run manually in an authorized, isolated environment.
// Never prints credentials, webhook tokens, member lists, or message bodies.
const token=process.env.DISCORD_BOT_TOKEN;
const guildId=process.env.DISCORD_GUILD_ID;
if(!token||!guildId){
  console.error("Missing DISCORD_BOT_TOKEN or DISCORD_GUILD_ID");
  process.exitCode=2;
}else{
  const base="https://discord.com/api/v10";
  const get=async(endpoint)=>{
    const response=await fetch(base+endpoint,{
      method:"GET",
      headers:{Authorization:`Bot ${token}`},
      signal:AbortSignal.timeout(10000),
      cache:"no-store"
    });
    if(!response.ok)throw new Error(`Discord GET failed (HTTP ${response.status})`);
    return response.json();
  };
  try{
    const channels=await get(`/guilds/${encodeURIComponent(guildId)}/channels`);
    const matches=channels.filter(c=>c.type===0&&c.name==="レース実況");
    console.log(JSON.stringify({check:"race_chat_channel",count:matches.length,ok:matches.length===1}));
    if(matches.length!==1)process.exitCode=1;
    else{
      const parent=matches[0];
      const active=await get(`/guilds/${encodeURIComponent(guildId)}/threads/active`);
      const threads=Array.isArray(active?.threads)?active.threads:[];
      const owned=threads.filter(t=>String(t.parent_id)===String(parent.id));
      console.log(JSON.stringify({check:"active_threads",count:owned.length,ok:true}));
      const threadId=process.env.DISCORD_DIAGNOSTIC_THREAD_ID;
      if(threadId){
        // The supplied ID is checked independently; a matching name is never enough.
        const thread=await get(`/channels/${encodeURIComponent(threadId)}`);
        const match=String(thread?.id)===threadId&&
          String(thread?.parent_id)===String(parent.id)&&
          thread?.type===11&&thread?.thread_metadata?.archived===false;
        console.log(JSON.stringify({check:"specific_thread",idMatches:String(thread?.id)===threadId,parentMatches:String(thread?.parent_id)===String(parent.id),typeMatches:thread?.type===11,active:thread?.thread_metadata?.archived===false,ok:match}));
        if(!match)process.exitCode=1;
      }
    }
  }catch(e){
    // Error details from Discord may contain private server data: do not print them.
    console.error(e instanceof Error?e.message:"Discord read-only diagnostic failed");
    process.exitCode=1;
  }
}
