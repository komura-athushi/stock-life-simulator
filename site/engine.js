'use strict';

// DOM-free rules shared by the browser and regression tests.
(function (root) {
  const CAREERS = {
    employee: { name: '会社員', icon: '▣', desc: '仕事で元手を作る。バイト収入が高く、仕事の実績でさらに成長。', growth: 'バイト3回 / 6回で昇格。1段階ごとにバイト収入＋8万円。' },
    trader: { name: 'トレーダー', icon: '⌁', desc: '情報収集で得られる調査ptが多い。知識を磨き、情報から勝ち筋を見つける。', growth: '情報収集3回 / 6回で昇格。1段階ごとに獲得調査pt＋1。' },
    influencer: { name: 'インフルエンサー', icon: '◉', desc: '交流すると追加で人脈が育つ。月末に好材料1件の実現確率を上げられる。', growth: '交流3回 / 6回で昇格。発信の効果が＋10 / 15 / 20ポイントに成長。' },
    wealthy: { name: '資産家', icon: '✦', desc: '最初から配当1.2倍。元手を投資し、配当を次の投資へつなげる。', growth: '累計配当20万円 / 100万円で昇格。配当倍率が＋0.15ずつ成長。' }
  };
  const STORIES = [
    { id: 'reporter', name: '駆け出し記者の独占取材', start: 1, end: 8, steps: ['記者に取材先を紹介する', '現地取材に同行する', '独占記事を一緒に完成させる'], reward: '15万円＋毎月の調査pt＋2', detail: '人脈のないところから、信頼できる情報源を育てる。' },
    { id: 'mentor', name: '配当投資家の研究会', start: 5, end: 14, steps: ['研究会に参加する', '企業の配当方針を調べる', '共同研究を発表する'], reward: '25万円＋配当倍率＋0.15', detail: '長く持つ企業を見極めるための、小さな研究会。' },
    { id: 'founder', name: '起業家の事業発表会', start: 11, end: 22, steps: ['事業計画に助言する', '協力企業を紹介する', '事業発表会を成功させる'], reward: '50万円＋ミライチップ100株', detail: '資金を出すだけではない関わり方で、企業を応援する。' }
  ];
  const ACHIEVEMENTS = [
    { id: 'student', name: '学びを武器に', target: 3, metric: 'studies', reward: '研究助成15万円＋調査pt獲得量＋1' },
    { id: 'researcher', name: '情報の目利き', target: 4, metric: 'investigations', reward: '調査pt獲得量＋1' },
    { id: 'connector', name: '顔の広い投資家', target: 3, metric: 'networks', reward: '毎月の調査pt＋1' },
    { id: 'dividend', name: 'お金が働き始める', target: 300000, metric: 'dividends', reward: '配当倍率＋0.15' },
    { id: 'profit', name: '利益を次の種に', target: 500000, metric: 'realized', reward: '成功報酬20万円' },
    { id: 'story', name: '最後までやり遂げる', target: 1, metric: 'stories', reward: 'すべてのバイト収入＋5万円' }
  ];
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  function validateData(data) {
    const int = (n,min,max) => Number.isSafeInteger(n) && n>=min && n<=max;
    if (!data || data.config?.schemaVersion !== 3 || data.config.months !== 24 || data.config.actionsPerMonth !== 2 || data.config.planSlots !== 4 || !int(data.config.initialResearchPoints,0,100) || !Array.isArray(data.config.researchCosts) || data.config.researchCosts.length !== 3 || !data.config.researchCosts.every(n=>int(n,1,100))) throw Error('ゲーム設定の形式が違います。');
    if (!int(data.config.initialCash,1,1e9)) throw Error('初期資金が不正です。');
    if (!Array.isArray(data.companies) || data.companies.length !== 6 || data.companies.some(c => typeof c.name !== 'string' || !Array.isArray(c.tags) || !c.tags.every(t => typeof t === 'string') || !int(c.price,1,1e7) || !Number.isFinite(c.yieldPct) || c.yieldPct < 0 || c.yieldPct > 20)) throw Error('銘柄データが不正です。');
    if (!Array.isArray(data.events) || data.events.length < 4 || data.events.some((e,i)=>e.id!==i || typeof e.title!=='string' || !Array.isArray(e.tags) || !e.tags.length || !e.tags.every(t=>data.companies.some(c=>c.tags.includes(t))) || !Array.isArray(e.stages) || e.stages.length<1 || e.stages.length>5 || e.stages.some(v=>!['title','text','success','failure'].every(k=>typeof v[k]==='string') || !int(v.duration,1,6) || !int(v.rate,1,1000) || !int(v.failureRate,-99,-1) || !int(v.prob,30,90)))) throw Error('予定データが不正です。');
    if (!data.events.some(e=>e.stages.length>1) || !data.events.some(e=>e.stages.length===1 && e.stages[0].duration===1)) throw Error('連続イベントと1か月の単発予定が必要です。');
    if (!Array.isArray(data.config.goals) || data.config.goals.length !== 4 || data.config.goals.some((g,i)=>g.month!==(i+1)*6 || !int(g.amount,1,1e12) || typeof g.title!=='string')) throw Error('目標データが不正です。');
    return data;
  }
  function createGame(data, seed = Date.now()) {
    validateData(data);
    return {
      version: 3, signature: JSON.stringify(data), rng: (Number(seed) >>> 0) || 1,
      career: null, month: 1, actions: 0, phase: 'start', cash: data.config.initialCash,
      prices: data.companies.map(c => c.price), qty: data.companies.map(() => 0), cost: data.companies.map(() => 0), yields: data.companies.map(c => c.yieldPct),
      knowledge: 0, contacts: 0, careerLevel: 0, dividendBonus: 0, workBonus: 0, researchIncome: 0, researchPoints: data.config.initialResearchPoints,
      stats: { works: 0, studies: 0, researches: 0, investigations: 0, networks: 0, stories: 0, dividends: 0, realized: 0, earned: 0, actions: 0 },
      plans: [], nextPlanId: 1, boosted: null, gig: false,
      stories: Object.fromEntries(STORIES.map(t => [t.id, { step: 0, expired: false }])),
      achievements: [], goalsPassed: [], rewardPending: false, result: null,
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
  function researchGain(s) { return 3 + Math.floor(s.knowledge/2) + (s.career==='trader'?1+s.careerLevel:0) + (s.achievements.includes('student')?1:0) + (s.achievements.includes('researcher')?1:0); }
  function monthlyResearch(s) { return s.researchIncome + Math.floor(s.contacts/3); }
  function researchCost(s,data,plan) { return plan.level<3 ? data.config.researchCosts[plan.level] : 0; }
  function eventStage(data,plan) { return data.events[plan.eventId].stages[plan.stage]; }
  function probability(s,plan,data) { return clamp(eventStage(data,plan).prob+plan.momentum+plan.boost,30,99); }
  function remaining(s,plan) { return plan.dueMonth-s.month+1; }
  // Only this projection is handed to the event-card renderer.
  function planView(s,data,plan) {
    const view={uid:plan.uid,level:plan.level,remaining:remaining(s,plan),cost:researchCost(s,data,plan)};
    if(plan.level>=1){const e=data.events[plan.eventId]; Object.assign(view,{title:eventStage(data,plan).title,tags:[...e.tags,...(e.stages.length>1?['連続イベント']:[])],stage:plan.stage+1,stages:e.stages.length,boost:plan.boost});}
    if(plan.level>=2){const v=eventStage(data,plan);Object.assign(view,{rate:v.rate,failureRate:v.failureRate});}
    if(plan.level>=3)view.probability=probability(s,plan,data);
    return view;
  }
  function dividendMultiplier(s) { return 1 + s.dividendBonus + (s.career === 'wealthy' ? 0.2 + s.careerLevel * 0.15 : 0); }
  function dividend(s) { return s.prices.reduce((sum, price, i) => sum + Math.floor(price * s.qty[i] * s.yields[i] / 100 * dividendMultiplier(s)), 0); }
  function workPay(s, gig = false) { return (gig ? 320000 : 180000) + s.workBonus + (s.career === 'employee' ? 60000 + s.careerLevel * 80000 : 0) + (gig ? s.contacts * 20000 : 0); }
  function targets(data, e) { return data.companies.map((c, i) => c.tags.some(t => e.tags.includes(t)) ? i : -1).filter(i => i >= 0); }
  function changePrice(s, indices, rate) { indices.forEach(i => { s.prices[i] = Math.max(1, Math.round(s.prices[i] * (1 + rate / 100))); }); }
  function makePlan(s,data,eventId,month,stage=0,previous=null) {
    const v=data.events[eventId].stages[stage];
    return {uid:s.nextPlanId++,eventId,stage,dueMonth:month+v.duration-1,level:previous?.level>=1?1:0,momentum:previous?.momentum||0,held:previous?.held||0,boost:0};
  }
  function fillPlans(s,data,initial=false) {
    while(s.plans.length<data.config.planSlots){
      let pool=data.events.filter(e=>!s.plans.some(p=>p.eventId===e.id));
      if(initial && s.plans.length===0) pool=pool.filter(e=>e.stages.length===1 && e.stages[0].duration===1);
      if(initial && s.plans.length===1) pool=pool.filter(e=>e.stages.length>1);
      if(!pool.length)throw Error('追加できる予定が不足しています。');
      s.plans.push(makePlan(s,data,pick(s,pool).id,s.month));
    }
  }
  function prepareMonth(s,data,initial=false) {
    s.actions=0; s.phase='action'; s.boosted=null; s.gig=random(s)<0.35;
    fillPlans(s,data,initial);
    if(!initial && monthlyResearch(s)>0){s.researchPoints+=monthlyResearch(s);record(s,'人脈から調査pt＋'+monthlyResearch(s));}
    for(const t of STORIES) if(s.month>t.end && s.stories[t.id].step<3 && !s.stories[t.id].expired){s.stories[t.id].expired=true;if(s.stories[t.id].step)record(s,'期限終了：'+t.name+'。あの約束は過ぎてしまった。');}
  }
  function start(s, data, career) {
    if (s.phase !== 'start' || !Object.hasOwn(CAREERS, career)) throw Error('目指す職業を選んでください。');
    s.career = career; prepareMonth(s, data, true); record(s, CAREERS[career].name + 'を目指してスタート。');
  }
  function checkProgress(s) {
    for (const a of ACHIEVEMENTS) {
      if (s.achievements.includes(a.id) || s.stats[a.metric] < a.target) continue;
      s.achievements.push(a.id);
      if (a.id === 'student') { s.cash += 150000; s.stats.earned += 150000; }
      if (a.id === 'connector') s.researchIncome++;
      if (a.id === 'dividend') s.dividendBonus += 0.15;
      if (a.id === 'profit') { s.cash += 200000; s.stats.earned += 200000; }
      if (a.id === 'story') s.workBonus += 50000;
      record(s, '実績達成「' + a.name + '」：' + a.reward + '（自動獲得）');
    }
    const n = s.career === 'employee' ? s.stats.works : s.career === 'trader' ? s.stats.researches : s.career === 'influencer' ? s.stats.networks : s.stats.dividends;
    const thresholds = s.career === 'wealthy' ? [200000, 1000000] : [3, 6];
    const level = thresholds.filter(t => n >= t).length;
    if (level > s.careerLevel) { s.careerLevel = level; record(s, '職業成長！ ' + CAREERS[s.career].name + ' Lv.' + (level + 1)); }
  }
  function act(s, data, action, target) {
    if (s.phase !== 'action' || s.rewardPending || s.actions >= 2) throw Error('今は行動できません。');
    if (action === 'work' || action === 'gig') {
      if (action === 'gig' && !s.gig) throw Error('今月の特別案件はありません。');
      const pay = workPay(s, action === 'gig'); s.cash += pay; s.stats.earned += pay; s.stats.works++;
      if (action === 'gig') s.gig = false;
      record(s, (action === 'gig' ? '特別案件' : 'バイト') + '：＋' + pay.toLocaleString('ja-JP') + '円');
    } else if (action === 'study') {
      if (s.knowledge >= 6) throw Error('知識は最大です。');
      s.knowledge++; s.stats.studies++; record(s, '勉強：知識が ' + s.knowledge + ' に成長。');
    } else if (action === 'network') {
      if (s.contacts >= 9) throw Error('人脈は最大です。');
      s.contacts = Math.min(9, s.contacts + (s.career === 'influencer' ? 2 : 1)); s.stats.networks++;
      record(s, '交流：人脈が ' + s.contacts + ' に成長。');
    } else if (action === 'research') {
      const points=researchGain(s); s.researchPoints+=points; s.stats.researches++;
      record(s,'情報収集：調査pt＋'+points);
    } else if (action === 'story') {
      const t = STORIES.find(t => t.id === target), progress = s.stories[target];
      if (!t || s.month < t.start || s.month > t.end || progress.step >= 3) throw Error('このイベントは進められません。');
      record(s, t.name + '：' + t.steps[progress.step]); progress.step++;
      if (progress.step === 3) {
        s.stats.stories++;
        const pay = target === 'reporter' ? 150000 : target === 'mentor' ? 250000 : 500000;
        s.cash += pay; s.stats.earned += pay;
        if (target === 'reporter') s.researchIncome+=2;
        if (target === 'mentor') s.dividendBonus += 0.15;
        if (target === 'founder') s.qty[0] += 100;
        record(s, '連続イベント完走！ ' + t.reward);
      }
    } else throw Error('不明な行動です。');
    s.actions++; s.stats.actions++; checkProgress(s);
    if (s.actions === 2) { s.phase = 'trade'; record(s, '月末の売買が可能になりました。取引後に月を締めてください。'); }
  }
  function trade(s, data, index, buy, quantity) {
    if (s.phase !== 'trade' || s.rewardPending) throw Error('売買は2回行動した後の月末だけ可能です。');
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
    if(!p || p.level>=3)throw Error('調査する予定を選んでください。');
    const cost=researchCost(s,data,p);if(s.researchPoints<cost)throw Error('調査ptが足りません。情報収集で貯めましょう。');
    s.researchPoints-=cost;p.level++;s.stats.investigations++;
    record(s,'予定の調査：'+['','タグ','値動き','成功率'][p.level]+'を確認（'+cost+'pt）');
    checkProgress(s);
  }
  function boost(s,data,uid) {
    const p=s.plans.find(p=>p.uid===uid);
    if(s.phase!=='trade'||s.career!=='influencer'||s.boosted!==null||!p||p.level<1||p.boost)throw Error('月末に、タグが判明した未発信の予定を選んでください。');
    p.boost=10+s.careerLevel*5;s.boosted=uid;record(s,'発信：「'+eventStage(data,p).title+'」を応援。');
  }
  function settle(s, data) {
    if (s.phase !== 'trade' || s.rewardPending) throw Error('2回行動してから月を締めてください。');
    s.news = [];
    const waiting=[];
    for(const p of s.plans){
      if(p.dueMonth>s.month){waiting.push(p);continue;}
      const e=data.events[p.eventId],v=eventStage(data,p),indices=targets(data,e);
      const ok=random(s)*100<probability(s,p,data),rate=ok?v.rate:v.failureRate;
      changePrice(s,indices,rate);
      if(indices.some(i=>s.qty[i]>0))p.held++;
      let text=ok?v.success:v.failure;
      const chain=e.stages.length>1,final=p.stage===e.stages.length-1;
      if(chain && !final){
        p.momentum=clamp(p.momentum+(ok?10:-10),-25,25);
        waiting.push(makePlan(s,data,p.eventId,s.month+1,p.stage+1,p));
        text+=' 次の段階へ続く。';
      }else if(chain && final && ok){
        indices.forEach(i=>s.yields[i]=Math.min(20,s.yields[i]+1));
        text+=' 計画完遂。配当利回り＋1ポイント。';
        if(p.held>=2){const bonus=Math.floor(indices.reduce((n,i)=>n+s.prices[i]*s.qty[i],0)*0.04);if(bonus){s.cash+=bonus;s.stats.earned+=bonus;text+=' 保有ボーナス＋'+bonus.toLocaleString('ja-JP')+'円。';}}
      }
      s.news.push({title:v.title,text,rate,indices,kind:(chain?'連続イベント '+(p.stage+1)+'/'+e.stages.length:'予定')+'・'+(ok?'成功':'失敗')});
    }
    s.plans=waiting;
    const payout = dividend(s); s.cash += payout; s.stats.dividends += payout;
    s.news.push({ title: '今月の配当', text: 'イベント後の株価で計算。＋' + payout.toLocaleString('ja-JP') + '円。次の月末に再投資できます。', rate: null, indices: [], kind: '入金' });
    checkProgress(s);
    s.history.push({ month: s.month, assets: assets(s), prices: [...s.prices] });
    for (const n of s.news) record(s, n.kind + '：' + n.title + (n.rate === null ? '' : ' ' + (n.rate > 0 ? '+' : '') + n.rate + '%'));
    record(s, '配当入金：＋' + payout.toLocaleString('ja-JP') + '円');
    const goal = data.config.goals.find(g => g.month === s.month);
    if (goal && assets(s) < goal.amount) { s.phase = 'ended'; s.result = 'failed'; record(s, '期限目標未達。今回の挑戦はここで終了。'); return; }
    if (goal) { s.goalsPassed.push(goal.month); record(s, '期限目標達成！ ' + goal.title); }
    if (s.month === data.config.months) { s.phase = 'ended'; s.result = 'clear'; record(s, '2年間の挑戦をクリア！ 夢の職業へ。'); return; }
    s.month++; prepareMonth(s, data);
    if (goal) s.rewardPending = true;
  }
  function reward(s, choice) {
    if (!s.rewardPending || s.phase !== 'action' || !['cash', 'dividend', 'network'].includes(choice)) throw Error('目標報酬を選んでください。');
    if (choice === 'cash') { const pay = 300000 * s.goalsPassed.length; s.cash += pay; s.stats.earned += pay; record(s, '目標報酬：投資資金＋' + pay.toLocaleString('ja-JP') + '円'); }
    if (choice === 'dividend') { s.dividendBonus += 0.2; record(s, '目標報酬：配当倍率＋0.20'); }
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
    if(!s||s.version!==3||!compatibleSignature(s.signature,data)||!int(s.rng,1,4294967295)||!int(s.month,1,24)||!int(s.actions,0,2)||!['start','action','trade','ended'].includes(s.phase)||!(s.career===null||Object.hasOwn(CAREERS,s.career))||!num(s.cash)||!array(s.prices,6,n=>int(n,1))||!array(s.qty,6,n=>int(n)&&n%100===0)||!array(s.cost,6,n=>num(n))||!array(s.yields,6,n=>num(n)&&n<=20))fail();
    if(!int(s.knowledge,0,6)||!int(s.contacts,0,9)||!int(s.careerLevel,0,2)||!num(s.dividendBonus)||!int(s.workBonus)||!int(s.researchIncome)||!int(s.researchPoints)||!int(s.nextPlanId,1)||typeof s.gig!=='boolean'||typeof s.rewardPending!=='boolean'||!(s.boosted===null||int(s.boosted,1,s.nextPlanId-1)))fail();
    if(!s.stats||!['works','studies','researches','investigations','networks','stories','dividends','earned','actions'].every(k=>int(s.stats[k]))||!num(s.stats.realized,-Number.MAX_VALUE)||s.stats.actions!==(s.month-1)*2+s.actions)fail();
    if(!Array.isArray(s.plans)||s.plans.length>4||new Set(s.plans.map(p=>p.uid)).size!==s.plans.length||new Set(s.plans.map(p=>p.eventId)).size!==s.plans.length||s.plans.some(p=>!int(p.uid,1,s.nextPlanId-1)||!int(p.eventId,0,data.events.length-1)||!int(p.stage,0,data.events[p.eventId].stages.length-1)||!int(p.dueMonth,s.month,s.month+6)||!int(p.level,0,3)||!int(p.momentum,-25,25)||!int(p.held,0,p.stage)||![0,10,15,20].includes(p.boost)))fail();
    if(s.phase!=='start'&&s.phase!=='ended'&&s.plans.length!==4||s.phase==='start'&&s.plans.length!==0)fail();
    if(!Array.isArray(s.achievements)||new Set(s.achievements).size!==s.achievements.length||!s.achievements.every(id=>ACHIEVEMENTS.some(a=>a.id===id))||!Array.isArray(s.goalsPassed)||!s.goalsPassed.every((m,i)=>m===(i+1)*6&&m<=s.month)||!s.stories||!STORIES.every(t=>int(s.stories[t.id]?.step,0,3)&&typeof s.stories[t.id].expired==='boolean'))fail();
    if(!array(s.history,s.phase==='ended'?s.month+1:s.month,(h)=>h&&int(h.month,0,24)&&num(h.assets)&&array(h.prices,6,n=>int(n,1)))||!s.history.every((h,i)=>h.month===i)||!Array.isArray(s.log)||s.log.length>300||s.log.some(l=>!int(l.month,1,24)||typeof l.message!=='string')||!Array.isArray(s.news)||s.news.length>5||s.news.some(n=>!['title','text','kind'].every(k=>typeof n[k]==='string')||!(n.rate===null||Number.isFinite(n.rate))||!Array.isArray(n.indices)||!n.indices.every(i=>int(i,0,5))))fail();
    if(s.phase==='start'&&(s.career!==null||s.month!==1||s.actions!==0)||s.phase!=='start'&&s.career===null||s.phase==='action'&&s.actions>=2||['trade','ended'].includes(s.phase)&&s.actions!==2||s.phase==='ended'&&(!['failed','clear'].includes(s.result)||!data.config.goals.some(g=>g.month===s.month))||s.phase!=='ended'&&s.result!==null||s.rewardPending&&(s.phase!=='action'||s.actions!==0||![7,13,19].includes(s.month)))fail();
    s.signature=JSON.stringify(data);
    return JSON.parse(JSON.stringify(s));
  }
  const API={CAREERS,STORIES,ACHIEVEMENTS,validateData,createGame,start,act,inspect,trade,boost,settle,reward,restore,assets,researchGain,monthlyResearch,researchCost,eventStage,remaining,planView,dividend,dividendMultiplier,workPay,probability,targets};
  if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.KabuEngine=API;
})(typeof globalThis!=='undefined'?globalThis:this);
