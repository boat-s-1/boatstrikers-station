"use client";

import { useEffect, useState } from "react";

export default function DailyVote() {

  const [voted,setVoted]=useState(false);
  const [choice,setChoice]=useState("");

  useEffect(()=>{

    const today=new Date().toISOString().slice(0,10);

    const save=JSON.parse(
      localStorage.getItem("dailyVote")||"{}"
    );

    if(save.date===today){
      setVoted(true);
      setChoice(save.choice);
    }

  },[]);

  function vote(name){

    const today=new Date().toISOString().slice(0,10);

    localStorage.setItem("dailyVote",

      JSON.stringify({

        date:today,

        choice:name

      })

    );

    const point=Number(localStorage.getItem("bscPoint")||0);

    localStorage.setItem("bscPoint",point+2);

    setChoice(name);
    setVoted(true);

  }

  return(

<section className="dailyVote">

<h2>🌸 TODAY'S EVENT</h2>

<p>蒲郡12R ドリーム戦</p>

<div className="voteCard">

<h3>🌸 一果</h3>

<p>

本命

<br/>

<b>1-2-3</b>

</p>

<p>

押さえ

<br/>

<b>1-2-56</b>

</p>

</div>

<div className="voteCard">

<h3>⚡ キイナ</h3>

<p>

穴

<br/>

<b>5-1-4</b>

</p>

</div>

<div className="voteCard">

<h3>💜 初音</h3>

<p>

本命

<br/>

<b>2-1-3</b>

</p>

</div>

{

!voted?

<div className="voteButtons">

<button onClick={()=>vote("一果")}>

🌸 一果に投票

</button>

<button onClick={()=>vote("キイナ")}>

⚡ キイナに投票

</button>

<button onClick={()=>vote("初音")}>

💜 初音に投票

</button>

</div>

:

<div className="voteFinish">

<h3>

投票ありがとう😊

</h3>

<p>

+2pt GET!!

</p>

<p>

あなたは

<b>{choice}</b>

に投票しました。

</p>

</div>

}

</section>

  );

}
