'use strict';
// Presentation never changes game state or draws from the game's random stream.
function createPresentation() {
  const $ = id => document.getElementById(id);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const yen = n => Math.round(n).toLocaleString('ja-JP') + '円';
  let scenes = [], index = 0, onFinish, frame = 0, context, sound = false, short = false, returnFocus;
  try { const p = JSON.parse(localStorage.getItem('kabu-presentation') || '{}'); sound = p.sound === true; short = p.short === true; } catch {}
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  function preferences() {
    $('sound').textContent = '音 ' + (sound ? 'ON' : 'OFF'); $('sound').setAttribute('aria-pressed', String(sound));
    $('pace').textContent = '演出 ' + (short ? '短め' : '通常'); $('pace').setAttribute('aria-pressed', String(short));
    try { localStorage.setItem('kabu-presentation', JSON.stringify({ sound, short })); } catch {}
  }
  function tone(kind = 'calm') {
    if (!sound) return;
    try {
      context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (context.state === 'suspended') context.resume().catch(() => {});
      const notes = kind === 'loss' ? [293, 246, 196] : kind === 'gold' ? [392, 494, 587, 784] : kind === 'news' ? [330, 440] : [440, 554, 659];
      notes.forEach((frequency, i) => {
        const o = context.createOscillator(), gain = context.createGain(), t = context.currentTime + i * 0.075;
        o.type = 'sine'; o.frequency.value = frequency;
        gain.gain.setValueAtTime(0, t); gain.gain.linearRampToValueAtTime(0.035, t + 0.015); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
        o.connect(gain); gain.connect(context.destination); o.start(t); o.stop(t + 0.25);
      });
    } catch {}
  }
  function draw() {
    cancelAnimationFrame(frame);
    const v = scenes[index], last = index === scenes.length - 1;
    $('report').className = 'cinema ' + (v.mood || 'calm');
    $('reportTitle').textContent = v.label;
    $('sceneCount').textContent = (index + 1) + ' / ' + scenes.length;
    $('sceneMeter').style.width = (index + 1) / scenes.length * 100 + '%';
    $('skipScene').hidden = last;
    $('closeReport').textContent = last ? (v.close || 'つづける →') : '次へ →';
    $('reportBody').innerHTML = '<div class="scene-art art-' + escape(v.art || 'city') + '" aria-hidden="true"><div class="scene-orbit"></div><div class="cityline"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="scene-emblem">' + escape(v.icon || '✦') + '</span><span class="scene-watermark">' + escape(v.word || 'KABU LIFE') + '</span></div><div class="scene-copy"><small class="scene-speaker">' + escape(v.speaker || '') + '</small><h3>' + escape(v.title) + '</h3>' + (v.text ? '<p class="scene-dialogue">' + escape(v.text) + '</p>' : '') + (v.value !== undefined ? '<div class="scene-value" aria-label="' + escape(typeof v.value === 'number' ? yen(v.value) : v.value) + '">' + escape(typeof v.value === 'number' ? yen(v.value) : v.value) + '</div>' : '') + (v.rows?.length ? '<div class="scene-rewards">' + v.rows.map(r => '<div><span>' + escape(r[0]) + '</span><strong>' + escape(r[1]) + '</strong></div>').join('') + '</div>' : '') + '</div>';
    if (typeof v.value === 'number' && !reduced()) {
      const el = $('reportBody').querySelector('.scene-value'), start = performance.now();
      const from = v.from === undefined ? 0 : v.from;
      function tick(t) {
        const p = Math.min(1, (t - start) / 700); el.textContent = yen(from + (v.value - from) * (1 - (1 - p) ** 3));
        if (p < 1) frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    }
    $('report').scrollTop = 0; tone(v.mood || 'calm');
  }
  function finish() { $('report').close(); }
  $('closeReport').onclick = () => { if (index < scenes.length - 1) { index++; draw(); } else finish(); };
  $('skipScene').onclick = () => { index = scenes.length - 1; draw(); $('closeReport').focus(); };
  $('report').addEventListener('cancel', event => {
    event.preventDefault();
    if (index < scenes.length - 1) { index = scenes.length - 1; draw(); } else finish();
  });
  $('report').addEventListener('close', () => {
    cancelAnimationFrame(frame);
    const callback = onFinish; onFinish = null; callback?.();
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  });
  $('sound').onclick = () => { sound = !sound; preferences(); if (sound) tone(); };
  $('pace').onclick = () => { short = !short; preferences(); };
  preferences();
  return {
    tone,
    play(items, callback, compactScene) {
      if (!items.length) { callback?.(); return; }
      returnFocus = document.activeElement;
      scenes = short && compactScene ? [compactScene] : items; index = 0; onFinish = callback;
      draw(); $('report').showModal(); $('closeReport').focus();
    }
  };
}
