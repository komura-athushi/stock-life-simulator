'use strict';
function initializeGame(data) {
  const E = KabuEngine, $ = id => document.getElementById(id);
  const KEY = 'kabugurashi-plans-v3:' + location.pathname;
  const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = n => Math.round(n).toLocaleString('ja-JP') + '円';
  const date = m => Math.floor((m - 1) / 12) + 1 + '年目 ' + ((m - 1) % 12 + 1) + '月';
  const signed = n => (n > 0 ? '+' : '') + n + '%';
  const tags = ts => ts.map(t => '<span class="tag">' + esc(t) + '</span>').join('');
  const disabled = ok => ok ? '' : ' disabled';
  const theatre = createPresentation();
  const careerFlavour = { employee: '着実に稼ぐ。その一歩が、いつか大きな元手になる。', trader: '誰よりも先に、ニュースの向こう側を読む。', influencer: '出会いと発信が、市場を動かす力になる。', wealthy: 'お金が働き、次のお金を連れてくる。' };
  const storyVoices = {
    reporter: ['「この会社、何かありそうなんです。一緒に追いかけてくれませんか？」', '「やっぱり。現場まで来ないと、分からないことがありますね」', '「記事になりました！ これから、とっておきの話はあなたにも」'],
    mentor: ['「派手なニュースだけが、投資じゃない。少し話をしませんか」', '「毎月届く配当にも、その会社の姿勢が出るものです」', '「もう、立派な研究仲間ですね。これからも長い目で見ていきましょう」'],
    founder: ['「この計画、あなたならどう見ますか？ 率直な意見がほしいんです」', '「紹介してくれた会社と、話が進みました。あと一歩です！」', '「発表会、大成功です。この会社の未来を、一緒に持っていてください」']
  };
  const storyInvitations = {
    reporter: ['「取材先を探しているんです」', '「今度は現場まで、来てもらえませんか？」', '「最後に、原稿を見てもらいたくて」'],
    mentor: ['「研究会に、顔を出してみませんか」', '「気になる企業があるんです。一緒に調べましょう」', '「研究の成果、皆さんに聞いてもらいませんか」'],
    founder: ['「事業計画に、意見をもらえませんか？」', '「力を貸してくれそうな会社、知りませんか？」', '「いよいよ発表会です。来てくれますよね？」']
  };
  let s = E.createGame(data), timer;
  function toast(message) { $('notice').textContent = message; clearTimeout(timer); timer = setTimeout(() => { $('notice').textContent = ''; }, 5500); }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(s)); $('saveWarning').hidden = true; return true; }
    catch { $('saveWarning').hidden = false; $('saveWarning').textContent = '保存できませんでした。この画面では続けられますが、閉じると進行が失われます。ブラウザの保存設定や空き容量を確認してください。'; return false; }
  }
  function load() {
    const raw = localStorage.getItem(KEY);
    if (!raw) { if(localStorage.getItem('kabugurashi-two-years-v2:' + location.pathname)) { $('saveWarning').hidden=false; $('saveWarning').textContent='予定・調査pt版は、新しい挑戦から始まります。以前の記録はブラウザ内に保管されています。'; } return false; }
    if (raw.length > 2000000) throw Error('保存データが大きすぎます。');
    s = E.restore(raw, data); return true;
  }
  function perform(operation, message) {
    try { operation(); save(); render(); if (message !== false) toast(message || s.log[0]?.message || '完了しました'); return true; }
    catch (error) { toast(error.message); return false; }
  }
  function discoveries(before) {
    const scenes=[];
    for(const a of E.ACHIEVEMENTS.filter(a=>s.achievements.includes(a.id)&&!before.achievements.includes(a.id))) scenes.push({label:'新しい力',mood:'gold',art:'stars',icon:'✦',speaker:'積み重ねが、実を結んだ。',title:a.name,text:a.reward,word:'UNLOCKED'});
    if(s.careerLevel>before.careerLevel) scenes.push({label:'職業成長',mood:'gold',art:'stars',icon:E.CAREERS[s.career].icon,title:E.CAREERS[s.career].name+' Lv.'+(s.careerLevel+1),text:s.career==='employee'?'仕事ぶりが認められた。バイトの報酬が上がった！':s.career==='trader'?'情報収集が板についてきた。得られる調査ptが増えた！':s.career==='influencer'?'声が届くようになった。発信の影響が大きくなった！':'配当が次の配当を育てる。受け取る配当が増えた！',word:'LEVEL UP'});
    if(Math.floor(s.knowledge/2)>Math.floor(before.knowledge/2))scenes.push({label:'気づき',art:'study',icon:'◈',title:'情報を集めるコツが、つかめてきた。',text:'情報収集1回で得られる調査ptが増える。',word:'DISCOVERY'});
    if(Math.floor(s.contacts/3)>Math.floor(before.contacts/3))scenes.push({label:'人脈が広がった',art:'social',icon:'◎',title:'「面白い話があったら、連絡します」',text:'翌月から毎月の調査ptが増える。',word:'CONNECTED'});
    return scenes;
  }
  function actionWithScene(action, target) {
    const before = structuredClone(s);
    if (!perform(() => E.act(s, data, action, target), false)) return;
    const variants = {
      work: ['ひと仕事、やり遂げた。', '帰り道。口座に届いた入金を見て、少し足取りが軽くなった。', 'work', '▣'],
      gig: ['思い切って、引き受けてよかった。', '「助かりました。また、お願いしてもいいですか？」', 'work', '✧'],
      study: ['昨日より、少し読める。', ['静かな机で、企業の記事を読み返す。知らない言葉が、少しずつ減っていく。', 'ばらばらだったニュースが、ひとつの流れに見えてきた。', 'ノートを閉じる。次のニュースが、少し楽しみになった。'][before.stats.studies % 3], 'study', '▤'],
      network: ['またひとり、顔なじみが増えた。', ['名刺の裏に、小さなメモ。「また、お話ししましょう」', '何気ない会話が弾んだ。帰る頃には、次に会う約束ができていた。'][before.stats.networks % 2], 'social', '◎'],
      research: ['手がかりが、集まってきた。', '足を運び、話を聞く。集めた情報を、どの予定に使おうか。', 'study', '⌕']
    };
    let v;
    if (action === 'story') {
      const t = E.STORIES.find(t => t.id === target), complete = s.stories[target].step === 3;
      v = { label: t.name, mood: complete ? 'gold' : 'calm', art: 'social', icon: complete ? '✦' : '◎', speaker: target === 'reporter' ? '若手記者・ハル' : target === 'mentor' ? '研究会の先輩・ナギ' : '起業家・ソウ', title: t.steps[before.stories[target].step], text: storyVoices[target][before.stories[target].step], rows: complete ? [['つながりの贈り物', t.reward]] : [['物語', s.stories[target].step + ' / 3']], word: complete ? 'STORY COMPLETE' : 'A NEW CONNECTION' };
    } else {
      const [title, text, art, icon] = variants[action];
      const rows = action === 'study' ? [['知識', before.knowledge + ' → ' + s.knowledge]] : action === 'network' ? [['人脈', before.contacts + ' → ' + s.contacts]] : action === 'research' ? [['調査pt', before.researchPoints + ' → ' + s.researchPoints]] : [['入金', '＋' + yen(s.cash - before.cash)]];
      v = { label: date(before.month) + (before.actions ? '・後半' : '・前半'), title, text, art, icon, rows, word: action.toUpperCase() };
    }
    const extra = discoveries(before), compact = { ...v, rows: [...(v.rows || []), ...extra.map(x => [x.label, x.title + ' ' + x.text])] };
    theatre.play([v, ...extra], () => { if(action==='research') $('information').scrollIntoView({behavior:'smooth',block:'start'}); else if (s.phase === 'trade') $('market').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, compact);
  }
  function inspectWithScene(uid) {
    const before=structuredClone(s);
    if(!perform(()=>E.inspect(s,data,uid),false))return;
    const v=E.planView(s,data,s.plans.find(p=>p.uid===uid));
    const rows=v.level===1?[['タグ',v.tags.join(' / ')],...(v.stages>1?[['連続イベント',v.stage+' / '+v.stages+'段階目']]:[])]:v.level===2?[['成功したら',signed(v.rate)],['失敗したら',signed(v.failureRate)]]:[['成功率',v.probability+'%']];
    rows.push(['調査pt',before.researchPoints+' → '+s.researchPoints]);
    const scene={label:['','タグが判明','値動きが判明','成功率が判明'][v.level],art:'study',icon:'⌕',title:v.title,text:['','噂の向かう先が、見えてきた。','期待の大きさと、その裏側が見えてきた。','集めた話が、ひとつの見通しになった。'][v.level],rows,word:'RESEARCH FILE'};
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
      $('career').innerHTML = '<div class="hero"><div class="eyebrow">24 MONTHS / 48 CHOICES</div><h1>その選択が、<br>未来の資産になる。</h1><p>学ぶ。つながる。先回りする。<br>100万円から始める、2年間の投資家生活。</p><div class="pills"><span>毎月2回の行動</span><span>売買は月末</span><span>半年ごとの目標</span></div></div><h2>目指す職業を選ぼう</h2><p class="muted">なりたい自分から、はじめよう。</p><div class="career-grid">' + Object.entries(E.CAREERS).map(([id, c]) => '<article class="event career-card"><span class="action-icon">' + c.icon + '</span><h3>' + c.name + '</h3><p>' + careerFlavour[id] + '</p><button class="primary" data-career="' + id + '">' + c.name + 'を目指す →</button></article>').join('') + '</div><div class="banner"><strong>挑戦のゴール</strong><p>最初の約束は、半年で200万円。期限の月末に届かなければ、挑戦はそこで終わる。</p></div>';
      return;
    }
    const total = E.assets(s), c = E.CAREERS[s.career];
    const phase = ended ? '挑戦終了' : s.rewardPending ? '目標報酬を選ぼう' : s.phase === 'trade' ? '月末・売買の時間' : s.actions === 0 ? '前半・行動を選ぼう' : '後半・行動を選ぼう';
    $('summary').innerHTML = '<div class="month-title row"><div><div class="eyebrow">YOUR INVESTOR LIFE</div><h1>' + date(s.month) + '</h1><p class="muted">' + phase + ' / ' + c.name + 'を目指して Lv.' + (s.careerLevel + 1) + '</p></div><div class="turn-steps"><span class="' + (s.actions >= 1 ? 'complete' : 'current') + '">① 前半</span><span class="' + (s.actions >= 2 ? 'complete' : s.actions === 1 ? 'current' : '') + '">② 後半</span><span class="' + (s.phase === 'trade' ? 'current' : '') + '">③ 月末売買</span></div></div><div class="stats"><div class="box stat"><small>総資産</small><strong>' + yen(total) + '</strong></div><div class="box stat"><small>使える現金</small><strong>' + yen(s.cash) + '</strong></div><div class="box stat"><small>累計配当</small><strong class="up">' + yen(s.stats.dividends) + '</strong></div><div class="box stat"><small>使った行動</small><strong>' + s.stats.actions + '<small> / 48回</small></strong></div></div>';
    $('outcome').innerHTML = ended ? '<div class="finish ' + (s.result === 'failed' ? 'failure' : '') + '"><div class="eyebrow">' + (s.result === 'clear' ? 'DREAM ACHIEVED' : 'TRY ANOTHER PATH') + '</div><h2>' + (s.result === 'clear' ? '2年間をクリア！ ' + c.name + 'への第一歩。' : '期限の目標に届きませんでした。') + '</h2><p>最終資産 ' + yen(total) + ' ／ 達成した実績 ' + s.achievements.length + '件 ／ 行動 ' + s.stats.actions + '回</p><p>' + (s.result === 'clear' ? '育てた能力と積み重ねた投資が、実を結びました。' : 'バイトで元手を補う、早く人脈を育てる、配当を再投資する。履歴を振り返り、次の作戦へ。') + '</p><button data-restart class="primary">新しい挑戦へ</button></div>' : '';
    $('goals').innerHTML = '<div class="goal-grid">' + data.config.goals.map(g => {
      const passed = s.goalsPassed.includes(g.month), current = !passed && g.month >= s.month;
      return '<article class="goal ' + (passed ? 'passed' : current && !data.config.goals.some(x => x.month >= s.month && x.month < g.month) ? 'selected' : '') + '"><small>' + date(g.month) + '末 ' + (passed ? '✓ 達成' : '') + '</small><strong>' + yen(g.amount) + '</strong><span>' + esc(g.title) + '</span><progress max="' + g.amount + '" value="' + (passed ? g.amount : Math.min(total, g.amount)) + '" aria-label="' + esc(g.title) + 'の達成度"></progress>' + (current && !ended ? '<small>期限まで' + (g.month - s.month + 1) + 'か月 / あと' + yen(Math.max(0, g.amount - total)) + '</small>' : '') + '</article>';
    }).join('') + '</div>';
    $('reward').hidden = !s.rewardPending;
    $('reward').innerHTML = '<h2>目標突破！ 次の半年の力を選ぼう</h2><p>次の半年に向けて、ひとつ選ぼう。</p><div class="cards"><button data-reward="cash">投資資金<br>＋' + yen(300000 * s.goalsPassed.length) + '</button><button data-reward="dividend">複利を育てる<br>配当倍率＋0.20</button><button data-reward="network">情報網を広げる<br>毎月の調査pt＋2</button></div>';
    renderActions(); renderInformation(); renderStories(); renderMarket(); renderProgress(); renderChart();
    const chapter = data.config.goals.find(g => g.month >= s.month) || data.config.goals.at(-1);
    const roadmap = $('goals').innerHTML;
    $('goals').innerHTML = '<div class="chapter-goal"><div><small>' + date(chapter.month) + '末までに</small><strong>' + yen(chapter.amount) + '</strong></div><div><span>' + esc(chapter.title) + '</span><p>' + (ended ? '今回の挑戦の記録' : chapter.month === s.month ? '今月が期限。月末の総資産で判定。' : 'あと' + (chapter.month - s.month + 1) + 'か月 / 月末に未達なら終了') + '</p></div></div><details class="roadmap"><summary>2年間の目標を見る</summary>' + roadmap + '</details>';
    $('endTurn').innerHTML = '<div class="row"><div><h2>' + (ended ? '今回の挑戦は終了しました' : s.phase === 'trade' ? '売買が済んだら、今月の答え合わせ。' : '今月はあと' + (2 - s.actions) + '回行動できます') + '</h2><p class="muted">' + (ended ? '結果と履歴を振り返れます。' : '配当見込み ' + yen(E.dividend(s)) + '（値動きで変わります）') + '</p></div><button class="primary" data-settle' + disabled(s.phase === 'trade') + '>月を締める →</button></div>';
    $('news').innerHTML = s.news.length ? newsHTML(s.news) : '<p class="muted">月を締めると、ここに結果が届きます。</p>';
    $('log').innerHTML = s.log.map(l => '<li><small>' + date(l.month) + '</small><br>' + esc(l.message) + '</li>').join('');
  }
  function renderActions() {
    $('actions').innerHTML = heading('01 / CHOOSE YOUR ACTION', '今月を、何に使う？', s.phase === 'trade' ? '2回の行動が完了しました。月末の売買へ進みましょう。' : '残り' + (2 - s.actions) + '行動。今日は、何をしよう。') + '<div class="cards">' +
      actionCard('▣', 'バイト', '働いた分を、次の一手に。', '＋' + yen(E.workPay(s)), 'work') +
      actionCard('⌕', '情報収集', '調査に使う手がかりを集める。', '調査pt ＋' + E.researchGain(s), 'research') +
      actionCard('▤', '勉強', '情報収集の力を磨く。', s.knowledge >= 6 ? '知識は最大です' : '知識を磨く', 'study', s.knowledge < 6) +
      actionCard('◎', '交流', '何気ない会話が、いつか情報になる。', s.contacts >= 9 ? '人脈は最大です' : '人脈を広げる', 'network', s.contacts < 9) +
      (s.gig ? actionCard('✧', '今月だけの特別案件', '「少し急ぎの仕事、頼めますか？」', '＋' + yen(E.workPay(s, true)), 'gig') : '') + '</div><a class="text-link" href="#information">調査ptを使う ↓</a>';
  }
  function renderInformation() {
    const active=['action','trade'].includes(s.phase)&&!s.rewardPending;
    $('information').innerHTML=heading('RESEARCH FILES','未来の予定を、読み解く。','タグ → 値動き → 成功率')+'<div class="research-wallet"><div><small>調査pt</small><strong id="researchPoints">'+s.researchPoints+'<span> pt</span></strong></div><p>情報収集で貯めて、気になる予定に使おう。</p><a href="#actions">情報収集へ ↑</a></div><div class="information-grid">'+s.plans.map(plan=>{
      const v=E.planView(s,data,plan),known=v.level>=1;
      const next=['タグを調べる','値動きを調べる','成功率を調べる'][v.level];
      return '<article class="event plan '+(known?'known':'sealed')+'" data-plan="'+v.uid+'" data-level="'+v.level+'"><div class="plan-clock">◷ あと'+v.remaining+'か月'+(v.remaining===1?' <small>今月末</small>':'')+'</div>'+(known?'<div>'+tags(v.tags)+'</div><h3>'+esc(v.title)+'</h3>'+(v.stages>1?'<small class="chain-stage">'+v.stage+' / '+v.stages+'段階目</small>':''):'<h3 class="muted">未調査の予定</h3>')+(v.level>=2?'<div class="plan-rates"><span class="up">成功 '+signed(v.rate)+'</span><span class="down">失敗 '+signed(v.failureRate)+'</span></div>':'')+(v.level>=3?'<div class="success-chance">成功率 <strong>'+v.probability+'%</strong></div>':'')+(known?'<div class="investigation-steps" aria-label="情報 '+v.level+' / 3">'+['タグ','値動き','成功率'].map((t,i)=>'<span class="'+(i<v.level?'opened':'')+'">'+t+'</span>').join('')+'</div>':'')+(v.level<3?'<button data-inspect="'+v.uid+'"'+disabled(active&&s.researchPoints>=v.cost)+'>'+next+' <strong>'+v.cost+'pt</strong></button>'+(active&&s.researchPoints<v.cost?'<small>あと'+(v.cost-s.researchPoints)+'pt</small>':''):'<small class="up">✓ 調査完了</small>')+(s.career==='influencer'&&known?'<button class="small" data-boost="'+v.uid+'"'+disabled(s.phase==='trade'&&s.boosted===null&&v.boost===0)+'>'+(v.boost?'発信済み ＋'+v.boost+'ポイント':'発信で応援')+'</button>':'')+'</article>';
    }).join('')+'</div>';
  }
  function renderStories() {
    const met = E.STORIES.filter(t => s.month >= t.start && (s.month <= t.end || s.stories[t.id].step > 0));
    $('stories').innerHTML = heading('ENCOUNTERS', '気になる、あの人。', '') + '<div class="encounters">' + met.map(t => {
      const v = s.stories[t.id], open = s.month <= t.end && v.step < 3;
      const person = t.id === 'reporter' ? 'ハル / 若手記者' : t.id === 'mentor' ? 'ナギ / 研究会の先輩' : 'ソウ / 起業家';
      return '<article class="event encounter"><div class="person-badge" aria-hidden="true">' + (t.id === 'reporter' ? 'H' : t.id === 'mentor' ? 'N' : 'S') + '</div><div><small>' + person + ' ・ ' + date(t.end) + 'まで</small><h3>' + t.name + '</h3><p class="muted">' + (v.step === 3 ? t.reward : !open ? 'あの約束は、もう過ぎてしまった。' : storyInvitations[t.id][v.step]) + '</p><div class="story-dots" aria-label="' + v.step + ' / 3段階">' + [0,1,2].map(i => '<i class="' + (i < v.step ? 'lit' : '') + '"></i>').join('') + '</div></div><button data-story="' + t.id + '"' + disabled(canAct() && open) + '>' + (v.step === 3 ? '✓ 結ばれた縁' : !open ? '過ぎた約束' : t.steps[v.step] + ' ・1行動') + '</button></article>';
    }).join('') + '</div>';
  }
  function renderMarket() {
    const open = s.phase === 'trade';
    $('market').innerHTML = heading('05 / MONTH-END TRADING', '資金を、どこへ置く？', open ? '月末の市場が開きました。売買は行動消費なし。' : s.phase === 'ended' ? '取引は終了しました。' : '売買は、2回行動した後の月末に。') + '<div class="stock-grid">' + data.companies.map((c, i) => {
      const base = s.history.length > 1 ? s.history[s.history.length - 2].prices[i] : c.price;
      const change = (s.prices[i] / base - 1) * 100, unreal = s.prices[i] * s.qty[i] - s.cost[i];
      return '<article class="stock"><div class="row"><h3>' + esc(c.name) + '</h3><small>' + tags(c.tags) + '</small></div><p class="company-description muted">' + esc(c.desc) + '</p><div class="row"><strong class="price">' + yen(s.prices[i]) + '</strong><span class="' + (change >= 0 ? 'up' : 'down') + '">' + signed(Number(change.toFixed(1))) + '</span></div><dl><dt>100株の購入費用</dt><dd>' + yen(s.prices[i] * 100) + '</dd><dt>保有株数</dt><dd>' + s.qty[i].toLocaleString('ja-JP') + '株</dd><dt>含み損益</dt><dd class="' + (unreal >= 0 ? 'up' : 'down') + '">' + yen(unreal) + '</dd><dt>毎月の配当利回り</dt><dd>' + s.yields[i] + '% × ' + E.dividendMultiplier(s).toFixed(2) + '</dd></dl><div class="trade"><label class="muted">株数 <input id="qty' + i + '" type="number" min="100" step="100" value="100" aria-label="' + esc(c.name) + 'の取引株数"' + disabled(open) + '></label><button data-buy="' + i + '" class="primary"' + disabled(open) + '>買う</button><button data-sell="' + i + '"' + disabled(open && s.qty[i] > 0) + '>売る</button><button class="small" data-max="' + i + '"' + disabled(open && s.cash >= s.prices[i] * 100) + '>最大購入</button><button class="small" data-all="' + i + '"' + disabled(open && s.qty[i] > 0) + '>全売却</button></div><details class="stock-history"><summary>株価の履歴</summary>' + s.history.map(h => '<small>' + (h.month ? date(h.month) : '開始時') + '：' + yen(h.prices[i]) + '</small><br>').join('') + '</details></article>';
    }).join('') + '</div>';
  }
  function renderProgress() {
    const hints = { student: '学びを、積み重ねる。', researcher: '噂を、自分で確かめる。', connector: '人に会い、話を聞く。', dividend: '配当が、積み重なる頃に。', profit: '利益を、手元に残す。', story: '誰かとの約束を、最後まで。' };
    const earned = E.ACHIEVEMENTS.filter(a => s.achievements.includes(a.id));
    $('progress').innerHTML = '<div class="box"><div class="eyebrow">MY JOURNEY</div><h2>' + E.CAREERS[s.career].name + ' Lv.' + (s.careerLevel + 1) + '</h2><div class="skill-grid"><div><strong>' + s.knowledge + '</strong><small>知識</small></div><div><strong>' + s.contacts + '</strong><small>人脈</small></div><div><strong>' + E.researchGain(s) + 'pt</strong><small>情報収集</small></div><div><strong>×' + E.dividendMultiplier(s).toFixed(2) + '</strong><small>配当倍率</small></div></div>' + '<small>人脈から毎月 ＋' + E.monthlyResearch(s) + 'pt</small>' + '</div><div class="box section"><h2>見つけた強み <small>' + earned.length + ' / ' + E.ACHIEVEMENTS.length + '</small></h2>' + (earned.length ? earned.map(a => '<div class="achievement"><strong class="up">✦ ' + a.name + '</strong><p>' + a.reward + '</p></div>').join('') : '<p class="muted">続けたことが、いつか力になる。</p>') + '<details class="discovery-hints"><summary>成長の手がかり</summary>' + E.ACHIEVEMENTS.filter(a => !s.achievements.includes(a.id)).map(a => '<p class="muted">◇ ' + hints[a.id] + '</p>').join('') + '</details></div>';
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
    const final = { label: date(before.month) + '・決算', mood: failed ? 'loss' : clear || s.rewardPending ? 'gold' : 'calm', art: 'city', icon: failed ? '◇' : clear ? '♛' : s.rewardPending ? '✦' : '◎', title: failed ? '目標未達。夢は、次の挑戦へ。' : clear ? '2年間をクリア。あの日の夢に、届いた。' : s.rewardPending ? '期限目標、突破！' : after > total ? '今月の一手が、実を結んだ。' : after < total ? 'こんな月もある。次の一手を考えよう。' : '次のチャンスを、待とう。', text: failed ? 'この挑戦はここまで。経験を、次の作戦に。' : clear ? E.CAREERS[s.career].name + 'を目指した、あなたの2年間。' : s.rewardPending ? '次の半年へ。新しい力をひとつ選ぼう。' : '市場が眠り、また新しい月が来る。', value: after, from: total, rows: [['今月の資産増減', (after >= total ? '+' : '') + yen(after - total)], ['配当', '+' + yen(s.stats.dividends - before.stats.dividends)]], word: failed ? 'NEXT TIME' : clear ? 'DREAM ACHIEVED' : 'YOUR BALANCE', close: failed || clear ? '記録を振り返る' : s.rewardPending ? '報酬を選ぶ →' : '次の月へ →' };
    scenes.push(final);
    const compact = { ...final, rows: [...final.rows, ...s.news.filter(n => n.rate !== null).map(n => [n.title, signed(n.rate)]), ...extra.map(v => [v.label, v.title + ' ' + v.text])] };
    theatre.play(scenes, () => { $('summary').scrollIntoView({ behavior: 'smooth', block: 'start' }); }, compact);
  }
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.career && perform(() => E.start(s, data, d.career), false)) theatre.play([{ label: '新しい生活', art: 'city', icon: E.CAREERS[s.career].icon, title: 'この街で、' + E.CAREERS[s.career].name + 'を目指す。', text: '手元には100万円。毎月ふたつの選択と、月末の投資。まずは半年で200万円へ。', word: 'DAY ONE', close: 'はじめの一歩 →' }]);
    if (d.action) actionWithScene(d.action);
    if (d.inspect !== undefined) inspectWithScene(Number(d.inspect));
    if (d.story) actionWithScene('story', d.story);
    if (d.boost !== undefined && perform(() => E.boost(s, data, Number(d.boost)), false)) theatre.play([{ label: '発信', art: 'social', icon: '◉', title: 'あなたの声が、広がっていく。', text: E.planView(s,data,s.plans.find(p=>p.uid===Number(d.boost))).title, value: '実現確率 ＋' + (10 + s.careerLevel * 5) + 'ポイント', word: 'ON AIR' }]);
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
