'use strict';

// DOM-free rules shared by the browser and regression tests.
(function (root) {
  const CAREERS = {
    employee: { name: 'フリーター', icon: '▣', metric: 'works', activity: 'バイト', unit: '回', thresholds: [2,5,9,14,20] },
    wealthy: { name: '資産家', icon: '✦', metric: 'dividends', activity: '累計配当', unit: '円', thresholds: [100000,300000,700000,1400000,2500000] },
    influencer: { name: 'インフルエンサー', icon: '◉', metric: 'posts', activity: 'SNS投稿', unit: '回', thresholds: [2,5,9,14,20] },
    trader: { name: 'トレーダー', icon: '⌁', metric: 'studies', activity: '勉強', unit: '回', thresholds: [2,5,9,14,20] }
  };
  const MAX_LEVEL = 5;
  function careerProgress(s, id) {
    const c = CAREERS[id], level = s.levels[id], initial = s.initialLevels[id];
    const current = s.stats[c.metric], target = level < MAX_LEVEL ? c.thresholds[level - initial] : null;
    return {level, current, target, remaining: target === null ? 0 : Math.max(0, target-current)};
  }
  function careerEffect(id, level) {
    return id === 'employee' ? 'バイト収入 ' + (140000 + level * 40000).toLocaleString('ja-JP') + '円' : id === 'trader' ? '情報収集で獲得する調査pt ' + (3 + level) + 'pt' : id === 'influencer' ? 'SNS投稿の発生確率アップ ＋' + (10 + level * 2) + 'ポイント（上限95%）' : '職業による配当倍率 ×' + (1 + level * 0.12).toFixed(2);
  }
  function boostGain(s) { return Math.min(20, 10 + s.levels.influencer * 2); }
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function validateData(data) {
    const int = (n,min,max) => Number.isSafeInteger(n) && n>=min && n<=max;
    if (!data || data.config?.schemaVersion !== 3 || data.config.months !== 24 || data.config.actionsPerMonth !== 2 || data.config.planSlots !== 4 || !int(data.config.initialResearchPoints,0,100) || !Array.isArray(data.config.researchCosts) || data.config.researchCosts.length !== 3 || !data.config.researchCosts.every(n=>int(n,1,100))) throw Error('ゲーム設定の形式が違います。');
    if (!int(data.config.initialCash,1,1e9)) throw Error('初期資金が不正です。');
    if (!Array.isArray(data.companies) || data.companies.length !== 6 || data.companies.some(c => typeof c.name !== 'string' || !Array.isArray(c.tags) || !c.tags.every(t => typeof t === 'string') || !int(c.price,1,1e7) || !Number.isFinite(c.yieldPct) || c.yieldPct < 0 || c.yieldPct > 20)) throw Error('銘柄データが不正です。');
    if (!Array.isArray(data.events) || data.events.length < 4 || data.events.some((e,i)=>e.id!==i || typeof e.title!=='string' || !Array.isArray(e.tags) || !e.tags.length || !e.tags.every(t=>data.companies.some(c=>c.tags.includes(t))) || !Array.isArray(e.stages) || e.stages.length<1 || e.stages.length>5 || e.stages.some(v=>!['title','text','success','failure'].every(k=>typeof v[k]==='string') || !int(v.duration,1,6) || !int(v.rate,1,1000) || !int(v.failureRate,-99,-1) || !int(v.prob,20,90)))) throw Error('イベントデータが不正です。');
    if (!data.events.some(e=>e.stages.length>1) || !data.events.some(e=>e.stages.length===1 && e.stages[0].duration===1)) throw Error('連続イベントと1か月の単発イベントが必要です。');
    if (!Array.isArray(data.config.goals) || data.config.goals.length !== 4 || data.config.goals.some((g,i)=>g.month!==(i+1)*6 || !int(g.amount,1,1e12) || typeof g.title!=='string')) throw Error('目標データが不正です。');
    return data;
  }
  function createGame(data, seed = Date.now()) {
    validateData(data);
    return {
      version: 4, signature: JSON.stringify(data), rng: (Number(seed) >>> 0) || 1,
      career: null, initialLevels: Object.fromEntries(Object.keys(CAREERS).map(id => [id, 0])), careerPoints: 2,
      month: 1, actions: 0, phase: 'start', cash: data.config.initialCash,
      prices: data.companies.map(c => c.price), qty: data.companies.map(() => 0), cost: data.companies.map(() => 0), yields: data.companies.map(c => c.yieldPct),
      levels: Object.fromEntries(Object.keys(CAREERS).map(id => [id, 0])), dividendBonus: 0, researchIncome: 0, researchPoints: data.config.initialResearchPoints,
      stats: { works: 0, studies: 0, researches: 0, investigations: 0, posts: 0, dividends: 0, realized: 0, earned: 0, actions: 0 },
      plans: [], nextPlanId: 1,
      goalsPassed: [], rewardPending: false, result: null,
      history: [{ month: 0, assets: data.config.initialCash, prices: data.companies.map(c => c.price) }], news: [], log: []
    };
  }
  function random(s) {
    let x = s.rng; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    s.rng = x >>> 0; return s.rng / 4294967296;
  }
  function pick(s, items) { return items[Math.floor(random(s) * items.length)]; }
  function record(s, message) { s.log.unshift({ month: s.month, message }); s.log = s.log.slice(0, 300); }
  function assets(s) { return Math.round(s.cash + s.prices.reduce((sum, p, i) => sum + p * s.qty[i], 0)); }
  function researchGain(s) { return 3 + s.levels.trader; }
  function monthlyResearch(s) { return s.researchIncome; }
  function researchCost(s,data,plan) { return plan.level<3 ? data.config.researchCosts[plan.level] : 0; }
  function eventStage(data,plan) { return data.events[plan.eventId].stages[plan.stage]; }
  function probability(s,plan,data) { return clamp(clamp(eventStage(data,plan).prob+plan.momentum,20,95)+plan.boost,20,95); }
  function remaining(s,plan) { return plan.dueMonth-s.month+1; }
  // Only this projection is handed to the event-card renderer.
  function planView(s,data,plan) {
    const view={uid:plan.uid,level:plan.level,remaining:remaining(s,plan),cost:researchCost(s,data,plan)};
    if(plan.level>=1){const e=data.events[plan.eventId]; Object.assign(view,{title:eventStage(data,plan).title,tags:[...e.tags,...(e.stages.length>1?['連続イベント']:[])],stage:plan.stage+1,stages:e.stages.length,boost:plan.boost});}
    if(plan.level>=2){const v=eventStage(data,plan);Object.assign(view,{rate:v.rate,failureRate:v.failureRate});}
    if(plan.level>=3)view.probability=probability(s,plan,data);
    return view;
  }
  function dividendMultiplier(s) { return 1 + s.dividendBonus + s.levels.wealthy * 0.12; }
  function dividend(s) { return s.prices.reduce((sum, price, i) => sum + Math.floor(price * s.qty[i] * s.yields[i] / 100 * dividendMultiplier(s)), 0); }
  function workPay(s) { return 140000 + s.levels.employee * 40000; }
  function targets(data, e) { return data.companies.map((c, i) => c.tags.some(t => e.tags.includes(t)) ? i : -1).filter(i => i >= 0); }
  function changePrice(s, indices, rate) { indices.forEach(i => { s.prices[i] = Math.max(1, Math.round(s.prices[i] * (1 + rate / 100))); }); }
  function makePlan(s,data,eventId,month,stage=0,previous=null) {
    const v=data.events[eventId].stages[stage];
    return {uid:s.nextPlanId++,eventId,stage,dueMonth:month+v.duration-1,level:previous?.level>=1?1:0,momentum:previous?.momentum||0,held:previous?.held||0,boost:0};
  }
  function schedulePlan(plan,plans,data) {
    const tags=data.events[plan.eventId].tags;
    while(plans.some(p=>p.dueMonth===plan.dueMonth && data.events[p.eventId].tags.some(t=>tags.includes(t)))) plan.dueMonth++;
    return plan;
  }
  function pickEvent(s,pool) {
    // High-probability opportunities dominate early; speculative ones enter gradually.
    const weight=e=>e.stages[0].prob>=70 ? 6 : s.month<=6 ? 0.25 : s.month<=12 ? 1 : s.month<=18 ? 3 : 5;
    let roll=random(s)*pool.reduce((sum,e)=>sum+weight(e),0);
    return pool.find(e=>(roll-=weight(e))<0)||pool.at(-1);
  }
  function fillPlans(s,data,initial=false) {
    while(s.plans.length<data.config.planSlots){
      let pool=data.events.filter(e=>!s.plans.some(p=>p.eventId===e.id));
      if(initial && s.plans.length===0) pool=pool.filter(e=>e.stages.length===1 && e.stages[0].duration===1);
      if(initial && s.plans.length===1) pool=pool.filter(e=>e.stages.length>1 && !s.plans.some(p=>p.dueMonth===s.month+e.stages[0].duration-1 && data.events[p.eventId].tags.some(t=>e.tags.includes(t))));
      if(!pool.length)throw Error('追加できるイベントが不足しています。');
      s.plans.push(schedulePlan(makePlan(s,data,pickEvent(s,pool).id,s.month),s.plans,data));
    }
  }
  function prepareMonth(s,data,initial=false) {
    s.actions=0; s.phase='action';
    fillPlans(s,data,initial);
    if(!initial && monthlyResearch(s)>0){s.researchPoints+=monthlyResearch(s);record(s,'情報網から調査pt＋'+monthlyResearch(s));}
  }
  function validAllocation(levels) {
    return levels && typeof levels === 'object' && !Array.isArray(levels) &&
      Object.keys(levels).every(id => Object.hasOwn(CAREERS,id)) &&
      Object.values(levels).every(n => Number.isInteger(n) && n >= 0 && n <= 2) &&
      Object.values(levels).reduce((a,b) => a+b,0) <= 2;
  }
  function allocateCareer(s, id, delta) {
    if(s.phase !== 'start' || !Object.hasOwn(CAREERS,id) || ![-1,1].includes(delta)) throw Error('スタート前に職業ptを振り分けよう。');
    if(s.careerPoints < delta || s.initialLevels[id] + delta < 0) throw Error('職業ptの振り分けを調整しよう。');
    s.initialLevels[id] += delta; s.levels[id] += delta; s.careerPoints -= delta;
  }
  function start(s, data, allocation = s.initialLevels) {
    if (s.phase !== 'start' || !validAllocation(allocation)) throw Error('職業ptを振り分けて、自分らしい一歩を。');
    s.initialLevels = Object.fromEntries(Object.keys(CAREERS).map(id => [id, allocation[id] || 0]));
    s.levels = {...s.initialLevels}; s.careerPoints = 2 - Object.values(s.initialLevels).reduce((a,b)=>a+b,0);
    prepareMonth(s, data, true); record(s, '自分らしい投資家生活がスタート。');
  }
  function checkProgress(s) {
    for (const id of Object.keys(CAREERS)) {
      let p = careerProgress(s, id);
      while (p.target !== null && p.current >= p.target) {
        s.levels[id]++;
        record(s, CAREERS[id].activity + ' ' + p.target.toLocaleString('ja-JP') + CAREERS[id].unit + '達成！ ' + CAREERS[id].name + ' Lv.' + s.levels[id] + '：' + careerEffect(id, s.levels[id]));
        p = careerProgress(s, id);
      }
    }
  }
  function act(s, data, action, target) {
    if (s.phase !== 'action' || s.rewardPending || s.actions >= 2) throw Error('次の月の行動を楽しみに。');
    if (action === 'work') {
      const pay = workPay(s); s.cash += pay; s.stats.earned += pay; s.stats.works++;
      record(s, 'バイト：＋' + pay.toLocaleString('ja-JP') + '円');
    } else if (action === 'study') {
      s.stats.studies++; record(s, '勉強：学びの積み重ね ' + s.stats.studies + '回');
    } else if (action === 'research') {
      const points = researchGain(s); s.researchPoints += points; s.stats.researches++;
      record(s, '情報収集：調査pt＋' + points);
    } else if (action === 'post') {
      const p = s.plans.find(p => p.uid === target);
      if (!p) throw Error('応援するイベントを選ぼう。');
      const before = probability(s,p,data);
      if (before >= 95) throw Error('応援は最高潮！ 別のイベントへ声を届けよう。');
      const gain = Math.min(boostGain(s), 95 - before);
      p.boost += gain; s.stats.posts++;
      record(s, 'SNS投稿：イベント #' + p.uid + ' の発生確率＋' + gain + 'ポイント');
    } else throw Error('行動を選ぼう。');
    s.actions++; s.stats.actions++; checkProgress(s);
    if (s.actions === 2) { s.phase = 'trade'; record(s, '今月の行動完了。投資を整えて、次の月へ。'); }
  }
  function trade(s, data, index, buy, quantity) {
    if (!['action','trade'].includes(s.phase) || s.rewardPending) throw Error('新しい月の市場で取引しよう。');
    if (!Number.isInteger(index) || index < 0 || index >= data.companies.length || !Number.isSafeInteger(quantity) || quantity < 100 || quantity % 100 !== 0) throw Error('株数は100株単位で指定してください。');
    const amount = s.prices[index] * quantity;
    if (!Number.isSafeInteger(amount)) throw Error('取引額が大きすぎます。');
    if (buy) {
      if (amount > s.cash) throw Error('現金が足りません。');
      s.cash -= amount; s.qty[index] += quantity; s.cost[index] += amount;
    } else {
      if (quantity > s.qty[index]) throw Error('保有株数が足りません。');
      const basis = s.cost[index] * quantity / s.qty[index];
      s.stats.realized += amount - basis; s.cost[index] -= basis; s.qty[index] -= quantity; s.cash += amount;
      if (!s.qty[index]) s.cost[index] = 0;
    }
    record(s, data.companies[index].name + 'を' + quantity + '株' + (buy ? '購入' : '売却') + '：' + amount.toLocaleString('ja-JP') + '円');
    checkProgress(s);
  }
  function inspect(s,data,uid) {
    if(!['action','trade'].includes(s.phase)||s.rewardPending)throw Error('行動期間か月末に調査できます。');
    const p=s.plans.find(p=>p.uid===uid);
    if(!p || p.level>=3)throw Error('調査するイベントを選んでください。');
    const cost=researchCost(s,data,p);if(s.researchPoints<cost)throw Error('調査ptが足りません。情報収集で貯めましょう。');
    s.researchPoints-=cost;p.level++;s.stats.investigations++;
    record(s,'イベントの調査：'+['','タグ','値動き','成功率'][p.level]+'を確認（'+cost+'pt）');
    checkProgress(s);
  }
  function boost(s,data,uid) { act(s,data,'post',uid); }
  function settle(s, data) {
    if (!['action','trade'].includes(s.phase) || s.rewardPending) throw Error('目標報酬を選んで、次の一歩へ。');
    s.news = [];
    const waiting=[],resolvedTags=new Set();
    for(const p of s.plans){
      if(p.dueMonth>s.month){waiting.push(p);continue;}
      const e=data.events[p.eventId],v=eventStage(data,p),indices=targets(data,e);
      // Older saves may already contain collisions. Keep their research and SNS boost.
      if(e.tags.some(t=>resolvedTags.has(t))){p.dueMonth=s.month+1;waiting.push(schedulePlan(p,[...waiting,...s.plans.filter(q=>q!==p&&q.dueMonth>s.month)],data));continue;}
      e.tags.forEach(t=>resolvedTags.add(t));
      const ok=random(s)*100<probability(s,p,data),rate=ok?v.rate:v.failureRate;
      changePrice(s,indices,rate);
      if(indices.some(i=>s.qty[i]>0))p.held++;
      let text=ok?v.success:v.failure;
      const chain=e.stages.length>1,final=p.stage===e.stages.length-1;
      if(chain && !final){
        p.momentum=clamp(p.momentum+(ok?10:-10),-25,25);
        waiting.push(schedulePlan(makePlan(s,data,p.eventId,s.month+1,p.stage+1,p),[...waiting,...s.plans.filter(q=>q.dueMonth>s.month)],data));
        text+=' 次の段階へ続く。';
      }else if(chain && final && ok){
        indices.forEach(i=>s.yields[i]=Math.min(20,s.yields[i]+1));
        text+=' 計画完遂。配当利回り＋1ポイント。';
        if(p.held>=2){const bonus=Math.floor(indices.reduce((n,i)=>n+s.prices[i]*s.qty[i],0)*0.04);if(bonus){s.cash+=bonus;s.stats.earned+=bonus;text+=' 保有ボーナス＋'+bonus.toLocaleString('ja-JP')+'円。';}}
      }
      s.news.push({title:v.title,text,rate,indices,kind:(chain?'連続イベント '+(p.stage+1)+'/'+e.stages.length:'イベント')+'・'+(ok?'成功':'失敗')});
    }
    s.plans=waiting;
    const payout = dividend(s); s.cash += payout; s.stats.dividends += payout;
    s.news.push({ title: '今月の配当', text: 'イベント後の株価で計算。＋' + payout.toLocaleString('ja-JP') + '円。次の月の投資に役立てよう。', rate: null, indices: [], kind: '入金' });
    checkProgress(s);
    s.history.push({ month: s.month, assets: assets(s), prices: [...s.prices] });
    for (const n of s.news) record(s, n.kind + '：' + n.title + (n.rate === null ? '' : ' ' + (n.rate > 0 ? '+' : '') + n.rate + '%'));
    record(s, '配当入金：＋' + payout.toLocaleString('ja-JP') + '円');
    const goal = data.config.goals.find(g => g.month === s.month);
    const achieved=goal && assets(s)>=goal.amount;
    if (goal && !achieved) record(s, '目標未達。ボーナスはありませんが、挑戦は続きます。');
    if (achieved) { s.goalsPassed.push(goal.month); s.rewardPending=true; record(s, '目標達成！ ' + goal.title); }
    if (s.month === data.config.months) { s.phase = 'ended'; s.result = 'clear'; record(s, '2年間の挑戦をクリア！ 夢の職業へ。'); return; }
    s.month++; prepareMonth(s, data);
  }
  function reward(s, choice) {
    if (!s.rewardPending || !['action','ended'].includes(s.phase) || !['dividend', 'network'].includes(choice)) throw Error('目標報酬を選んでください。');
    if (choice === 'dividend') { s.dividendBonus = Math.round((s.dividendBonus+0.1)*100)/100; record(s, '目標報酬：配当倍率＋0.10'); }
    if (choice === 'network') { s.researchIncome+=2; s.researchPoints+=2; record(s, '目標報酬：毎月の調査pt＋2（今月から）'); }
    s.rewardPending = false;
  }
  function compatibleSignature(signature,data) {
    if(signature===JSON.stringify(data))return true;
    try {
      const previous=JSON.parse(signature);
      previous.companies.forEach((c,i)=>{c.tags=data.companies[i].tags;c.desc=data.companies[i].desc;});
      previous.events.forEach((e,i)=>{e.tags=data.events[i].tags;e.title=data.events[i].title;e.stages.forEach((stage,j)=>{for(const key of ['prob','rate','failureRate','title','text','success','failure'])stage[key]=data.events[i].stages[j][key];});});
      return JSON.stringify(previous)===JSON.stringify(data);
    } catch { return false; }
  }
  function restore(raw,data) {
    let s;try{s=JSON.parse(raw);}catch{throw Error('保存データを読み取れません。');}
    const int=(n,min=0,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=min&&n<=max;
    const num=(n,min=0)=>Number.isFinite(n)&&n>=min;
    const array=(xs,count,test)=>Array.isArray(xs)&&xs.length===count&&xs.every(test);
    const fail=()=>{throw Error('保存データの形式が違うか、破損しています。');};
    // Preserve existing v4 games from the single-career starting screen.
    if(s && !Object.hasOwn(s,'initialLevels') && !Object.hasOwn(s,'careerPoints')) {
      if(!(s.career===null||Object.hasOwn(CAREERS,s.career)))fail();
      s.initialLevels=Object.fromEntries(Object.keys(CAREERS).map(id=>[id,s.career===id?2:0]));
      s.careerPoints=s.career===null?2:0;
    }
    if(!s||s.version!==4||!compatibleSignature(s.signature,data)||!int(s.rng,1,4294967295)||!int(s.month,1,24)||!int(s.actions,0,2)||!['start','action','trade','ended'].includes(s.phase)||!(s.career===null||Object.hasOwn(CAREERS,s.career))||!num(s.cash)||!array(s.prices,6,n=>int(n,1))||!array(s.qty,6,n=>int(n)&&n%100===0)||!array(s.cost,6,n=>num(n))||!array(s.yields,6,n=>num(n)&&n<=20))fail();
    if(!s.levels||!Object.keys(CAREERS).every(id=>int(s.levels[id],0,MAX_LEVEL))||!num(s.dividendBonus)||!int(s.researchIncome)||!int(s.researchPoints)||!int(s.nextPlanId,1)||typeof s.rewardPending!=='boolean')fail();
    if(!s.stats||!['works','studies','researches','investigations','posts','dividends','earned','actions'].every(k=>int(s.stats[k]))||!num(s.stats.realized,-Number.MAX_VALUE)||(s.stats.actions<s.actions||s.stats.actions>(s.month-1)*2+s.actions))fail();
    if(!Array.isArray(s.plans)||s.plans.length>4||new Set(s.plans.map(p=>p.uid)).size!==s.plans.length||new Set(s.plans.map(p=>p.eventId)).size!==s.plans.length||s.plans.some(p=>!int(p.uid,1,s.nextPlanId-1)||!int(p.eventId,0,data.events.length-1)||!int(p.stage,0,data.events[p.eventId].stages.length-1)||!int(p.dueMonth,s.month,s.month+24)||!int(p.level,0,3)||!int(p.momentum,-25,25)||!int(p.held,0,p.stage)||!int(p.boost,0,90)))fail();
    if(s.phase!=='start'&&s.phase!=='ended'&&s.plans.length!==4||s.phase==='start'&&s.plans.length!==0)fail();
    if(!Array.isArray(s.goalsPassed)||!s.goalsPassed.every((m,i)=>[6,12,18,24].includes(m)&&m<=s.month&&(i===0||m>s.goalsPassed[i-1])))fail();
    if(!array(s.history,s.phase==='ended'?s.month+1:s.month,(h)=>h&&int(h.month,0,24)&&num(h.assets)&&array(h.prices,6,n=>int(n,1)))||!s.history.every((h,i)=>h.month===i)||!Array.isArray(s.log)||s.log.length>300||s.log.some(l=>!int(l.month,1,24)||typeof l.message!=='string')||!Array.isArray(s.news)||s.news.length>5||s.news.some(n=>!['title','text','kind'].every(k=>typeof n[k]==='string')||!(n.rate===null||Number.isFinite(n.rate))||!Array.isArray(n.indices)||!n.indices.every(i=>int(i,0,5))))fail();
    if(s.phase==='start'&&(s.career!==null||s.month!==1||s.actions!==0)||s.phase==='action'&&s.actions>=2||s.phase==='trade'&&s.actions!==2||s.phase==='ended'&&(!['failed','clear'].includes(s.result)||!data.config.goals.some(g=>g.month===s.month))||s.phase!=='ended'&&s.result!==null||s.rewardPending&&!(s.phase==='action'&&s.actions===0&&[7,13,19].includes(s.month)&&s.goalsPassed.includes(s.month-1)||s.phase==='ended'&&s.month===24&&s.result==='clear'&&s.goalsPassed.includes(24)))fail();
    if(!validAllocation(s.initialLevels)||Object.keys(s.initialLevels).length!==Object.keys(CAREERS).length||!int(s.careerPoints,0,2)||s.careerPoints+Object.values(s.initialLevels).reduce((a,b)=>a+b,0)!==2)fail();
    for(const id of Object.keys(CAREERS)) {
      const initial=s.initialLevels[id];
      const expected=Math.min(MAX_LEVEL,initial+CAREERS[id].thresholds.filter(t=>s.stats[CAREERS[id].metric]>=t).length);
      if(s.levels[id]!==expected)fail();
    }
    if(s.phase==='ended'&&s.result==='failed') {
      s.result=null;
      if(s.month===24){s.result='clear';}else{s.month++;prepareMonth(s,data);}
    }
    s.signature=JSON.stringify(data);
    return JSON.parse(JSON.stringify(s));
  }
  const API={MAX_LEVEL,allocateCareer,careerProgress,careerEffect,boostGain,CAREERS,validateData,createGame,start,act,inspect,trade,boost,settle,reward,restore,assets,researchGain,monthlyResearch,researchCost,eventStage,remaining,planView,dividend,dividendMultiplier,workPay,probability,targets};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.KabuEngine=API;
})(typeof globalThis!=='undefined'?globalThis:this);
