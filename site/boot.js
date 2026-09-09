'use strict';
async function boot() {
  const message = document.getElementById('bootMessage');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    if (location.protocol === 'file:') throw Error('公開URLまたはローカルサーバーから開いてください。');
    const entries = await Promise.all(['companies', 'events', 'config'].map(async name => {
      const response = await fetch(new URL('./data/' + name + '.json', location.href), { signal: controller.signal, cache: 'no-cache', credentials: 'omit' });
      if (!response.ok) throw Error(name + '.json を取得できません（HTTP ' + response.status + '）。');
      return [name, await response.json()];
    }));
    initializeGame(KabuEngine.validateData(Object.fromEntries(entries)));
    document.getElementById('main').hidden = false;
    document.getElementById('boot').hidden = true;
  } catch (error) {
    controller.abort();
    message.textContent = 'ゲームを開始できませんでした。' + (error.name === 'AbortError' ? '通信がタイムアウトしました。' : error.message);
    const retry = document.getElementById('retry'); retry.hidden = false; retry.onclick = () => location.reload();
  } finally { clearTimeout(timer); }
}
boot();
