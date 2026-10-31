import {lookup} from 'node:dns/promises';
import tls from 'node:tls';
import https from 'node:https';
const targets=[['www.boatrace.jp','/owpc/pc/race/index?hd=20261031'],['www.gamagori-kyotei.com','/'],['www.boatrace.jp','/owsp/sp/race/index?hd=20261031']];
const safeCode=e=>String(e?.code??e?.name??'error').replace(/[^A-Z_a-z0-9]/g,'').slice(0,40);
function deadline(p,ms){let t;return Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Object.assign(Error('timeout'),{code:'PROBE_TIMEOUT'})),ms)})]).finally(()=>clearTimeout(t));}
function tlsProbe(host,address){return new Promise(resolve=>{const start=Date.now();const socket=tls.connect({host:address.address,port:443,servername:host,rejectUnauthorized:true,family:4});
 const t=setTimeout(()=>{socket.destroy();resolve({ok:false,code:'TLS_TIMEOUT',ms:Date.now()-start})},2500);
 socket.once('secureConnect',()=>{clearTimeout(t);const result={ok:socket.authorized,protocol:socket.getProtocol(),ms:Date.now()-start};socket.destroy();resolve(result)});
 socket.once('error',e=>{clearTimeout(t);resolve({ok:false,code:safeCode(e),ms:Date.now()-start})});});}
function httpProbe(host,path,address){return new Promise(resolve=>{const start=Date.now();let finished=false;
 const done=r=>{if(!finished){finished=true;clearTimeout(t);resolve({...r,ms:Date.now()-start})}};
 const req=https.get({hostname:host,path,servername:host,family:4,lookup:(_host,options,cb)=>options?.all?cb(null,[{address:address.address,family:4}]):cb(null,address.address,4),headers:{'User-Agent':'BoatStrikers bounded network diagnostic (boat-strike.online)'}},res=>{done({status:res.statusCode});res.destroy();});
 const t=setTimeout(()=>{done({code:'HTTP_TIMEOUT'});req.destroy()},4000);req.on('error',e=>done({code:safeCode(e)}));});}
export async function gamagoriNetworkDiagnostic(){const results=[];for(const [host,path] of targets){const row={host,path};const start=Date.now();try{row.dns={addresses:await deadline(lookup(host,{all:true}),2000),ms:Date.now()-start};
 const address=row.dns.addresses.find(a=>a.family===4&&!/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address));
 if(address){row.tls4=await tlsProbe(host,address);row.https4=await httpProbe(host,path,address);}else row.skipped='no_public_ipv4';
 }catch(e){row.dns={code:safeCode(e),ms:Date.now()-start}}results.push(row)}return {region:process.env.VERCEL_REGION??'unknown',environment:process.env.VERCEL_ENV??'unknown',results};}

