const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const E=require('../site/engine.js');
const data=Object.fromEntries(['companies','events','config'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(__dirname,'../site/data',n+'.json'),'utf8').replace(/^\uFEFF/,''))]));
function fixture(){const d=structuredClone(data);d.config.goals.forEach(g=>g.amount=1);return d;}
function start(d=data,career='trader',seed=4321){const s=E.createGame(d,seed);E.start(s,d,career);return s;}
function actions(s,d=data){E.act(s,d,'work');E.act(s,d,'work');}
function month(s,d=data){if(s.rewardPending)E.reward(s,'cash');actions(s,d);E.settle(s,d);}
function single(s,d,eventId,due=s.month){s.plans=[{uid:s.nextPlanId++,eventId,stage:0,dueMonth:due,level:0,momentum:0,held:0,boost:0}];return s.plans[0];}

test('data contains only positive opportunities with negative failure outcomes, durations and chains',()=>{
 E.validateData(data);assert(data.events.some(e=>e.stages.length>1));assert(data.events.some(e=>e.stages[0].duration===1));
 assert(data.events.every(e=>e.stages.every(v=>v.rate>0&&v.failureRate<0&&v.duration>=1)));
 const d=structuredClone(data);d.events[0].stages[0].failureRate=0;assert.throws(()=>E.validateData(d));
});
test('two actions per month; only month-end trading; research spending uses points',()=>{
 const s=start();assert.throws(()=>E.trade(s,data,0,true,100));assert.throws(()=>E.settle(s,data));
 E.inspect(s,data,s.plans[0].uid);assert.equal(s.actions,0);assert.equal(s.researchPoints,2);
 E.act(s,data,'research');assert.equal(s.actions,1);assert.throws(()=>E.trade(s,data,0,true,100));
 E.act(s,data,'study');assert.equal(s.phase,'trade');assert.throws(()=>E.act(s,data,'work'));
 const cash=s.cash;E.trade(s,data,0,true,100);E.trade(s,data,0,false,100);assert.equal(s.cash,cash);assert.equal(s.actions,2);
 E.settle(s,data);assert.equal(s.month,2);assert.equal(s.actions,0);assert.throws(()=>E.trade(s,data,0,true,100));
});
test('a hidden opportunity exposes only its timing and investigation controls',()=>{
 const s=start();const view=E.planView(s,data,s.plans[1]);
 assert.deepEqual(Object.keys(view).sort(),['cost','level','remaining','uid']);
 s.knowledge=6;s.contacts=9;s.researchIncome=100;s.careerLevel=2;
 assert.deepEqual(Object.keys(E.planView(s,data,s.plans[1])).sort(),['cost','level','remaining','uid']);
});
test('points unlock tags, then upside/downside, then success rate independently of knowledge',()=>{
 const s=start(),p=s.plans[1];s.researchPoints=10;
 E.inspect(s,data,p.uid);let v=E.planView(s,data,p);assert(v.tags.includes('連続イベント'));assert.equal(v.stage,1);assert.equal(v.stages,3);assert(!('rate'in v));assert(!('probability'in v));assert.equal(s.researchPoints,9);
 E.inspect(s,data,p.uid);v=E.planView(s,data,p);assert(v.rate>0);assert(v.failureRate<0);assert(!('probability'in v));assert.equal(s.researchPoints,7);
 E.inspect(s,data,p.uid);v=E.planView(s,data,p);assert.equal(v.probability,E.probability(s,p,data));assert.equal(s.researchPoints,4);assert.equal(s.actions,0);
 assert.throws(()=>E.inspect(s,data,p.uid));assert.equal(s.researchPoints,4);
});
test('insufficient points, invalid id and blocked phases cannot spend points',()=>{
 const s=start();s.researchPoints=0;const old=JSON.stringify(s);
 assert.throws(()=>E.inspect(s,data,s.plans[0].uid));assert.throws(()=>E.inspect(s,data,99999));assert.equal(JSON.stringify(s),old);
 s.researchPoints=10;s.rewardPending=true;assert.throws(()=>E.inspect(s,data,s.plans[0].uid));s.rewardPending=false;s.phase='ended';assert.throws(()=>E.inspect(s,data,s.plans[0].uid));
});
test('waiting plans retain identity, reveal levels, odds and countdown across months',()=>{
 const d=fixture(),s=start(d),p=s.plans[0];p.dueMonth=3;s.researchPoints=20;
 E.inspect(s,d,p.uid);E.inspect(s,d,p.uid);const saved=structuredClone(p);
 month(s,d);assert.deepEqual(s.plans.find(x=>x.uid===p.uid),saved);assert.equal(E.remaining(s,p),2);
 month(s,d);assert.deepEqual(s.plans.find(x=>x.uid===p.uid),saved);assert.equal(E.remaining(s,p),1);
 month(s,d);assert(!s.plans.some(x=>x.uid===p.uid));assert.equal(s.plans.length,4);
 assert.throws(()=>E.inspect(s,d,p.uid));
});
test('one-month event resolves this month; replacement waits until its own date',()=>{
 const d=fixture(),s=start(d),p=s.plans[0];assert.equal(E.remaining(s,p),1);
 const due=s.plans.filter(p=>p.dueMonth===1).length,oldIds=s.plans.map(p=>p.uid);
 month(s,d);assert.equal(s.news.filter(n=>n.rate!==null).length,due);assert.equal(s.plans.length,4);
 for(const n of s.plans.filter(p=>!oldIds.includes(p.uid)))assert(n.dueMonth>=2);
});
test('a month with no due events has only dividend payout',()=>{
 const d=fixture(),s=start(d);s.plans.forEach(p=>p.dueMonth=3);const prices=[...s.prices];month(s,d);
 assert.deepEqual(s.prices,prices);assert.equal(s.news.length,1);assert.equal(s.news[0].kind,'入金');
});
test('success applies upside, failure applies downside to tagged stocks only',()=>{
 for(const prob of [30,90]){
  const d=fixture();const e=d.events.find(e=>e.stages.length===1);e.stages[0].prob=prob;
  const s=start(d);single(s,d,e.id);const prices=[...s.prices];actions(s,d);s.rng=prob===90?1:15872;E.settle(s,d);
  const indices=E.targets(d,e),rate=prob===90?e.stages[0].rate:e.stages[0].failureRate;
  s.prices.forEach((p,i)=>assert.equal(p,indices.includes(i)?Math.max(1,Math.round(prices[i]*(1+rate/100))):prices[i]));
  assert.equal(s.news[0].rate,rate);assert(s.news[0].kind.includes(prob===90?'成功':'失敗'));
 }
});
test('chain advances within same plan board, keeps tags, resets new-stage research and accumulates momentum',()=>{
 const d=fixture(),e=d.events.find(e=>e.stages.length>1);e.stages.forEach(v=>v.prob=90);
 const s=start(d),p=single(s,d,e.id);s.researchPoints=30;for(let i=0;i<3;i++)E.inspect(s,d,p.uid);
 s.rng=1;month(s,d);const next=s.plans.find(x=>x.eventId===e.id);assert(next);assert.notEqual(next.uid,p.uid);assert.equal(next.stage,1);assert.equal(next.level,1);assert.equal(next.momentum,10);assert.equal(E.remaining(s,next),e.stages[1].duration);
 const v=E.planView(s,d,next);assert(v.tags.includes('連続イベント'));assert.equal(v.stage,2);assert(!('rate'in v));assert(!('probability'in v));
});
test('failed chain stage lowers price and next-stage odds while remaining on schedule',()=>{
 const d=fixture(),e=d.events.find(e=>e.stages.length>1);e.stages[0].prob=30;
 const s=start(d);single(s,d,e.id);s.rng=15872;month(s,d);const next=s.plans.find(p=>p.eventId===e.id);
 assert.equal(next.stage,1);assert.equal(next.level,0);assert.equal(next.momentum,-10);assert.equal(E.probability(s,next,d),e.stages[1].prob-10);
});
test('final chain success awards yield and held bonus; failed final stage awards neither',()=>{
 for(const success of [true,false]){
  const d=fixture(),e=d.events.find(e=>e.stages.length>1);e.stages[2].prob=success?90:30;
  const s=start(d),p=single(s,d,e.id);p.stage=2;p.held=1;const company=E.targets(d,e)[0],oldYield=s.yields[company];
  actions(s,d);E.trade(s,d,company,true,100);s.rng=success?1:15872;E.settle(s,d);
  assert.equal(s.yields[company],oldYield+(success?1:0));assert.equal(s.news[0].text.includes('保有ボーナス'),success);assert(!s.plans.some(x=>x.uid===p.uid));
 }
});
test('influencer boost persists until a future due date and affects only that plan',()=>{
 const d=fixture(),s=start(d,'influencer'),p=s.plans[0];p.dueMonth=3;E.inspect(s,d,p.uid);actions(s,d);
 const base=E.probability(s,p,d);E.boost(s,d,p.uid);assert.equal(E.probability(s,p,d),Math.min(99,base+10));assert.equal(p.boost,10);
 assert.throws(()=>E.boost(s,d,p.uid));E.settle(s,d);assert.equal(s.plans.find(x=>x.uid===p.uid).boost,10);assert.equal(s.boosted,null);
 actions(s,d);assert.throws(()=>E.boost(s,d,p.uid));assert.equal(E.restore(JSON.stringify(s),d).plans.find(x=>x.uid===p.uid).boost,10);
});
test('study improves point income but never reveals data; points carry into next month',()=>{
 const d=fixture(),s=start(d);const old=E.researchGain(s);E.act(s,d,'study');E.act(s,d,'study');assert.equal(E.researchGain(s),old+1);
 assert(s.plans.every(p=>p.level===0));const pts=s.researchPoints;E.settle(s,d);assert.equal(s.researchPoints,pts);assert(s.plans.every(p=>p.level===0));
 E.act(s,d,'research');assert.equal(s.researchPoints,pts+E.researchGain(s));
});
test('contacts, reporter and milestone reward supply points instead of revealing plans',()=>{
 const d=fixture(),s=start(d);E.act(s,d,'story','reporter');E.act(s,d,'story','reporter');E.settle(s,d);E.act(s,d,'story','reporter');
 assert.equal(s.researchIncome,2);s.contacts=3;E.act(s,d,'work');const pts=s.researchPoints;E.settle(s,d);assert.equal(s.researchPoints,pts+3);assert(s.plans.every(p=>p.level===0));
 while(s.month<=6)month(s,d);assert(s.rewardPending);const before=s.researchPoints;E.reward(s,'network');assert.equal(s.researchPoints,before+2);assert.equal(s.researchIncome,4);assert(s.plans.every(p=>p.level===0));assert.throws(()=>E.reward(s,'network'));
});
test('inspection achievement and career growth grant their bonuses once',()=>{
 const d=fixture(),s=start(d);s.researchPoints=50;for(const p of s.plans)E.inspect(s,d,p.uid);
 assert(s.achievements.includes('researcher'));assert.equal(s.achievements.filter(a=>a==='researcher').length,1);
 const gain=E.researchGain(s);E.inspect(s,d,s.plans[0].uid);assert.equal(E.researchGain(s),gain);
 E.act(s,d,'research');E.act(s,d,'research');E.settle(s,d);E.act(s,d,'research');assert.equal(s.careerLevel,1);
});
test('24 months and 48 actions; saved states restore at every transition',()=>{
 const d=fixture(),s=start(d,'employee');
 for(let m=1;m<=24;m++){if(s.rewardPending)E.reward(s,'cash');actions(s,d);E.settle(s,d);assert.deepEqual(E.restore(JSON.stringify(s),d),s);}
 assert.equal(s.stats.actions,48);assert.equal(s.history.length,25);assert.equal(s.result,'clear');assert.deepEqual(s.goalsPassed,[6,12,18,24]);assert.throws(()=>E.settle(s,d));
});
test('each deadline fails immediately below target and blocks gameplay',()=>{
 for(const deadline of [6,12,18,24]){const d=fixture();d.config.goals.find(g=>g.month===deadline).amount=1e9;const s=start(d);while(s.month<=deadline&&s.phase!=='ended')month(s,d);assert.equal(s.month,deadline);assert.equal(s.result,'failed');assert.throws(()=>E.act(s,d,'work'));assert.throws(()=>E.inspect(s,d,s.plans[0]?.uid));assert.throws(()=>E.trade(s,d,0,true,100));}
});
test('goal threshold is inclusive after payouts, salary stays action-based',()=>{
 const d=fixture(),s=start(d);for(let m=1;m<6;m++)month(s,d);actions(s,d);d.config.goals[0].amount=E.assets(s);E.settle(s,d);assert(s.rewardPending);
 const fresh=start();E.act(fresh,data,'study');E.act(fresh,data,'research');E.settle(fresh,data);assert.equal(fresh.cash,data.config.initialCash);
});
test('dividend uses prices after scheduled event outcomes',()=>{
 const d=fixture(),s=start(d,'wealthy'),multiplier=E.dividendMultiplier(s);actions(s,d);E.trade(s,d,2,true,500);E.settle(s,d);assert.equal(s.stats.dividends,Math.floor(s.prices[2]*500*s.yields[2]/100*multiplier));
});
test('reload keeps pending plans, points, investigation stages and future randomness identical',()=>{
 const d=fixture(),s=start(d);E.inspect(s,d,s.plans[1].uid);E.act(s,d,'research');E.act(s,d,'study');const copy=E.restore(JSON.stringify(s),d);E.settle(s,d);E.settle(copy,d);assert.deepEqual(copy,s);
});
test('old or corrupt saves rejected without mutating valid state',()=>{
 const s=start();assert.deepEqual(E.restore(JSON.stringify(E.createGame(data,1)),data),E.createGame(data,1));
 const bad=[{...s,version:2},{...s,researchPoints:-1},{...s,researchPoints:1.5},{...s,phase:'trade'},{...s,plans:[...s.plans,s.plans[0]]}];
 for(const b of bad)assert.throws(()=>E.restore(JSON.stringify(b),data));
 for(const field of ['level','stage','dueMonth']){const b=structuredClone(s);b.plans[0][field]=999;assert.throws(()=>E.restore(JSON.stringify(b),data));}
});
test('invalid trades leave balances untouched',()=>{
 const s=start();actions(s);const old=JSON.stringify(s);for(const q of [0,-100,99,100.5,NaN,Infinity,1e12])assert.throws(()=>E.trade(s,data,0,true,q));assert.throws(()=>E.trade(s,data,0,false,100));assert.equal(JSON.stringify(s),old);
});

test('base probabilities span 30–90 and all modifiers clamp to 30–99',()=>{
 const all=data.events.flatMap(e=>e.stages.map(v=>v.prob));assert.equal(Math.min(...all),30);assert.equal(Math.max(...all),90);
 const d=fixture(),s=start(d),p=s.plans[0];p.level=3;d.events[p.eventId].stages[p.stage].prob=90;p.momentum=25;p.boost=20;
 assert.equal(E.probability(s,p,d),99);assert.equal(E.planView(s,d,p).probability,99);
 d.events[p.eventId].stages[p.stage].prob=30;p.momentum=-25;p.boost=0;assert.equal(E.probability(s,p,d),30);
 for(const prob of [29,91]){const bad=fixture();bad.events[0].stages[0].prob=prob;assert.throws(()=>E.validateData(bad));}
});
test('event balance updates preserve progress while structural data changes reject the save',()=>{
 const old=structuredClone(data);old.events[0].stages[0].prob=85;old.events[0].stages[0].rate=22;old.events[0].stages[0].failureRate=-13;
 const s=start(old);E.inspect(s,old,s.plans[0].uid);E.act(s,old,'research');
 const loaded=E.restore(JSON.stringify(s),data);assert.equal(loaded.signature,JSON.stringify(data));
 assert.deepEqual({...loaded,signature:s.signature},s);
 const unrelated=structuredClone(data);unrelated.events[0].stages[0].duration++;
 assert.throws(()=>E.restore(JSON.stringify(s),unrelated));
});

test('lower base success odds offer higher upside while downside varies independently',()=>{
 const stages=data.events.flatMap(e=>e.stages);
 for(const a of stages)for(const b of stages)if(a.prob<b.prob)assert(a.rate>b.rate,'Lower odds must offer higher upside');
 const high=stages.filter(v=>v.prob>=80),low=stages.filter(v=>v.prob<=40);
 assert(high.every(v=>v.rate<=20&&v.failureRate<=-25));
 assert(low.some(v=>v.failureRate>=-20));assert(low.some(v=>v.failureRate<=-50));
 const s=start(),p=s.plans[0];p.level=3;const before=E.planView(s,data,p);p.boost=20;const after=E.planView(s,data,p);
 assert.equal(after.rate,before.rate);assert.equal(after.failureRate,before.failureRate);assert(after.probability>=before.probability);
});
test('multi-tag businesses connect payments, AI and subscriptions across industries',()=>{
 assert(data.companies.every(c=>c.tags.length>=4&&new Set(c.tags).size===c.tags.length));
 assert.deepEqual(E.targets(data,{tags:['決済']}),[2,3,5]);
 assert.deepEqual(E.targets(data,{tags:['AI']}),[0,3,4]);
 assert.deepEqual(E.targets(data,{tags:['サブスク']}),[1,3]);
 const tags=new Set(data.companies.flatMap(c=>c.tags));
 assert([...tags].every(tag=>data.events.some(e=>e.tags.includes(tag))));
 assert(data.events.some(e=>E.targets(data,e).length===1));
 assert(data.events.some(e=>E.targets(data,e).length>=3));
});
test('overlapping event tags move each matched stock only once',()=>{
 const d=fixture(),e=d.events.find(e=>e.tags.includes('AI')&&e.tags.includes('海外展開'));
 e.stages[0].prob=90;const s=start(d);single(s,d,e.id);const before=[...s.prices];
 actions(s,d);s.rng=1;E.settle(s,d);
 assert.equal(s.prices[0],Math.round(before[0]*(1+e.stages[0].rate/100)));
 assert.equal(s.prices[2],before[2]);
 assert.deepEqual(s.news[0].indices,[0,1,3,4,5]);
});
test('business and event descriptions/tags can update without losing holdings or investigations',()=>{
 const old=structuredClone(data);old.companies[0].tags.push('AI・半導体');old.companies[0].desc='以前の説明';
 old.events[0].tags=['AI・半導体'];old.events[0].title='以前の予定';old.events[0].stages[0].title='以前の予定';
 const s=start(old);E.inspect(s,old,s.plans[0].uid);actions(s,old);E.trade(s,old,0,true,100);
 const restored=E.restore(JSON.stringify(s),data);
 assert.deepEqual({...restored,signature:s.signature},s);
 const changed=structuredClone(data);changed.companies.reverse();assert.throws(()=>E.restore(JSON.stringify(s),changed));
});
