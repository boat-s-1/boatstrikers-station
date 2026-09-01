// First available valid field is usable immediately. Later valid corrections may
// replace it; this deliberately does not freeze the first value forever.
export const DISPLAY_METRICS = [
  ['exhibition_time','official_exhibition_time'],
  ['lap_time','official_lap'], ['turn_time','official_turn'],
  ['straight_time','official_straight'], ['half_lap_time','official_half_lap'],
];
export function positiveTime(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (String(value).trim()==='') return null;
  const n=Number(value);
  return Number.isFinite(n) && n>0 ? n : null;
}
function time(value) { const n=value ? Date.parse(value) : NaN; return Number.isFinite(n) ? n : null; }

// A venue's own verified measurement is authoritative. PC-KYOTEI remains
// immediately usable while the venue value is missing, followed by the
// secondary web/API sources. Timestamps only decide between equal-priority
// observations (for example, a corrected official value).
export function exhibitionSourcePriority(value) {
  const source=String(value || '').trim().toLowerCase();
  if (/pc[-_ ]?ky[o]?utei|pc[-_ ]?kyotei/.test(source)) return 300;
  if (source.includes('official') || source === '公式') return 400;
  if (source.includes('boaters')) return 200;
  if (source.includes('api')) return 100;
  return 0;
}
export function selectExhibitionField(row, official, general) {
  if (row.exhibition_display_fields?.[general]) return row.exhibition_display_fields[general];
  const candidates=[official,general].map(field=>{
    const value=positiveTime(row[field]); if(value===null)return null;
    const meta=row.exhibition_field_meta?.[field];
    const verifiedMeta=meta && positiveTime(meta.value)===value ? meta : null;
    const isOfficial=field===official;
    const updatedAt=verifiedMeta ? verifiedMeta.updated_at : isOfficial ? row.official_exhibition_synced_at : row.exhibition_synced_at;
    return {value,field,source:verifiedMeta?.source || (isOfficial ? row.official_exhibition_source : row.exhibition_source || row.data_source) || 'unknown',updatedAt:time(updatedAt)===null ? null : updatedAt};
  }).filter(Boolean);
  candidates.sort((a,b)=>
    exhibitionSourcePriority(b.source)-exhibitionSourcePriority(a.source)
    || (time(b.updatedAt)??-Infinity)-(time(a.updatedAt)??-Infinity)
  );
  return candidates[0] || null;
}
export function resolveExhibition(row) {
  const result={exhibition_display_fields:{}};
  for(const [general,official] of DISPLAY_METRICS){
    const chosen=selectExhibitionField(row,official,general);
    result[general]=chosen?.value??null;
    result[official]=chosen?.value??null;
    result.exhibition_display_fields[general]=chosen;
  }
  const selected=Object.values(result.exhibition_display_fields).filter(Boolean);
  result.exhibition_source=[...new Set(selected.map(field=>field.source))].join(' / ') || null;
  const timestamps=selected.map(field=>time(field.updatedAt)).filter(value=>value!==null);
  result.exhibition_synced_at=timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  return result;
}
export function isExhibitionReady(entries) {
  return Array.isArray(entries) && entries.length===6 && new Set(entries.map(row=>Number(row.boat_no))).size===6 && entries.every(row=>Number.isInteger(Number(row.boat_no)) && Number(row.boat_no)>=1 && Number(row.boat_no)<=6 && positiveTime(row.exhibition_time)!==null);
}
