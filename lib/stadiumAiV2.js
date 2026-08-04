import 'server-only';
import { createClient } from '@supabase/supabase-js';

export const STADIUMS = [
  [1,'kiryu','桐生','BOAT RACE KIRYU'],[2,'toda','戸田','BOAT RACE TODA'],[3,'edogawa','江戸川','BOAT RACE EDOGAWA'],[4,'heiwajima','平和島','BOAT RACE HEIWAJIMA'],
  [5,'tamagawa','多摩川','BOAT RACE TAMAGAWA'],[6,'hamanako','浜名湖','BOAT RACE HAMANAKO'],[7,'gamagori','蒲郡','BOAT RACE GAMAGORI'],[8,'tokoname','常滑','BOAT RACE TOKONAME'],
  [9,'tsu','津','BOAT RACE TSU'],[10,'mikuni','三国','BOAT RACE MIKUNI'],[11,'biwako','びわこ','BOAT RACE BIWAKO'],[12,'suminoe','住之江','BOAT RACE SUMINOE'],
  [13,'amagasaki','尼崎','BOAT RACE AMAGASAKI'],[14,'naruto','鳴門','BOAT RACE NARUTO'],[15,'marugame','丸亀','BOAT RACE MARUGAME'],[16,'kojima','児島','BOAT RACE KOJIMA'],
  [17,'miyajima','宮島','BOAT RACE MIYAJIMA'],[18,'tokuyama','徳山','BOAT RACE TOKUYAMA'],[19,'shimonoseki','下関','BOAT RACE SHIMONOSEKI'],[20,'wakamatsu','若松','BOAT RACE WAKAMATSU'],
  [21,'ashiya','芦屋','BOAT RACE ASHIYA'],[22,'fukuoka','福岡','BOAT RACE FUKUOKA'],[23,'karatsu','唐津','BOAT RACE KARATSU'],[24,'omura','大村','BOAT RACE OMURA']
].map(([courseCode,slug,name,englishName])=>({courseCode,slug,name,englishName}));

const ALIASES={
  '桐生':'kiryu','戸田':'toda','江戸川':'edogawa','平和島':'heiwajima','多摩川':'tamagawa','浜名湖':'hamanako','蒲郡':'gamagori','常滑':'tokoname','津':'tsu','三国':'mikuni','びわこ':'biwako','住之江':'suminoe','尼崎':'amagasaki','鳴門':'naruto','丸亀':'marugame','児島':'kojima','宮島':'miyajima','徳山':'tokuyama','下関':'shimonoseki','若松':'wakamatsu','芦屋':'ashiya','福岡':'fukuoka','唐津':'karatsu','大村':'omura'
};
export function resolveStadium(value){const decoded=decodeURIComponent(value||'kiryu');const slug=ALIASES[decoded]||decoded;return STADIUMS.find(x=>x.slug===slug)||STADIUMS[0];}
function supabase(){const url=process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})}
export async function getStadiumAiV2(value){const stadium=resolveStadium(value);const sb=supabase();if(!sb)return {stadium,payload:null,error:'Supabase環境変数が未設定です。'};const {data,error}=await sb.from('stadium_ai_snapshots_v2').select('*').eq('course_code',stadium.courseCode).maybeSingle();return {stadium,payload:data?.payload||null,generatedAt:data?.generated_at||null,error:error?.message||null};}
export function premiumPreview(sp){return process.env.STADIUM_PREMIUM_PREVIEW==='true'||sp?.preview==='premium'}
