"use client";

import { useEffect, useState } from "react";

export default function BscStatus(){

const [point,setPoint]=useState(0);

const [badge,setBadge]=useState([]);

const [mission,setMission]=useState([]);

useEffect(()=>{

setPoint(Number(localStorage.getItem("bscPoint")||0));

setBadge(JSON.parse(localStorage.getItem("bscBadge")||"[]"));

setMission(JSON.parse(localStorage.getItem("bscMission")||"[]"));

},[]);

const level=Math.floor(point/100)+1;

let rank="🌱 見習い";

if(level>=3)rank="📖 研究員";
if(level>=5)rank="🚤 アナリスト";
if(level>=10)rank="🏆 マスター";
if(level>=20)rank="👑 レジェンド";

return(

<section className="bscStatus">

<h2>🎮 BSC STATUS</h2>

<strong>LEVEL {level}</strong>

<h3>{rank}</h3>

<p>⭐ {point} pt</p>

<p>🏅 バッジ {badge.length}個</p>

<p>📚 Mission {mission.length}個クリア</p>

</section>

);

}
