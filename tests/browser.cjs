// Optional browser regression test. NODE_PATH may point at a bundled Playwright installation.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const E=require('../site/engine.js'),root=path.resolve(__dirname,'../site');
const data=Object.fromEntries(['companies','events','config'].map(n=>[n,JSON.parse(fs.readFileSync(path.join(root,'data',n+'.json'),'utf8').replace(/^\uFEFF/,''))]));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(url==='/'?'/index.html':url));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,bytes)=>{res.writeHead(err?404:200,{'Content-Type':types[path.extname(file)]||'text/plain'});res.end(err?'Not found':bytes);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.KABU_BROWSER?{executablePath:process.env.KABU_BROWSER}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[],key='kabugurashi-careers-v4:/';
  page.on('pageerror',e=>errors.push(e.message));
  const output=process.env.KABU_SCREENSHOTS||os.tmpdir();
  async function saved(){return JSON.parse(await page.evaluate(k=>localStorage.getItem(k),key));}
  async function finish(){await page.locator('#report[open]').waitFor();const before=await saved();if(await page.locator('#skipScene').isVisible())await page.locator('#skipScene').click();await page.locator('#closeReport').click();assert.deepEqual(await saved(),before,'presentation must not mutate the game');}
  async function inject(s){E.restore(JSON.stringify(s),data);await page.evaluate(({key,raw})=>localStorage.setItem(key,raw),{key,raw:JSON.stringify(s)});await page.reload();await page.locator(s.phase==='start'?'#career':'#play').waitFor({state:'visible'});}
  await page.goto('http://127.0.0.1:'+server.address().port);await page.locator('[data-start]').waitFor();
  // The new save key leaves the older game's progress intact.
  await page.evaluate(()=>localStorage.setItem('kabugurashi-two-years-v2:/','old-record'));
  await page.reload();assert((await page.locator('#saveWarning').innerText()).includes('新しい挑戦'));
  await page.locator('[data-allocate="trader"][data-delta="1"]').click({clickCount:1});await page.locator('[data-allocate="trader"][data-delta="1"]').click();await page.locator('[data-start]').click();await finish();
  assert.equal(await page.locator('.plan').count(),4);assert.equal(await page.locator('#projects').count(),0);
  assert.equal(await page.locator('#information .tag').count(),0);
  assert.equal(await page.locator('#information .success-chance').count(),0);
  assert.equal(await page.locator('#information .plan-rates').count(),0);
  assert.equal(await page.locator('#information .chain-stage').count(),0);
  assert(!(await page.locator('#information').innerText()).includes(data.events[(await saved()).plans[0].eventId].title));
  assert(await page.locator('[data-buy="0"]').isEnabled());
  assert.equal(await page.evaluate(()=>localStorage.getItem('kabugurashi-two-years-v2:/')),'old-record');
  assert.equal(await page.locator('.stock-chart').count(),6);
  assert.equal(await page.locator('[data-action]').count(),4);
  assert.equal(await page.locator('#stories').count(),0);
  assert.equal(await page.locator('.career-quest').count(),4);
  assert.equal((await saved()).levels.trader,2);
  assert(await page.locator('[data-settle]').isEnabled());
  const chain=(await saved()).plans[1],selector='[data-plan="'+chain.uid+'"]';
  await page.locator(selector+' [data-inspect]').click();
  assert((await page.locator('#reportBody').innerText()).includes('タグ'));
  assert(!(await page.locator('#reportBody').innerText()).includes('%'));
  await finish();assert.equal((await saved()).actions,0);assert.equal((await saved()).researchPoints,2);
  assert((await page.locator(selector).innerText()).includes('連続イベント'));
  assert((await page.locator(selector).innerText()).includes('1 / 3段階目'));
  assert.equal(await page.locator(selector+' .plan-rates').count(),0);
  await page.reload();await page.locator(selector).waitFor();assert.equal((await saved()).plans[1].level,1);
  await page.locator(selector+' [data-inspect]').click();await finish();
  assert.equal((await saved()).researchPoints,0);assert.equal((await saved()).actions,0);
  assert.equal(await page.locator(selector+' .plan-rates').count(),1);assert.equal(await page.locator(selector+' .success-chance').count(),0);
  assert(await page.locator(selector+' [data-inspect]').isDisabled());
  await page.locator('[data-action="research"]').click();assert((await page.locator('#reportBody').innerText()).includes('調査pt'));await finish();
  assert.equal((await saved()).actions,1);assert.equal((await saved()).researchPoints,5);
  await page.locator(selector+' [data-inspect]').click();await finish();
  assert.equal((await saved()).actions,1);assert.equal((await saved()).researchPoints,2);assert.equal(await page.locator(selector+' .success-chance').count(),1);
  await page.locator('#information').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'kabu-research-desktop.png')});
  await page.locator('[data-action="work"]').click();await finish();assert(await page.locator('[data-buy="0"]').isEnabled());
  await page.locator('[data-buy="2"]').click();await page.locator('[data-settle]').click();
  assert(!(await page.locator('#reportBody').innerText()).includes('今月の資産増減'));
  await finish();assert((await page.locator('#summary').innerText()).includes('1年目 2月'));
  const after=await saved(),next=after.plans.find(p=>p.eventId===chain.eventId);assert(next);assert.equal(next.stage,1);assert.equal(next.level,1);assert.equal(next.dueMonth,3);
  const nextSelector='[data-plan="'+next.uid+'"]';assert((await page.locator(nextSelector).innerText()).includes('あと2か月'));assert((await page.locator(nextSelector).innerText()).includes('2 / 3段階目'));assert.equal(await page.locator(nextSelector+' .plan-rates').count(),0);
  await page.setViewportSize({width:390,height:844});await page.locator('#information').scrollIntoViewIfNeeded();
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile horizontal overflow');
  await page.screenshot({path:path.join(output,'kabu-research-mobile.png')});
  // Prepare a future event to check UI persistence and hidden rate/probability at the first level.
  const waiting=E.createGame(data,31);E.start(waiting,data,{wealthy:2});waiting.plans[0].dueMonth=3;E.inspect(waiting,data,waiting.plans[0].uid);
  const uid=waiting.plans[0].uid;await inject(waiting);
  for(let i=0;i<2;i++){await page.locator('[data-action="work"]').click();await finish();}await page.locator('[data-settle]').click();await finish();
  assert((await page.locator('[data-plan="'+uid+'"]').innerText()).includes('あと2か月'));
  await page.reload();assert.equal((await saved()).plans.find(p=>p.uid===uid).level,1);
  // Failed deadline, successful reward selection, and clear retain their original rules.
  const losing=E.createGame(data,42);E.start(losing,data,{trader:2});
  for(let m=1;m<=6;m++){E.act(losing,data,'work');E.act(losing,data,'work');if(m<6)E.settle(losing,data);}losing.cash=1;
  await inject(losing);await page.locator('[data-settle]').click();await page.locator('#skipScene').click();assert((await page.locator('#reportBody').innerText()).includes('目標未達'));await finish();assert(await page.locator('[data-settle]').isDisabled());
  const winning=E.createGame(data,43);E.start(winning,data,{wealthy:2});winning.cash=1e9;
  for(let m=1;m<=6;m++){E.act(winning,data,'work');E.act(winning,data,'work');E.settle(winning,data);}
  await inject(winning);assert(await page.locator('#reward').isVisible());await page.locator('[data-reward="network"]').click();await finish();assert.equal((await saved()).researchIncome,2);assert((await saved()).plans.every(p=>p.level===0));
  E.reward(winning,'cash');for(let m=7;m<=24;m++){if(winning.rewardPending)E.reward(winning,'cash');E.act(winning,data,'work');E.act(winning,data,'work');E.settle(winning,data);}await inject(winning);assert((await page.locator('#outcome').innerText()).includes('クリア'));assert(await page.locator('[data-buy="0"]').isDisabled());
  await page.locator('#reset').click();await page.locator('#cancelRestart').click();assert((await page.locator('#outcome').innerText()).includes('クリア'));
  await page.locator('#reset').click();await page.locator('#confirmRestart').click();await page.locator('[data-allocate="influencer"][data-delta="1"]').click();await page.locator('[data-allocate="influencer"][data-delta="1"]').click();await page.locator('[data-start]').click();await finish();
  await page.locator('#pace').click();await page.locator('[data-action="research"]').click();assert((await page.locator('#sceneCount').innerText()).includes('1 / 1'));await finish();await page.reload();assert((await page.locator('#pace').innerText()).includes('短め'));
  // Unresearched repeat posts, growth popup and partial-month reload.
  const social=E.createGame(data,71);E.start(social,data,{influencer:2});
  const postPlan=social.plans[0];postPlan.eventId=data.events.find(e=>e.stages[0].prob<=65&&!social.plans.some(p=>p.eventId===e.id)).id;
  postPlan.dueMonth=3;await inject(social);
  for(let i=0;i<2;i++){
    await page.locator('#postTarget').selectOption(String(postPlan.uid));await page.locator('[data-action="post"]').click();
    if(i===1){const text=await page.locator('#reportBody').innerText();assert(text.includes('SNS投稿 2回達成'));assert(text.includes('16ポイント'));}
    await finish();
  }
  assert.equal((await saved()).levels.influencer,3);assert.equal((await saved()).plans.find(p=>p.uid===postPlan.uid).boost,28);
  assert.equal((await saved()).plans.find(p=>p.uid===postPlan.uid).level,0);
  await page.locator('[data-settle]').click();await finish();
  await page.locator('[data-settle]').click();await finish();await page.reload();
  assert.equal((await saved()).month,3);assert.equal((await saved()).stats.actions,2);
  const progress=await page.locator('#progress').innerText();assert(progress.includes('あと'));assert(!progress.includes('倍率'));
  await page.locator('#progress').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'kabu-careers-mobile.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'career mobile horizontal overflow');
  await page.setViewportSize({width:1440,height:1000});await page.locator('.stock').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'kabu-market-desktop.png')});
  // Normal presentation includes both the achieved condition and new effect.
  const student=E.createGame(data,91);E.start(student,data,{trader:2});await inject(student);
  await page.locator('#pace').click();
  await page.locator('[data-action="study"]').click();await finish();
  await page.locator('[data-action="study"]').click();await page.locator('#closeReport').click();
  const growth=await page.locator('#reportBody').innerText();assert(growth.includes('勉強 2回達成'));assert(growth.includes('6pt'));await finish();
  // Split points, refund a level, reload the allocation, and start with unused points.
  await inject(E.createGame(data,15));
  await page.locator('[data-start]').waitFor();
  assert(!/[0-9０-９%％]/.test(await page.locator('.career-description').allTextContents().then(x=>x.join(''))));
  for(const id of ['employee','trader'])await page.locator('[data-allocate="'+id+'"][data-delta="1"]').click();
  assert.equal((await saved()).careerPoints,0);
  assert(await page.locator('[data-allocate="wealthy"][data-delta="1"]').isDisabled());
  await page.reload();await page.locator('[data-start]').waitFor();
  await page.locator('[data-start]').click();await finish();
  assert.equal((await saved()).levels.employee,1);assert.equal((await saved()).levels.trader,1);
  await page.locator('#reset').click();await page.locator('#confirmRestart').click();
  await page.locator('[data-allocate="wealthy"][data-delta="1"]').click();
  await page.locator('[data-allocate="wealthy"][data-delta="-1"]').click();
  await page.setViewportSize({width:390,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(output,'kabu-allocation-mobile.png'),fullPage:true});
  await page.locator('[data-start]').click();await finish();
  assert(Object.values((await saved()).levels).every(n=>n===0));assert.equal((await saved()).careerPoints,2);
  await page.locator('[data-settle]').click();await finish();await page.reload();
  assert.equal((await saved()).month,2);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('Browser passed: hidden data, all 3 research levels, point costs, action limits, persistent timing, chain progression, reload, legacy save isolation, goals, presentation, and mobile.');
  console.log('Screenshots: '+output);
 }finally{await browser.close();server.close();}
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
