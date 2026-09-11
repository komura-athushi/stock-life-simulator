'use strict';
function initializeGame(data) {
  const E = KabuEngine, $ = id => document.getElementById(id);
  const KEY = 'kabugurashi-careers-v4:' + location.pathname;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = n => Math.round(n).toLocaleString('ja-JP') + '円';
  const date = m => Math.floor((m - 1) / 12) + 1 + '年目 ' + ((m - 1) % 12 + 1) + '月';
  const signed = n => (n > 0 ? '+' : '') + n + '%';
  const tags = ts => ts.map(t => '<span class="tag">' + esc(t) + '</span>').join('');
  const disabled = ok => ok ? '' : ' disabled';
  const theatre = createPresentation();
  const careerFlavour = {
    employee: 'バイトを重ねるほど、バイトで得られる収入が増える。',
    wealthy: '配当を受け取るほど、配当の倍率が上がる。',
    influencer: 'SNS投稿を重ねるほど、投稿で上げられるイベントの発生確率が増える。',
    trader: '勉強を重ねるほど、情報収集で得られる調査ptが増える。'
  };
  let s = E.createGame(data), timer;
  function toast(message) { $('notice').textContent = message; clearTimeout(timer); timer = setTimeout(() => { $('notice').textContent = ''; }, 5500); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); $('saveWarning').hidden = true; return true; }
    catch { $('saveWarning').hidden = false; $('saveWarning').textContent = '保存の再試行が必要です。画面を開いたまま、ブラウザの保存設定や空き容量を確認して「保存」を押してください。'; return false; }
  }
  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) { if(localStorage.getItem('kabugurashi-plans-v3:' + location.pathname)||localStorage.getItem('kabugurashi-two-years-v2:' + location.pathname)) { $('saveWarning').hidden=false; $('saveWarning').textContent='職業Lv版へようこそ。新しい挑戦を始めよう！ 以前の記録もブラウザに保管されています。'; } return false; }
    if (raw.length > 2000000) throw Error('保存データが大きすぎます。');
    s = E.restore(raw, data); return true;
  }
  function perform(operation, message) {
    try { operation(); save(); render(); if (message !== false) toast(message || s.log[0]?.message || '完了しました'); return true; }
    catch (error) { toast(error.message); return false; }
  }
  function discoveries(before) {
    return Object.entries(E.CAREERS).flatMap(([id,c]) => {
      const scenes=[];
      for(let level=before.levels[id]+1;level<=s.levels[id];level++) {
        const threshold=c.thresholds[level-1-s.initialLevels[id]];
        scenes.push({label:'職業Lvアップ',mood:'gold',art:'stars',icon:c.icon,title:c.name+' Lv.'+level,text:c.activity+' '+threshold.toLocaleString('ja-JP')+c.unit+'達成！',rows:[['新しい力',E.careerEffect(id,level)]],word:'LEVEL UP'});
      }
      return scenes;
    });
  }
  function actionWithScene(action, target) {
    const before=structuredClone(s);
    if(!perform(()=>E.act(s,data,action,target),false))return;
    const variants={
      work:['ひと仕事、やり遂げた。','今日の頑張りが、次の投資の元手になる。','work','▣'],
      research:['手がかりが、集まってきた。','集めた情報を、気になるイベントに使ってみよう。','study','⌕'],
      study:['昨日より、少し読める。','ノートに重なる学びが、情報を集める力になる。','study','▤'],
      post:['あなたの声が、広がっていく。','小さな投稿が、未来のチャンスを後押しする。','social','◉']
    };
    const [title,text,art,icon]=variants[action];
    const rows=action==='work'?[['入金','＋'+yen(s.cash-before.cash)]]:action==='research'?[['調査pt',before.researchPoints+' → '+s.researchPoints]]:action==='study'?[['勉強',s.stats.studies+'回']]:[['応援したイベント','#'+target],['発生確率','＋'+(s.plans.find(p=>p.uid===target).boost-before.plans.find(p=>p.uid===target).boost)+'ポイント']];
    const scene={label:date(before.month)+'・'+(before.actions+1)+'回目の行動',title,text,art,icon,rows,word:action.toUpperCase()},extra=discoveries(before);
    theatre.play([scene,...extra],null,{...scene,rows:[...rows,...extra.flatMap(x=>[[x.title,x.text],...x.rows])]});
  }
  function inspectWithScene(uid) {
    const before=structuredClone(s);
    if(!perform(()=>E.inspect(s,data,uid),false))return;
    const v=E.planView(s,data,s.plans.find(p=>p.uid===uid));
    const rows=v.level===1?[['タグ',v.tags.join(' / ')],...(v.stages>1?[['連続イベント',v.stage+' / '+v.stages+'段階目']]:[])]:v.level===2?[['成功したら',signed(v.rate)],['失敗したら',signed(v.failureRate)]]:[['発生確率',v.probability+'%']];
    rows.push(['調査pt',before.researchPoints+' → '+s.researchPoints]);
    const scene={label:['','タグが判明','値動きが判明','発生確率が判明'][v.level],art:'study',icon:'⌕',title:v.title,text:['','噂の向かう先が、見えてきた。','期待の大きさと、その裏側が見えてきた。','集めた話が、ひとつの見通しになった。'][v.level],rows,word:'RESEARCH FILE'};
    const extra=discoveries(before);
    theatre.play([scene,...extra],null,{...scene,rows:[...rows,...extra.map(x=>[x.label,x.title+' '+x.text])]});
  }
  function canAct() { return s.phase === 'action' && !s.rewardPending; }
  function heading(n, title, sub) { return '<div class="section-heading"><span class="eyebrow">' + n + '</span><h2>' + title + '</h2>' + (sub ? '<p class="muted">' + sub + '</p>' : '') + '</div>'; }
  function actionCard(icon, title, text, button, action, available = true) {
    return '<article class="event"><span class="action-icon">' + icon + '</span><h3>' + title + '</h3><p class="muted">' + text + '</p><button data-action="' + action + '"' + disabled(canAct() && available) + '>' + button + ' <small>・1行動</small></button></article>';
  }
  function render() {
    const starting = s.phase === 'start', ended = s.phase === 'ended';
    $('career').hidden = !starting; $('play').hidden = starting; $('save').disabled = starting;
    if (starting) {
      $('career').innerHTML = '<div class="hero"><div class="eyebrow">YOUR OWN BEGINNING</div><h1>得意を育てて、<br>自分らしい一歩を。</h1><p>働く。学ぶ。発信する。<br>この街で、あなたの投資家生活が始まる。</p></div><h2>はじめの得意を育てよう</h2><p class="muted">職業ptで好きな職業のLvを上げよう。ひとつを伸ばしても、分けて育てても、そのまま出発してもOK。</p><div class="allocation-wallet" role="status" aria-live="polite">残り職業pt <strong>'+s.careerPoints+'</strong><small>1ptでLvを1アップ・スタート前に振り分け</small></div><div class="career-grid">'+Object.entries(E.CAREERS).map(([id,c])=>'<article class="event career-card"><span class="action-icon">'+c.icon+'</span><h3>'+c.name+'</h3><p class="career-description">'+careerFlavour[id]+'</p><div class="allocation-controls"><button data-allocate="'+id+'" data-delta="-1" aria-label="'+c.name+'のLvを下げる"'+disabled(s.initialLevels[id]>0)+'>−</button><strong>Lv.'+s.initialLevels[id]+'</strong><button data-allocate="'+id+'" data-delta="1" aria-label="'+c.name+'のLvを上げる"'+disabled(s.careerPoints>0)+'>＋</button></div></article>').join('')+'</div><div class="banner row"><p>準備ができたら、あなたの物語を始めよう。</p><button class="primary" data-start>この振り分けでスタート →</button></div>';

      return;
    }
    const total = E.assets(s);
    const phase = ended ? '挑戦終了' : s.rewardPending ? '目標報酬を選ぼう' : s.phase === 'trade' ? '行動完了・投資を整えよう' : s.actions === 0 ? '前半・行動を選ぼう' : '後半・行動を選ぼう';
    $('summary').innerHTML = '<div class="month-title row"><div><div class="eyebrow">YOUR INVESTOR LIFE</div><h1>' + date(s.month) + '</h1><p class="muted">' + phase + '</p></div><div class="turn-steps"><span class="' + (s.actions >= 1 ? 'complete' : 'current') + '">① 前半</span><span class="' + (s.actions >= 2 ? 'complete' : s.actions === 1 ? 'current' : '') + '">② 後半</span><span class="' + (s.phase === 'trade' ? 'current' : '') + '">③ 月末決算</span></div></div><div class="stats"><div class="box stat"><small>総資産</small><strong>' + yen(total) + '</strong></div><div class="box stat"><small>使える現金</small><strong>' + yen(s.cash) + '</strong></div><div class="box stat"><small>累計配当</small><strong class="up">' + yen(s.stats.dividends) + '</strong></div><div class="box stat"><small>使った行動</small><strong>' + s.stats.actions + '<small> / 48回</small></strong></div></div>';
    $('outcome').innerHTML = ended ? '<div class="finish ' + (s.result === 'failed' ? 'failure' : '') + '"><div class="eyebrow">' + (s.result === 'clear' ? 'DREAM ACHIEVED' : 'TRY ANOTHER PATH') + '</div><h2>' + (s.result === 'clear' ? '2年間をクリア！ 自分らしい未来への第一歩。' : '今回の挑戦は、ここまで。') + '</h2><p>最終資産 ' + yen(total) + ' ／ 職業Lv合計 ' + Object.values(s.levels).reduce((a,b)=>a+b,0) + ' ／ 行動 ' + s.stats.actions + '回</p><p>' + (s.result === 'clear' ? '育てた能力と積み重ねた投資が、実を結びました。' : 'バイトで元手を補う、学びと発信を育てる、配当を再投資する。履歴を振り返り、次の作戦へ。') + '</p><button data-restart class="primary">新しい挑戦へ</button></div>' : '';
    $('goals').innerHTML = '<div class="goal-grid">' + data.config.goals.map(g => {
      const passed = s.goalsPassed.includes(g.month), current = !passed && g.month >= s.month;
      return '<article class="goal ' + (passed ? 'passed' : current && !data.config.goals.some(x => x.month >= s.month && x.month < g.month) ? 'selected' : '') + '"><small>' + date(g.month) + '末 ' + (passed ? '✓ 達成' : '') + '</small><strong>' + yen(g.amount) + '</strong><span>' + esc(g.title) + '</span><progress max="' + g.amount + '" value="' + (passed ? g.amount : Math.min(total, g.amount)) + '" aria-label="' + esc(g.title) + 'の達成度"></progress>' + (current && !ended ? '<small>期限まで' + (g.month - s.month + 1) + 'か月 / あと' + yen(Math.max(0, g.amount - total)) + '</small>' : '') + '</article>';
    }).join('') + '</div>';
    $('reward').hidden = !s.rewardPending;
    $('reward').innerHTML = '<h2>目標突破！ 次の半年の力を選ぼう</h2><p>次の半年に向けて、ひとつ選ぼう。</p><div class="cards"><button data-reward="cash">投資資金<br>＋' + yen(300000 * s.goalsPassed.length) + '</button><button data-reward="dividend">複利を育てる<br>配当倍率＋0.20</button><button data-reward="network">情報網を広げる<br>毎月の調査pt＋2</button></div>';
    renderActions(); renderInformation(); renderMarket(); renderProgress(); renderChart();
    const chapter = data.config.goals.find(g => g.month >= s.month) || data.config.goals.at(-1);
    const roadmap = $('goals').innerHTML;
    $('goals').innerHTML = '<div class="chapter-goal"><div><small>' + date(chapter.month) + '末までに</small><strong>' + yen(chapter.amount) + '</strong></div><div><span>' + esc(chapter.title) + '</span><p>' + (ended ? '今回の挑戦の記録' : chapter.month === s.month ? '今月が期限。月末の総資産で判定。' : 'あと' + (chapter.month - s.month + 1) + 'か月 / 目標を目指そう') + '</p></div></div><details class="roadmap"><summary>2年間の目標を見る</summary>' + roadmap + '</details>';
    $('endTurn').innerHTML = '<div class="row"><div><h2>' + (ended ? '今回の挑戦は終了しました' : s.phase === 'trade' ? '売買が済んだら、今月の答え合わせ。' : '今月はあと' + (2 - s.actions) + '回行動できます') + '</h2><p class="muted">' + (ended ? '結果と履歴を振り返れます。' : '配当見込み ' + yen(E.dividend(s)) + '（値動きで変わります）') + '</p></div><button class="primary" data-settle' + disabled(['action','trade'].includes(s.phase)&&!s.rewardPending) + '>月を締める →</button></div>';
    $('news').innerHTML = s.news.length ? newsHTML(s.news) : '<p class="muted">月を締めると、ここに結果が届きます。</p>';
    $('log').innerHTML = s.log.map(l => '<li><small>' + date(l.month) + '</small><br>' + esc(l.message) + '</li>').join('');
  }
  function renderActions() {
    $('actions').innerHTML=heading('01 / CHOOSE YOUR ACTION','今月を、何に使う？','残り'+(2-s.actions)+'行動。投資も月の決算も、好きなタイミングで。')+'<div class="cards">'+
      actionCard('▣','バイト','働いて元手を育てる。積み重ねがフリーターLvに。','＋'+yen(E.workPay(s)),'work')+
      actionCard('⌕','情報収集','イベントを読み解く手がかりを集める。','調査pt ＋'+E.researchGain(s),'research')+
      actionCard('▤','勉強','学びを重ね、トレーダーLvを育てる。','勉強する','study')+
      '<article class="event"><span class="action-icon">◉</span><h3>SNS投稿</h3><p class="muted">声を届けて、イベントの発生確率を＋'+E.boostGain(s)+'ポイント。重ねて応援しよう！ 上限95%。</p><label for="postTarget">応援するイベント</label><select id="postTarget">'+s.plans.map((p,i)=>{
        const v=E.planView(s,data,p),full=E.probability(s,p,data)>=95;
        return '<option value="'+p.uid+'"'+disabled(!full)+'>#'+p.uid+' '+esc(v.title||'未調査のイベント')+' / あと'+v.remaining+'か月'+(full?' / 応援は最高潮':'')+'</option>';
      }).join('')+'</select><button data-action="post"'+disabled(canAct()&&s.plans.some(p=>E.probability(s,p,data)<95)) +'>投稿する <small>・1行動</small></button></article></div><a class="text-link" href="#information">イベントを調べる ↓</a>';
  }
  function renderInformation() {
    const active=['action','trade'].includes(s.phase)&&!s.rewardPending;
    $('information').innerHTML=heading('RESEARCH FILES','未来のイベントを、読み解く。','タグ → 値動き → 発生確率')+'<div class="research-wallet"><div><small>調査pt</small><strong id="researchPoints">'+s.researchPoints+'<span> pt</span></strong></div><p>情報収集で貯めて、気になるイベントに使おう。</p><a href="#actions">情報収集へ ↑</a></div><div class="information-grid">'+s.plans.map(plan=>{
      const v=E.planView(s,data,plan),known=v.level>=1;
      const next=['タグを調べる','値動きを調べる','発生確率を調べる'][v.level];
      return '<article class="event plan '+(known?'known':'sealed')+'" data-plan="'+v.uid+'" data-level="'+v.level+'"><small>EVENT #'+v.uid+'</small><div class="plan-clock">◷ あと'+v.remaining+'か月'+(v.remaining===1?' <small>今月末</small>':'')+'</div>'+(known?'<div>'+tags(v.tags)+'</div><h3>'+esc(v.title)+'</h3>'+(v.stages>1?'<small class="chain-stage">'+v.stage+' / '+v.stages+'段階目</small>':''):'<h3 class="muted">未調査のイベント</h3>')+(v.level>=2?'<div class="plan-rates"><span class="up">成功 '+signed(v.rate)+'</span><span class="down">失敗 '+signed(v.failureRate)+'</span></div>':'')+(v.level>=3?'<div class="success-chance">発生確率 <strong>'+v.probability+'%</strong></div>':'')+(known?'<div class="investigation-steps" aria-label="情報 '+v.level+' / 3">'+['タグ','値動き','発生確率'].map((t,i)=>'<span class="'+(i<v.level?'opened':'')+'">'+t+'</span>').join('')+'</div>':'')+(v.level<3?'<button data-inspect="'+v.uid+'"'+disabled(active&&s.researchPoints>=v.cost)+'>'+next+' <strong>'+v.cost+'pt</strong></button>'+(active&&s.researchPoints<v.cost?'<small>あと'+(v.cost-s.researchPoints)+'pt</small>':''):'<small class="up">✓ 調査完了</small>')+(plan.boost?'<small class="up">応援の積み重ね ＋'+plan.boost+'ポイント</small>':'')+'</article>';
    }).join('')+'</div>';
  }
  function renderMarket() {
    const open = ['action','trade'].includes(s.phase)&&!s.rewardPending;
    $('market').innerHTML = heading('05 / MONTH-END TRADING', '資金を、どこへ置く？', open ? 'いつでも売買。イベントを読み、次の一手を。' : s.phase === 'ended' ? '2年間の投資を振り返ろう。' : '目標報酬を選んで、投資の続きへ。') + '<div class="stock-grid">' + data.companies.map((c, i) => {
      const base = s.history.length > 1 ? s.history[s.history.length - 2].prices[i] : c.price;
      const change = (s.prices[i] / base - 1) * 100, unreal = s.prices[i] * s.qty[i] - s.cost[i];
      return '<article class="stock"><div class="row"><h3>' + esc(c.name) + '</h3><small>' + tags(c.tags) + '</small></div><p class="company-description muted">' + esc(c.desc) + '</p><div class="row"><strong class="price">' + yen(s.prices[i]) + '</strong><span class="' + (change >= 0 ? 'up' : 'down') + '">' + signed(Number(change.toFixed(1))) + '</span></div>' + stockChart(i,c.name) + '<dl><dt>100株の購入費用</dt><dd>' + yen(s.prices[i] * 100) + '</dd><dt>保有株数</dt><dd>' + s.qty[i].toLocaleString('ja-JP') + '株</dd><dt>含み損益</dt><dd class="' + (unreal >= 0 ? 'up' : 'down') + '">' + yen(unreal) + '</dd><dt>毎月の配当利回り</dt><dd>' + s.yields[i] + '% × ' + E.dividendMultiplier(s).toFixed(2) + '</dd></dl><div class="trade"><label class="muted">株数 <input id="qty' + i + '" type="number" min="100" step="100" value="100" aria-label="' + esc(c.name) + 'の取引株数"' + disabled(open) + '></label><button data-buy="' + i + '" class="primary"' + disabled(open) + '>買う</button><button data-sell="' + i + '"' + disabled(open && s.qty[i] > 0) + '>売る</button><button class="small" data-max="' + i + '"' + disabled(open && s.cash >= s.prices[i] * 100) + '>最大購入</button><button class="small" data-all="' + i + '"' + disabled(open && s.qty[i] > 0) + '>全売却</button></div><details class="stock-history"><summary>株価の履歴</summary>' + s.history.map(h => '<small>' + (h.month ? date(h.month) : '開始時') + '：' + yen(h.prices[i]) + '</small><br>').join('') + '</details></article>';
    }).join('') + '</div>';
  }
  function stockChart(index,name) {
    const values=s.history.map(h=>h.prices[index]),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max(1,(hi-lo)*0.15),min=lo-pad,max=hi+pad;
    const x=i=>48+i/Math.max(1,values.length-1)*252,y=v=>100-(v-min)/(max-min)*76;
    const points=values.map((v,i)=>x(i)+','+y(v)).join(' ');
    return '<svg class="chart stock-chart" viewBox="0 0 320 132" role="img" aria-label="'+esc(name)+'の月別株価推移"><title>'+esc(name)+'：開始時 '+yen(values[0])+'、現在 '+yen(values.at(-1))+'</title><line x1="48" y1="100" x2="300" y2="100" stroke="#52635d"/><text x="2" y="'+(y(hi)-6)+'">'+hi.toLocaleString('ja-JP')+'</text>'+(hi===lo?'':'<text x="2" y="'+(y(lo)+12)+'">'+lo.toLocaleString('ja-JP')+'</text>')+'<polyline points="'+points+'" fill="none" stroke="#b5ef8a" stroke-width="3"/>'+values.map((v,i)=>'<circle cx="'+x(i)+'" cy="'+y(v)+'" r="3" fill="#ffd08a"><title>'+(i?date(i):'開始時')+'：'+yen(v)+'</title></circle>').join('')+'<text x="48" y="124">開始</text><text x="245" y="124">'+(values.length-1)+'か月</text></svg>';
  }
  function renderProgress() {
    $('progress').innerHTML='<div class="box"><div class="eyebrow">CAREER QUESTS</div><h2>職業Lv</h2>'+Object.entries(E.CAREERS).map(([id,c])=>{
      const p=E.careerProgress(s,id),format=n=>n.toLocaleString('ja-JP')+c.unit;
      return '<article class="career-quest"><div class="row"><strong>'+c.icon+' '+c.name+'</strong><span class="level-badge">Lv.'+p.level+'</span></div>'+(p.target===null?'<p class="up">MASTER / すべての成長条件を達成！</p><small>'+c.activity+' '+format(p.current)+'</small>':'<p>次の職業Lv：Lv.'+(p.level+1)+'</p><small>条件：'+c.activity+' '+format(p.target)+'</small><progress max="'+p.target+'" value="'+Math.min(p.current,p.target)+'" aria-label="'+c.name+'の成長条件の達成度"></progress><p class="quest-count">現在 '+format(p.current)+' / '+format(p.target)+'</p><small class="up">あと'+(id==='wealthy'?format(p.remaining)+'の配当を受け取ろう':c.activity+'を'+format(p.remaining))+'</small>')+'</article>';
    }).join('')+'</div>';
  }
  function renderChart() {
    const max = Math.max(...s.history.map(h => h.assets), data.config.initialCash) * 1.1;
    const points = s.history.map(h => (20 + h.month / 24 * 300) + ',' + (130 - h.assets / max * 110)).join(' ');
    $('chart').innerHTML = '<svg class="chart" viewBox="0 0 340 160" role="img" aria-label="月末総資産の推移"><line x1="20" y1="130" x2="320" y2="130" stroke="#52635d"/><polyline points="' + points + '" fill="none" stroke="#b5ef8a" stroke-width="3"/><text x="20" y="152">開始</text><text x="150" y="152">1年</text><text x="300" y="152">2年</text></svg><details><summary>月別の総資産</summary>' + s.history.map(h => '<p class="muted">' + (h.month ? date(h.month) : '開始時') + '：' + yen(h.assets) + '</p>').join('') + '</details>';
  }
  function newsHTML(items) { return items.map(n => '<article class="news-item"><small>' + esc(n.kind) + '</small><h3>' + esc(n.title) + '</h3>' + (n.rate === null ? '' : '<strong class="' + (n.rate >= 0 ? 'up' : 'down') + '">' + signed(n.rate) + '</strong>') + '<p>' + esc(n.text) + '</p><small>' + n.indices.map(i => esc(data.companies[i].name)).join(' / ') + '</small></article>').join(''); }
  function settleWithScene() {
    const before = structuredClone(s), total = E.assets(before);
    if (!perform(() => E.settle(s, data), false)) return;
    const prices = [...before.prices], scenes = [];
    for (const n of s.news) {
      const rows = [], loss = n.rate < 0, surprise = n.kind === '突発ニュース';
      let impact = 0;
      for (const i of n.indices) {
        const old = prices[i]; prices[i] = Math.max(1, Math.round(old * (1 + n.rate / 100)));
        rows.push([data.companies[i].name, yen(old) + ' → ' + yen(prices[i])]);
        impact += (prices[i] - old) * before.qty[i];
      }
      if (n.indices.some(i => before.qty[i] > 0)) rows.push(['あなたの保有株への影響', (impact >= 0 ? '+' : '') + yen(impact)]);
      scenes.push({ label: surprise ? '臨時ニュース' : date(before.month) + '・' + n.kind, mood: loss ? 'loss' : surprise || n.rate === null ? 'gold' : 'news', art: n.rate === null ? 'stars' : 'market', icon: n.rate === null ? '✦' : surprise ? '！' : loss ? '↘' : n.rate ? '↗' : '…', title: n.title, text: n.text, value: n.rate === null ? s.stats.dividends - before.stats.dividends : n.rate === 0 ? '動きなし' : signed(n.rate), rows, word: surprise ? 'BREAKING NEWS' : n.rate === null ? 'DIVIDEND' : loss ? 'MARKET DOWN' : 'MARKET REPORT' });
    }
    const extra = discoveries(before); scenes.push(...extra);
    const after = E.assets(s), clear = s.result === 'clear', failed = s.result === 'failed';
    const final = { label: date(before.month) + '・決算', mood: failed ? 'loss' : clear || s.rewardPending ? 'gold' : 'calm', art: 'city', icon: failed ? '◇' : clear ? '♛' : s.rewardPending ? '✦' : '◎', title: failed ? '目標未達。夢は、次の挑戦へ。' : clear ? '2年間をクリア。あの日の夢に、届いた。' : s.rewardPending ? '期限目標、突破！' : after > total ? '今月の一手が、実を結んだ。' : after < total ? 'こんな月もある。次の一手を考えよう。' : '次のチャンスを、待とう。', text: failed ? 'この挑戦はここまで。経験を、次の作戦に。' : clear ? '得意を育てて歩んだ、あなたの2年間。' : s.rewardPending ? '次の半年へ。新しい力をひとつ選ぼう。' : '市場が眠り、また新しい月が来る。', value: after, from: total, rows: [['今月の資産増減', (after >= total ? '+' : '') + yen(after - total)], ['配当', '+' + yen(s.stats.dividends - before.stats.dividends)]], word: failed ? 'NEXT TIME' : clear ? 'DREAM ACHIEVED' : 'YOUR BALANCE', close: failed || clear ? '記録を振り返る' : s.rewardPending ? '報酬を選ぶ →' : '次の月へ →' };
    scenes.push(final);
    const compact = { ...final, rows: [...final.rows, ...s.news.filter(n => n.rate !== null).map(n => [n.title, signed(n.rate)]), ...extra.map(v => [v.label, v.title + ' ' + v.text + ' ' + (v.rows||[]).map(r=>r.join('：')).join(' / ')])] };
    theatre.play(scenes, () => { $('summary').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, compact);
  }
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.allocate) {
      if(perform(()=>E.allocateCareer(s,d.allocate,Number(d.delta)),false)) $('career').querySelector('[data-allocate="'+d.allocate+'"][data-delta="'+d.delta+'"]')?.focus();
    }
    if (d.start !== undefined && perform(() => E.start(s, data), false)) theatre.play([{ label: '新しい生活', art: 'city', icon: '✦', title: 'この街で、自分らしい一歩を。', text: '手元には100万円。毎月ふたつの選択と、自由な投資。まずは半年で200万円へ。', word: 'DAY ONE', close: 'はじめの一歩 →' }]);
    if (d.action) actionWithScene(d.action,d.action==='post'?Number($('postTarget').value):undefined);
    if (d.inspect !== undefined) inspectWithScene(Number(d.inspect));
    if (d.reward && perform(() => E.reward(s, d.reward), false)) theatre.play([{ label: '目標突破の贈り物', mood: 'gold', art: 'stars', icon: '✦', title: '次の半年が、楽しみになった。', text: d.reward === 'cash' ? '投資資金 ＋' + yen(300000 * s.goalsPassed.length) : d.reward === 'dividend' ? '配当倍率 ＋0.20' : '毎月の調査pt ＋2', word: 'A NEW CHAPTER' }]);
    for (const mode of ['buy', 'sell', 'max', 'all']) if (d[mode] !== undefined) {
      const i = Number(d[mode]), n = mode === 'max' ? Math.floor(s.cash / (s.prices[i] * 100)) * 100 : mode === 'all' ? s.qty[i] : Number($('qty' + i).value);
      if (perform(() => E.trade(s, data, i, mode === 'buy' || mode === 'max', n))) { $('qty' + i).closest('.stock').classList.add('trade-pop'); theatre.tone(mode === 'buy' || mode === 'max' ? 'news' : 'calm'); }
    }
    if (d.settle !== undefined) {
      settleWithScene();
    }
    if (d.restart !== undefined) $('restart').showModal();
  });
  $('save').onclick = () => { if (save()) toast('保存しました'); };
  $('load').onclick = () => { try { if (load()) { render(); toast('保存した続きから再開しました'); } else toast('新しい挑戦から始めよう'); } catch (error) { toast(error.message); } };
  $('reset').onclick = () => $('restart').showModal();
  $('cancelRestart').onclick = () => $('restart').close();
  $('confirmRestart').onclick = () => { s = E.createGame(data); save(); render(); $('restart').close(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  try { load(); } catch (error) { $('saveWarning').hidden = false; $('saveWarning').textContent = error.message + ' 新しく始めると今回の保存を置き換えます。'; }
  render();
}
