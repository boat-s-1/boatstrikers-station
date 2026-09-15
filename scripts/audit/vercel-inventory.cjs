/* Reproducible static inventory of committed HEAD; candidates require human review. */
const fs=require('fs'),cp=require('child_process');
const {parser}=require('next/dist/compiled/babel/bundle');
const files=cp.execFileSync('git',['ls-files'],{encoding:'utf8'}).trim().split('\n');
const sources=files.filter(f=>/\.[cm]?[jt]sx?$/.test(f));
const fetches=[],references=[],dynamic=[],triggers=[],routes=[],errors=[];
for(const file of sources){
 const source=cp.execFileSync('git',['show',`HEAD:${file}`],{encoding:'utf8',maxBuffer:10000000});
 let ast;try{ast=parser().parse(source,{sourceType:'unambiguous',plugins:['jsx',...( /\.tsx?$/.test(file)?['typescript']:[])]});}catch(e){errors.push({file,error:e.message});continue;}
 const client=/^[\s]*["']use client["']/.test(source);
 const rec={file,path:'/'+file.replace(/^app\//,'').replace(/\/route\.[jt]s$/,''),methods:[],config:[],client,authSignals:[]};
 for(const n of ast.program.body){if(n.type==='ExportNamedDeclaration'){
  const d=n.declaration;if(d?.id&&/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(d.id.name))rec.methods.push(d.id.name);
  for(const x of d?.declarations||[]){if(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(x.id.name))rec.methods.push(x.id.name);if(/^(dynamic|revalidate|runtime|fetchCache)$/.test(x.id.name))rec.config.push(source.slice(x.start,x.end));}
  for(const s of n.specifiers||[])if(/^(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)$/.test(s.exported?.name))rec.methods.push(s.exported.name);
 }}
 const walk=n=>{if(!n||typeof n!=='object')return;
  if(n.type==='CallExpression'){
   const name=source.slice(n.callee.start,n.callee.end),code=source.slice(n.start,n.end).replace(/\s+/g,' ').slice(0,500),line=n.loc.start.line;
   if(name==='fetch'||name.endsWith('.fetch'))fetches.push({file,line,context:client?'client':'server/script',code});
   if(/(^|\.)(setInterval|setTimeout|onAuthStateChange|addEventListener)$/.test(name)||/^router\.(refresh|push|replace)$/.test(name))triggers.push({file,line,code});
  }
  if(n.type==='StringLiteral'||n.type==='TemplateLiteral'){
   const value=n.type==='StringLiteral'?n.value:n.quasis.map(x=>x.value.cooked).join('${*}');
   if(value?.includes('/api/'))references.push({file,line:n.loc.start.line,value:value.slice(0,600)});
  }
  for(const [k,v] of Object.entries(n)){if(['loc','extra'].includes(k))continue;if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
 };walk(ast.program);
 source.split('\n').forEach((s,i)=>{if(/force-dynamic|revalidate\s*=\s*0|no-store|unstable_noStore|\bcookies\s*\(|\bheaders\s*\(/.test(s))dynamic.push({file,line:i+1,code:s.trim().slice(0,350)});});
 if(/^app\/api\/.*\/route\.[jt]s$/.test(file)){
 rec.authSignals=[...new Set(source.match(/CRON_SECRET|ADMIN_[A-Z_]+|getUser|require\w+|assert\w+|authorization|cookies\(|verify\w+|service_role|SERVICE_ROLE/gi)||[])];
 rec.imports=[...source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)].map(x=>x[1]);
 rec.dynamicSignals=dynamic.filter(x=>x.file===file);routes.push(rec);
 }
}
const cron=JSON.parse(cp.execFileSync('git',['show','HEAD:vercel.json'],{encoding:'utf8'})).crons||[];
for(const r of routes){
 const parts=r.path.split('/');
 r.callers=references.filter(x=>{const path=x.value.split('?')[0];return x.file!==r.file&&(path===r.path|| (path.startsWith('/')&&path.split('/').length===parts.length&&parts.every((p,i)=>p.startsWith('[')||path.split('/')[i]===p)));});
 r.internalImporters=routes.filter(x=>x.imports.some(y=>y.includes(r.file.replace(/^app\//,'').replace(/\.js$/,'')))).map(x=>x.file);
 r.schedules=cron.filter(x=>x.path.split('?')[0]===r.path).map(x=>x.schedule);
 r.rendering=r.config.join('; ')||(r.methods.some(x=>x!=='GET')?'non-GET executes per request; GET defaults per installed Next version':'GET: Next 16 default dynamic; inspect response cache');
 r.cache=r.methods.some(x=>x!=='GET')?'Mutations: no shared response cache':r.authSignals.length?'Auth signals: do not share until authorization/data reviewed':'Public candidate: verify query, freshness and side effects';
}
const out={base:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),counts:{routes:routes.length,fetches:fetches.length,dynamicCandidates:dynamic.length,triggers:triggers.length,parsed:sources.length-errors.length},errors,routes,fetches,dynamic,triggers,cron};
fs.mkdirSync('docs/vercel-usage',{recursive:true});fs.writeFileSync('docs/vercel-usage/source-inventory.json',JSON.stringify(out,null,2)+'\n');
const esc=s=>String(s).replace(/\|/g,'\\|').replace(/\n/g,' ');
let md='# 全Route Handler・取得・再実行候補一覧\n\n基準コミット: `'+out.base+'`。静的解析結果。authSignals は認証実施の保証ではなく要確認の検出語。呼び出し元なしは未使用を意味しない。外部ジョブ、動的URL、ブラウザ直アクセスは補足監査が必要。GET既定値は固定ロックファイルがないため、検証環境のNext 16を基準とする。\n\n| API / ファイル | メソッド | 呼び出し元 | dynamic/static | 頻度要因 | キャッシュ可否 | 認証依存・確認語 |\n|---|---|---|---|---|---|---|\n';
for(const r of routes)md+='| '+[r.path+' (`'+r.file+'`)',r.methods.join('/'),r.callers.map(x=>x.file+':'+x.line).join('<br>')||'静的参照なし。外部呼び出しを確認',r.rendering,r.schedules.length?'Cron '+r.schedules.join(', '):r.callers.some(x=>/components|page|Client/.test(x.file))?'UIマウント・操作。下記再実行候補参照':'操作・外部ジョブ。実測ログ照合が必要',r.cache,r.authSignals.join(', ')||'検出語なし（認証不要の保証ではない）'].map(esc).join(' | ')+' |\n';
for(const [title,rows] of [['全fetch()',fetches],['dynamic化候補（同名の非Next関数を含む）',dynamic],['タイマー・認証・イベント・router候補',triggers]]){md+='\n## '+title+'\n\n| ファイル:行 | コード |\n|---|---|\n';for(const x of rows)md+='| '+esc(x.file+':'+x.line)+' | `'+esc(x.code).replace(/`/g,"'")+'` |\n';}
fs.writeFileSync('docs/vercel-usage/inventory.md',md);console.log(JSON.stringify(out.counts));console.log(JSON.stringify(errors));
