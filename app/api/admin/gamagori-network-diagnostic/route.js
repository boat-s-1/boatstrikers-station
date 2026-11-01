import {gamagoriAuthorized} from '../../../../lib/gamagori-chart-http.mjs';
import {gamagoriNetworkDiagnostic} from '../../../../lib/gamagori-network-diagnostic.mjs';
export const runtime='nodejs';export const dynamic='force-dynamic';export const maxDuration=30;
export async function GET(request){
 if(process.env.VERCEL_ENV!=='preview')return Response.json({error:'not_available'},{status:404});
 if(!gamagoriAuthorized(request))return Response.json({error:'unauthorized'},{status:401});
 return Response.json(await gamagoriNetworkDiagnostic(),{headers:{'Cache-Control':'private, no-store'}});
}
