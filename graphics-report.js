// On-demand diagnostics from the game's real contexts. No test canvas, driver
// selection, flags, quality changes or reporting requests are made here.
(() => {
  'use strict';
  if (new URLSearchParams(window.location.search).get('graphics') !== '1') return;
  const opener = document.createElement('button');
  opener.id = 'graphics-open'; opener.type = 'button'; opener.textContent = 'Graphics'; opener.hidden = true;
  document.body.appendChild(opener);
  const panel = document.createElement('aside');
  panel.id = 'graphics-report'; panel.setAttribute('aria-label', 'Graphics report');
  panel.innerHTML = '<h1>Graphics report</h1>' +
    '<p class="muted">The game requests high performance. Android WebView chooses the driver; this page cannot enable Vulkan.</p>' +
    '<section data-context="lighting"><h2>World lighting</h2><p></p></section>' +
    '<section data-context="characters"><h2>Character models</h2><p></p></section>' +
    '<p class="muted">These WebGL reports do not identify the main 2D canvas compositor.</p>' +
    '<button type="button" data-action="refresh">Refresh</button>' +
    '<button type="button" data-action="copy">Copy report</button>' +
    '<button type="button" data-action="close">Close</button>' +
    '<p><a data-action="chrome" hidden>Open local game in Chrome</a></p>' +
    '<p data-url class="muted"></p>' +
    '<p data-status role="status" class="muted"></p>' +
    '<details><summary>Full report</summary><pre tabindex="0"></pre></details>';
  document.body.appendChild(panel);
  const status = panel.querySelector('[data-status]'), raw = panel.querySelector('pre');
  let report = null, timer = null;
  function contextLabel(owner) {
    if (!owner || !owner.context) return 'Waiting for renderer information.';
    const c = owner.context;
    if (c.state === 'not-created') return 'Not created yet. Start the game, then refresh.';
    if (c.state === 'lost') return 'Context lost. The game can use its fallback renderer.';
    if (c.state !== 'ready') return owner.failure || 'WebGL context unavailable.';
    const acceleration = c.acceleration === 'software' ? 'Software renderer' :
      c.acceleration === 'hardware-reported' ? 'GPU driver reported' : 'Driver details not exposed';
    const backend = c.backend && c.backend !== 'unknown' ? c.backend.toUpperCase() : 'backend unknown';
    const driver = c.unmaskedRenderer || c.renderer || 'Renderer name unavailable';
    const state = owner.ready ? owner.enabled ? 'Active' : 'Available, currently disabled' : 'Context exists; renderer not ready';
    const failure = owner.failure ? `\n${owner.failure}` : '';
    return `${state} · ${acceleration} · ${backend}\n${driver}${failure}`;
  }
  function refresh() {
    if (typeof getGameGraphicsDiagnostics !== 'function') {
      status.textContent = 'Waiting for game.js. Check that p5 and the game script loaded.';
      return;
    }
    report = getGameGraphicsDiagnostics();
    for (const key of ['lighting', 'characters']) {
      const p = panel.querySelector(`[data-context="${key}"] p`);
      p.style.whiteSpace = 'pre-wrap'; p.textContent = contextLabel(report[key]);
    }
    raw.textContent = JSON.stringify(report, null, 2);
    status.textContent = report.environment && report.environment.androidWebViewHint ?
      'The user agent suggests Android WebView. Chrome flags do not configure this preview.' :
      'Renderer names can be hidden by browser privacy settings; unknown does not mean the GPU is off.';
  }
  panel.querySelector('[data-action="refresh"]').addEventListener('click', refresh);
  panel.querySelector('[data-action="copy"]').addEventListener('click', async () => {
    refresh(); if (!report) return;
    const value = JSON.stringify(report, null, 2);
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value); status.textContent = 'Graphics report copied.';
    } catch (_) {
      clearInterval(timer);
      panel.querySelector('details').open = true;
      const selection = window.getSelection(), range = document.createRange();
      range.selectNodeContents(raw); selection.removeAllRanges(); selection.addRange(range);
      status.textContent = 'Select and copy the full report below; this preview does not allow clipboard access.';
    }
  });
  function close() { clearInterval(timer); panel.hidden = true; opener.hidden = false; }
  opener.addEventListener('click', () => {
    opener.hidden = true; panel.hidden = false; refresh(); timer = setInterval(refresh, 1500);
  });
  panel.querySelector('[data-action="close"]').addEventListener('click', close);
  panel.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'touchstart', 'touchend', 'keydown', 'keyup']) {
    panel.addEventListener(type, event => event.stopPropagation());
    opener.addEventListener(type, event => event.stopPropagation());
  }
  // External launch is user initiated and only offered for an HTTP server.
  // Chrome cannot read an editor app's private file:// preview directory.
  const url = new URL(window.location.href), chrome = panel.querySelector('[data-action="chrome"]');
  if (/^https?:$/.test(url.protocol) && /Android/i.test(navigator.userAgent)) {
    url.searchParams.delete('graphics'); url.hash = '';
    chrome.href = `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.slice(0, -1)};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(url.href)};end`;
    chrome.hidden = false;
    panel.querySelector('[data-url]').textContent = `If this preview blocks external launch, open ${url.href} in the Chrome app.`;
  }
  // Refreshing reads cached metadata, never GPU parameters or probe contexts.
  refresh(); timer = setInterval(refresh, 1500);
  window.addEventListener('pagehide', () => clearInterval(timer), {once: true});
})();
