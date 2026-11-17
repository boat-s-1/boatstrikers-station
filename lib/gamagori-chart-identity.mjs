export function gamagoriOfficialCourses(html){
 const s=String(html).replace(/<!--[\s\S]*?-->/g,''),boats=new Map();
 for(const m of s.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const course=m[1].match(/<td\b[^>]*class=["']cho_course["'][^>]*>\s*([1-6])\s*<\/td>/i)?.[1];
  if(!course)continue;const boat=m[1].match(/<td\b[^>]*class=["']cho_waku\s+r([1-6])["'][^>]*>\s*\1\s*<\/td>/i)?.[1];
  if(!boat||boats.has(Number(boat))&&boats.get(Number(boat))!==Number(course))throw Error('chart_course_conflict');boats.set(Number(boat),Number(course));
 }
 if(boats.size!==6||new Set(boats.values()).size!==6)throw Error('chart_courses_incomplete');return boats;
}
export function verifyObservedGamagoriChart(html,{date,race,observation,parse}){
 const clean=html.replace(/<!--[\s\S]*?-->/g,''),entries=observation.boats;
 const days=[...clean.matchAll(/<script\b[^>]*src=["'][^"']*\/KekkaRaceNum(\d{8})07\.js(?:\?[^"']*)?["']/gi)].map(m=>m[1]);
 if(!days.length||days.some(d=>d!==date.replaceAll('-',''))||!new RegExp(`<option\\s+value=["']${race}R["'][^>]*\\bselected\\b`,'i').test(clean))throw Error('chart_identity_incomplete');
 const courses=gamagoriOfficialCourses(clean),marks=parse(clean),times=new Map(),registrations=new Map();
 for(const m of clean.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const time=m[1].match(/<td\b[^>]*class=["']cho_time["'][^>]*>\s*(\d+\.\d+)\s*<\/td>/i)?.[1],boat=m[1].match(/class=["']cho_waku\s+r([1-6])["']/)?.[1];
  if(time&&boat){if(times.has(Number(boat))&&times.get(Number(boat))!==Number(time))throw Error('chart_time_conflict');times.set(Number(boat),Number(time));}
 }
 // recomend omits visible registration beside exhibition. Its per-boat comment lookup embeds
 // the registration twice, its boat counter, and commentN_2 target. Match this observed contract
 // literally; never execute official JavaScript or infer registration from table order.
 for(const script of clean.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)){
  const js=script[1].replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\r\n]*/g,'');
  for(const m of js.matchAll(/if\s*\(\s*funcToDayComment\(\s*['"](\d{4})['"]\s*\)\s*!==\s*['"]['"]\s*\)\s*\{([\s\S]{0,500}?)\}\s*else\s*\{[\s\S]{0,150}?\}\s*document\.getElementById\(\s*['"]comment([1-6])_2['"]\s*\)\.innerHTML\s*=\s*strCommentHTML/g)){
   const boat=Number(m[3]),reg=Number(m[1]);
   if(!new RegExp(`funcToDayComment\\(\\s*['"]${reg}['"]\\s*\\)`).test(m[2])||!new RegExp(`intCommentCount\\[${boat}\\]\\s*=\\s*intCommentCount\\[${boat}\\]\\s*\\+\\s*1`).test(m[2]))throw Error('chart_registration_conflict');
   if(registrations.has(boat)&&registrations.get(boat)!==reg)throw Error('chart_registration_conflict');registrations.set(boat,reg);
  }
 }
 if(times.size!==6||registrations.size!==6||new Set(registrations.values()).size!==6||marks.length!==6||new Set(marks.map(m=>m.boat_no)).size!==6)throw Error('chart_identity_incomplete');
 if(entries.some(e=>times.get(e.boat_no)!==e.exhibition_time||registrations.get(e.boat_no)!==e.registration||courses.get(e.boat_no)!==e.course))throw Error('chart_observation_conflict');
 return marks.map(m=>({...entries.find(e=>e.boat_no===m.boat_no),...m}));
}
