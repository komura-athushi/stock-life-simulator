'use strict';
// JSON is data, never executable code. Keep validation before initialization.
function validateGameData(d){
 const fail=m=>{throw new Error('データ形式エラー: '+m)};
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const number=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
 const integer=(x,min,max)=>Number.isSafeInteger(x)&&x>=min&&x<=max;
 const str=x=>typeof x==='string'&&x.length>0&&x.length<=4000;
 if(!obj(d.config)||d.config.schemaVersion!==1||!integer(d.config.initialCash,1,1e9))fail('config');
 if(!Array.isArray(d.companies)||d.companies.length<2||d.companies.length>100)fail('companies');
 const ids=new Set(),knownTags=new Set();
 d.companies.forEach(c=>{
  if(!obj(c)||!str(c.id)||ids.has(c.id)||!str(c.name)||!str(c.desc)||!integer(c.price,1,1e7)||!number(c.yieldPct,0,100)||!Array.isArray(c.tags)||!c.tags.length||!c.tags.every(str))fail('銘柄');
  ids.add(c.id);c.tags.forEach(t=>knownTags.add(t));
 });
 if(!Array.isArray(d.events)||d.events.length<4||d.events.length>10000)fail('events');
 d.events.forEach((e,i)=>{
  if(!obj(e)||e.id!==i||!['title','text','hint','success','failure'].every(k=>str(e[k]))||!number(e.rate,-99,1000)||!number(e.prob,0,100)||!Array.isArray(e.tags)||!e.tags.length||!e.tags.every(t=>knownTags.has(t)))fail('イベント '+i);
 });
 if(!obj(d.jobs)||Object.keys(d.jobs).sort().join(',')!=='employee,influencer,trader,wealthy')fail('jobs: 4職業のIDを維持してください');
 Object.values(d.jobs).forEach(j=>{
  if(!obj(j)||!['name','desc','detail','incomeLabel','feature'].every(k=>str(j[k]))||!integer(j.income,0,1e9)||!integer(j.count,1,4)||!number(j.dividendMultiplier,1,10)||!number(j.boostPoints,0,95))fail('職業');
  if(j.salarySteps&&(!Array.isArray(j.salarySteps)||j.salarySteps.length!==4||!j.salarySteps.every(n=>integer(n,0,1e9))))fail('salarySteps');
  if(j.bonuses&&(!obj(j.bonuses)||!Object.entries(j.bonuses).every(([m,n])=>integer(+m,1,12)&&integer(n,0,1e9))))fail('bonuses');
  if(j.randomIncome){const r=j.randomIncome;if(!obj(r)||!integer(r.min,0,1e9)||!integer(r.max,r.min,1e9)||!integer(r.step,1,1e9)||(r.max-r.min)%r.step!==0)fail('randomIncome')}
 });
 const outcome=e=>obj(e)&&str(e.title)&&str(e.explanation)&&number(e.rate,-99,1000);
 if(!obj(d.major)||!Array.isArray(d.major.months)||!d.major.months.length||!d.major.months.every(m=>integer(m,1,12))||new Set(d.major.months).size!==d.major.months.length||!Array.isArray(d.major.modes)||!d.major.modes.length)fail('major');
 d.major.modes.forEach(m=>{if(!obj(m)||(m.type==='all'?!outcome(m):m.type==='individual'?(!integer(m.count,1,d.companies.length)||!Array.isArray(m.outcomes)||!m.outcomes.length||!m.outcomes.every(outcome)):true))fail('大規模イベント')});
 if(!Array.isArray(d.config.ranks)||!d.config.ranks.length||!d.config.ranks.every((r,i)=>obj(r)&&integer(r.min,0,1e12)&&str(r.label)&&(i===0||r.min<d.config.ranks[i-1].min))||d.config.ranks.at(-1).min!==0)fail('ranks');
 return d;
}
async function boot(){
 const message=document.getElementById('bootMessage'),retry=document.getElementById('retry');
 retry.hidden=true;
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{
  if(location.protocol==='file:')throw new Error('HTMLのダブルクリックではデータを読み込めません。公開URLまたはローカルサーバーから開いてください。');
  const names=['companies','jobs','events','major','config'];
  const entries=await Promise.all(names.map(async name=>{
   const response=await fetch(new URL('./data/'+name+'.json',location.href),{signal:controller.signal,cache:'no-cache',credentials:'omit'});
   if(!response.ok)throw new Error(name+'.json を取得できません（HTTP '+response.status+'）。');
   return [name,await response.json()];
  }));
  initializeGame(validateGameData(Object.fromEntries(entries)));
  document.querySelector('main').hidden=false;document.getElementById('boot').hidden=true;
 }catch(error){
  controller.abort();
  message.textContent='ゲームを開始できませんでした。'+(error.name==='AbortError'?'通信がタイムアウトしました。':error.message)+' 接続やファイル配置を確認して再読み込みしてください。';
  retry.hidden=false;retry.onclick=()=>location.reload();
 }finally{clearTimeout(timer)}
}
boot();
