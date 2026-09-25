(() => {
  const STORAGE_KEY = 'autoScrollSettings';
  const DEFAULT_SETTINGS = {
    speed: 400, // ms for one swipe to travel from point 1 to point 2
    interval: 300, // ms pause between swipes
    panelPos: { top: 24, left: 24 },
    collapsed: false,
    points: {
      p1: { x: 50, y: 75 }, // percent of viewport — swipe start ("finger down")
      p2: { x: 50, y: 25 }, // percent of viewport — swipe end ("finger up")
    },
  };

  const state = {
    running: false,
    rafId: null,
    cycleTimeoutId: null,
    scrollTarget: null,
  };

  let settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));

  const CSS = `
    :host { all: initial; }
    .overlay { position: fixed; inset: 0; pointer-events: none; z-index: 2147483646; }
    .overlay svg { position: absolute; inset: 0; width: 100%; height: 100%; }
    .marker {
      position: fixed;
      width: 34px;
      height: 34px;
      margin-left: -17px;
      margin-top: -17px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-weight: 700;
      font-size: 13px;
      color: #fff;
      cursor: grab;
      pointer-events: auto;
      z-index: 2147483647;
      box-shadow: 0 3px 10px rgba(0,0,0,0.4);
      border: 2px solid rgba(255,255,255,0.85);
      touch-action: none;
    }
    .marker:active { cursor: grabbing; }
    .marker.p1 { background: #34c759; }
    .marker.p2 { background: #4a7dff; }
    .marker.running { opacity: 0.55; pointer-events: none; }
    .swipe-dot {
      position: fixed;
      width: 16px;
      height: 16px;
      margin-left: -8px;
      margin-top: -8px;
      border-radius: 50%;
      background: #ffd23f;
      box-shadow: 0 0 8px rgba(255,210,63,0.9);
      pointer-events: none;
      z-index: 2147483647;
      opacity: 0;
    }
    .panel {
      position: fixed;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      background: #1f2430;
      color: #eef1f6;
      border-radius: 10px;
      box-shadow: 0 6px 20px rgba(0,0,0,0.35);
      width: 220px;
      overflow: hidden;
      user-select: none;
      pointer-events: auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 10px;
      background: #141824;
      cursor: grab;
    }
    .header:active { cursor: grabbing; }
    .title { font-weight: 600; letter-spacing: 0.2px; }
    .iconbtn {
      background: transparent;
      border: none;
      color: #aab2c5;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .iconbtn:hover { background: rgba(255,255,255,0.08); color: #fff; }
    .body { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
    .body.collapsed { display: none; }
    .hint { font-size: 11px; color: #aab2c5; line-height: 1.4; }
    .row { display: flex; gap: 6px; }
    .row > * { flex: 1; }
    .field { display: flex; flex-direction: column; gap: 2px; }
    .field label { font-size: 11px; color: #aab2c5; }
    .field input {
      background: #141824;
      border: 1px solid #3a4258;
      color: #eef1f6;
      border-radius: 6px;
      padding: 5px 6px;
      font-size: 12px;
      width: 100%;
      box-sizing: border-box;
    }
    button.action {
      background: #2b3245;
      border: 1px solid #3a4258;
      color: #eef1f6;
      border-radius: 6px;
      padding: 6px 8px;
      cursor: pointer;
      font-size: 12px;
    }
    button.action:hover { background: #363f57; }
    button.primary {
      background: #4a7dff;
      border: 1px solid #4a7dff;
      color: #fff;
      font-weight: 600;
    }
    button.primary:hover { background: #3a6bf0; }
    button.primary.stop { background: #ff5a5a; border-color: #ff5a5a; }
    button.primary.stop:hover { background: #f04a4a; }
  `;

  const host = document.createElement('div');
  host.id = 'auto-scroll-ext-host';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${CSS}</style>
    <div class="overlay">
      <svg>
        <defs>
          <marker id="arrowHalo" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
            <path d="M0,0 L10,5 L0,10 Z" fill="#000000aa" />
          </marker>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#ffd23f" />
          </marker>
        </defs>
        <line id="pathLineHalo" x1="0" y1="0" x2="0" y2="0" stroke="#000000aa" stroke-width="5" stroke-dasharray="6 4" marker-end="url(#arrowHalo)" />
        <line id="pathLine" x1="0" y1="0" x2="0" y2="0" stroke="#ffd23f" stroke-width="2.5" stroke-dasharray="6 4" marker-end="url(#arrow)" />
      </svg>
    </div>
    <div class="marker p1" id="marker1">1</div>
    <div class="marker p2" id="marker2">2</div>
    <div class="swipe-dot" id="swipeDot"></div>
    <div class="panel" id="panel">
      <div class="header" id="header">
        <span class="title">Auto Scroll</span>
        <button class="iconbtn" id="collapseBtn" title="Collapse">&#8211;</button>
      </div>
      <div class="body" id="body">
        <div class="hint">Drag dots 1 &rarr; 2 to set the swipe path, like a mobile auto-scroller.</div>
        <div class="row">
          <div class="field">
            <label>Speed (ms/swipe)</label>
            <input type="number" id="speedInput" min="20" step="10" />
          </div>
          <div class="field">
            <label>Interval (ms)</label>
            <input type="number" id="intervalInput" min="0" step="10" />
          </div>
        </div>
        <button class="action primary" id="toggleBtn">Start</button>
      </div>
    </div>
  `;

  const el = {
    svg: shadow.querySelector('svg'),
    pathLine: shadow.getElementById('pathLine'),
    pathLineHalo: shadow.getElementById('pathLineHalo'),
    marker1: shadow.getElementById('marker1'),
    marker2: shadow.getElementById('marker2'),
    swipeDot: shadow.getElementById('swipeDot'),
    panel: shadow.getElementById('panel'),
    header: shadow.getElementById('header'),
    collapseBtn: shadow.getElementById('collapseBtn'),
    body: shadow.getElementById('body'),
    speedInput: shadow.getElementById('speedInput'),
    intervalInput: shadow.getElementById('intervalInput'),
    toggleBtn: shadow.getElementById('toggleBtn'),
  };

  function pctToPx(pt) {
    return { x: (pt.x / 100) * window.innerWidth, y: (pt.y / 100) * window.innerHeight };
  }

  function pxToPct(x, y) {
    return {
      x: Math.min(100, Math.max(0, (x / window.innerWidth) * 100)),
      y: Math.min(100, Math.max(0, (y / window.innerHeight) * 100)),
    };
  }

  function renderMarkers() {
    const p1 = pctToPx(settings.points.p1);
    const p2 = pctToPx(settings.points.p2);
    el.marker1.style.left = `${p1.x}px`;
    el.marker1.style.top = `${p1.y}px`;
    el.marker2.style.left = `${p2.x}px`;
    el.marker2.style.top = `${p2.y}px`;
    for (const line of [el.pathLine, el.pathLineHalo]) {
      line.setAttribute('x1', p1.x);
      line.setAttribute('y1', p1.y);
      line.setAttribute('x2', p2.x);
      line.setAttribute('y2', p2.y);
    }
  }

  function applyPanelPosition() {
    el.panel.style.top = `${settings.panelPos.top}px`;
    el.panel.style.left = `${settings.panelPos.left}px`;
  }

  function applyCollapsed() {
    el.body.classList.toggle('collapsed', settings.collapsed);
    el.collapseBtn.innerHTML = settings.collapsed ? '&#43;' : '&#8211;';
  }

  function saveSettings() {
    chrome.storage.local.set({ [STORAGE_KEY]: settings });
  }

  function isScrollable(elem) {
    if (!elem || elem === document.documentElement) return false;
    const style = getComputedStyle(elem);
    const overflowY = style.overflowY;
    const canOverflow = overflowY === 'auto' || overflowY === 'scroll';
    return canOverflow && elem.scrollHeight > elem.clientHeight + 1;
  }

  function findScrollTarget(x, y) {
    const prevVisibility = host.style.visibility;
    host.style.visibility = 'hidden';
    let node = document.elementFromPoint(x, y);
    host.style.visibility = prevVisibility;

    while (node && node !== document.documentElement) {
      if (isScrollable(node)) return node;
      node = node.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  }

  function setMarkersEnabled(enabled) {
    el.marker1.classList.toggle('running', !enabled);
    el.marker2.classList.toggle('running', !enabled);
  }

  function stopScrolling() {
    if (state.rafId !== null) cancelAnimationFrame(state.rafId);
    if (state.cycleTimeoutId !== null) clearTimeout(state.cycleTimeoutId);
    state.rafId = null;
    state.cycleTimeoutId = null;
    state.running = false;
    el.swipeDot.style.opacity = '0';
    el.toggleBtn.textContent = 'Start';
    el.toggleBtn.classList.remove('stop');
    setMarkersEnabled(true);
  }

  function runSwipeCycle() {
    if (!state.running) return;
    const p1 = pctToPx(settings.points.p1);
    const p2 = pctToPx(settings.points.p2);
    const totalDX = p1.x - p2.x;
    const totalDY = p1.y - p2.y;
    const duration = Math.max(20, settings.speed);
    const startTime = performance.now();
    let lastFrac = 0;

    el.swipeDot.style.opacity = '1';

    function frame(now) {
      if (!state.running) return;
      const elapsed = now - startTime;
      const frac = Math.min(1, elapsed / duration);

      const dotX = p1.x + (p2.x - p1.x) * frac;
      const dotY = p1.y + (p2.y - p1.y) * frac;
      el.swipeDot.style.left = `${dotX}px`;
      el.swipeDot.style.top = `${dotY}px`;

      const deltaX = totalDX * frac - totalDX * lastFrac;
      const deltaY = totalDY * frac - totalDY * lastFrac;
      if (deltaX !== 0 || deltaY !== 0) {
        state.scrollTarget.scrollBy({ left: deltaX, top: deltaY });
      }
      lastFrac = frac;

      if (frac < 1) {
        state.rafId = requestAnimationFrame(frame);
      } else {
        el.swipeDot.style.opacity = '0';
        state.cycleTimeoutId = setTimeout(runSwipeCycle, Math.max(0, settings.interval));
      }
    }
    state.rafId = requestAnimationFrame(frame);
  }

  function startScrolling() {
    if (state.running) return;
    const p1 = pctToPx(settings.points.p1);
    const p2 = pctToPx(settings.points.p2);
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    state.scrollTarget = findScrollTarget(midX, midY);
    state.running = true;
    el.toggleBtn.textContent = 'Stop';
    el.toggleBtn.classList.add('stop');
    setMarkersEnabled(false);
    runSwipeCycle();
  }

  el.toggleBtn.addEventListener('click', () => {
    if (state.running) stopScrolling();
    else startScrolling();
  });

  el.speedInput.addEventListener('change', () => {
    const val = parseInt(el.speedInput.value, 10);
    settings.speed = Number.isFinite(val) && val > 0 ? val : DEFAULT_SETTINGS.speed;
    el.speedInput.value = settings.speed;
    saveSettings();
  });

  el.intervalInput.addEventListener('change', () => {
    const val = parseInt(el.intervalInput.value, 10);
    settings.interval = Number.isFinite(val) && val >= 0 ? val : DEFAULT_SETTINGS.interval;
    el.intervalInput.value = settings.interval;
    saveSettings();
  });

  el.collapseBtn.addEventListener('click', () => {
    settings.collapsed = !settings.collapsed;
    applyCollapsed();
    saveSettings();
  });

  // Panel dragging
  let draggingPanel = false;
  let panelDragOffset = { x: 0, y: 0 };

  el.header.addEventListener('pointerdown', (e) => {
    draggingPanel = true;
    const rect = el.panel.getBoundingClientRect();
    panelDragOffset.x = e.clientX - rect.left;
    panelDragOffset.y = e.clientY - rect.top;
  });

  // Marker dragging
  let draggingMarker = null; // 'p1' | 'p2' | null

  function markerPointerDown(key) {
    return (e) => {
      if (state.running) return;
      draggingMarker = key;
      e.preventDefault();
    };
  }

  el.marker1.addEventListener('pointerdown', markerPointerDown('p1'));
  el.marker2.addEventListener('pointerdown', markerPointerDown('p2'));

  document.addEventListener('pointermove', (e) => {
    if (draggingPanel) {
      const left = Math.min(
        Math.max(0, e.clientX - panelDragOffset.x),
        window.innerWidth - el.panel.offsetWidth
      );
      const top = Math.min(
        Math.max(0, e.clientY - panelDragOffset.y),
        window.innerHeight - el.panel.offsetHeight
      );
      settings.panelPos = { top, left };
      applyPanelPosition();
    } else if (draggingMarker) {
      const pct = pxToPct(e.clientX, e.clientY);
      settings.points[draggingMarker] = pct;
      renderMarkers();
    }
  });

  document.addEventListener('pointerup', () => {
    if (draggingPanel) {
      draggingPanel = false;
      saveSettings();
    }
    if (draggingMarker) {
      draggingMarker = null;
      saveSettings();
    }
  });

  window.addEventListener('resize', renderMarkers);

  chrome.runtime.onMessage.addListener((message) => {
    if (message && message.type === 'toggle-widget') {
      host.style.display = host.style.display === 'none' ? 'block' : 'none';
    }
  });

  function init() {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const stored = result[STORAGE_KEY] || {};
      settings = {
        ...DEFAULT_SETTINGS,
        ...stored,
        points: {
          p1: (stored.points && stored.points.p1) || DEFAULT_SETTINGS.points.p1,
          p2: (stored.points && stored.points.p2) || DEFAULT_SETTINGS.points.p2,
        },
      };
      el.speedInput.value = settings.speed;
      el.intervalInput.value = settings.interval;
      applyPanelPosition();
      applyCollapsed();
      renderMarkers();
      document.documentElement.appendChild(host);

      new MutationObserver(() => {
        if (!document.documentElement.contains(host)) {
          document.documentElement.appendChild(host);
        }
      }).observe(document.documentElement, { childList: true });
    });
  }

  init();
})();
