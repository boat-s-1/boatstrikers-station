import {createHash} from 'node:crypto';
// Read-only inspection; never constructs a database client or saves partial charts.
export async function probeGamagoriPublication({date,race,parse,fetcher=fetch}) {
 const source=`https://www.gamagori-kyotei.com/asp/gamagori/sp/kyogi/kyogihtml/recomend/recomend${date.replaceAll('-','')}07${String(race).padStart(2,'0')}.htm`;
 let response;try{response=await fetcher(source,{signal:AbortSignal.timeout(5000),redirect:'error',cache:'no-store'});}catch{return {source_url:source,state:'unknown',reason:'chart_network_or_timeout'};}
 if(!response.ok){await response.body?.cancel();return {source_url:source,state:[404,410].includes(response.status)?'unpublished':'unknown',http_status:response.status};}
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>400000){await reader.cancel();return {source_url:source,state:'unknown',reason:'chart_too_large'};}chunks.push(value);}}catch{return {source_url:source,state:'unknown',reason:'chart_network_or_timeout'};}
 const html=new TextDecoder().decode(Buffer.concat(chunks)),base={source_url:source,http_status:response.status,html_sha256:createHash('sha256').update(html).digest('hex')};
 try{const marks=parse(html);if(marks.length!==6||new Set(marks.map(m=>m.boat_no)).size!==6)throw Error('incomplete');return {...base,state:'published_complete',boats:6};}
 catch{const chart=html.replace(/<!--[\s\S]*?-->/g,'').match(/<div\b[^>]*id=["']chart["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]??'';return {...base,state:'unpublished_or_invalid',marker_count:[...chart.matchAll(/<img\b[^>]*src=["'][^"']*taka_[1-6]M(?:_up|_down)?\.png["']/gi)].length};}
}
