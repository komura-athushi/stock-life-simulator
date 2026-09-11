// Reproducible playthrough sample; uses only information revealed to the player.
const fs=require('node:fs'),path=require('node:path'),E=require('../site/engine.js');
const data=Object.fromEntries(['companies','events','config'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data',n+'.json'),'utf8').replace(/^\uFEFF/,''))]));
const upsideScale=Number(process.argv[2]||1);
for(const event of data.events)for(const stage of event.stages)stage.rate=Math.max(1,Math.round(stage.rate*upsideScale));
for(const career of Object.keys(E.CAREERS)){
  const results=[];
  for(let seed=1;seed<=200;seed++){
    const s=E.createGame(data,seed*7919);E.start(s,data,{[career]:2});
    while(s.phase!=='ended'){
      if(s.rewardPending)E.reward(s,'cash');
      // Diversify cash across stocks, with a mix of earning, studying and research.
      E.act(s,data,s.month%4===1&&s.levels.trader<3?'study':'work');
      E.act(s,data,'research');
      for(const p of [...s.plans].sort((a,b)=>a.dueMonth-b.dueMonth))while(p.level<3&&s.researchPoints>=E.researchCost(s,data,p))E.inspect(s,data,p.uid);
      // Previously revealed events guide allocation; keep exposure diversified.
      const scores=data.companies.map((c,i)=>{
        let score=s.yields[i]/100;
        for(const p of s.plans){const v=E.planView(s,data,p);if(v.level===3&&p.dueMonth===s.month&&E.targets(data,{tags:v.tags}).includes(i))score+=(v.probability*v.rate+(100-v.probability)*v.failureRate)/10000;}
        return {i,score};
      }).sort((a,b)=>b.score-a.score);
      for(const {i} of scores){const budget=Math.min(s.cash,E.assets(s)/3-s.qty[i]*s.prices[i]),qty=Math.floor(budget/(s.prices[i]*100))*100;if(qty>0)E.trade(s,data,i,true,qty);}
      E.settle(s,data);
    }
    results.push(s);
  }
  console.log(E.CAREERS[career].name,JSON.stringify({runs:results.length,firstGoal:results.filter(s=>s.goalsPassed.includes(6)).length,clear:results.filter(s=>s.result==='clear').length,medianAssets:results.map(E.assets).sort((a,b)=>a-b)[100]}));
}
