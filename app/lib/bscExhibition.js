const clamp=(v,min=0,max=100)=>Math.min(max,Math.max(min,v));
const num=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;

const rank=(rows,key,asc=true)=>{
  const valid=rows.filter(x=>num(x[key])!==null)
    .sort((a,b)=>asc?num(a[key],999)-num(b[key],999):num(b[key],-999)-num(a[key],-999));
  return new Map(valid.map((x,i)=>[Number(x.boat_no),i+1]));
};

const grade=s=>s>=90?"S":s>=80?"A":s>=70?"B":s>=60?"C":"D";
const norm=(v,min,max)=>num(v)===null?.5:clamp((num(v)-min)/(max-min),0,1);

export function buildBscExhibition(entries=[]){
  const timeRank=rank(entries,"exhibition_time",true);
  const stRank=rank(entries,"exhibition_st",true);
  const motorRank=rank(entries,"motor_2_rate",false);

  const rows=entries.map(e=>{
    const b=Number(e.boat_no);
    const tr=timeRank.get(b)||null;
    const sr=stRank.get(b)||null;
    const mr=motorRank.get(b)||null;
    const timeScore=tr?((7-tr)/6)*100:50;
    const stScore=sr?((7-sr)/6)*100:50;
    const motorScore=norm(e.motor_2_rate,20,55)*100;
    const boatScore=norm(e.boat_2_rate,20,55)*100;
    const tiltPenalty=Math.min(Math.abs(num(e.tilt,0))*3,8);
    const score=Math.round(clamp(timeScore*.52+stScore*.18+motorScore*.18+boatScore*.12-tiltPenalty));
    const reasons=[];
    if(tr===1)reasons.push("展示タイム1位");
    else if(tr&&tr<=2)reasons.push("展示タイム上位");
    if(sr===1)reasons.push("展示ST1位");
    if(mr===1)reasons.push("モーター評価1位");
    return {...e,bscExhibitionScore:score,bscExhibitionGrade:grade(score),
      exhibitionRank:tr,startRank:sr,reasons};
  });

  const overall=[...rows].sort((a,b)=>b.bscExhibitionScore-a.bscExhibitionScore||a.boat_no-b.boat_no);
  const map=new Map(overall.map((x,i)=>[Number(x.boat_no),i+1]));
  return rows.map(x=>({...x,bscExhibitionRank:map.get(Number(x.boat_no))}));
}
