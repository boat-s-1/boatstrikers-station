import {notFound} from 'next/navigation';
import ValidationPanel from './validation-panel';
export const dynamic='force-dynamic';
export default function Page(){
 if(process.env.VERCEL_ENV!=='preview'||process.env.VERCEL_GIT_COMMIT_REF!=='feature/gamagori-chart-collector')notFound();
 return <ValidationPanel/>;
}
