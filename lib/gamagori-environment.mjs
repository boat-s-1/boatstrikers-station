import {gamagoriDatabaseOptions} from './gamagori-chart-http.mjs';
const production='rzosrbkyniyedolhkgxo',branch='feature/gamagori-chart-collector';
export function gamagoriIsolationConfiguration(env){
 if(env.VERCEL_ENV!=='preview'||env.VERCEL_GIT_COMMIT_REF!==branch)throw Error('gamagori_preview_scope_required');
 const project=env.GAMAGORI_EXPECTED_PROJECT_REF,url=env.GAMAGORI_SUPABASE_URL,key=env.GAMAGORI_SUPABASE_SERVICE_ROLE_KEY;
 if(!/^[a-z]{20}$/.test(project??'')||project===production||url!==`https://${project}.supabase.co`||!key)throw Error('gamagori_isolated_configuration_missing');
 // Never fall back to the shared NEXT_PUBLIC_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.
 return {project,url,key};
}
export async function createIsolatedGamagoriClient(createClient,env=process.env){
 const config=gamagoriIsolationConfiguration(env),db=createClient(config.url,config.key,gamagoriDatabaseOptions());
 const {data,error}=await db.rpc('bsc_gamagori_environment_attestation');
 if(error||!data||data.project_ref!==config.project||data.stage!=='isolated'||data.fixture_references!==false||data.authoritative_meeting_rpc!==true||data.collector_read_schema_matches!==true||data.shared_source_writes_disabled!==true)throw Error('gamagori_database_attestation_failed');
 return db;
}
