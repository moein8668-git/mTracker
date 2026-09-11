/* Bootstrap: theme pre-applied inline in index.html; here we wire repo + events. */

import './styles.css';

import { Storage, Repo } from './storage';

import { state, parseTabId } from './ui/state';

import { render } from './ui/render';

import { attachEvents } from './ui/events';

import { toast } from './ui/bits';

import { overallMonthAnalysis } from './analysis';

import { monthStartOf } from './jalali';

const repo = new Repo(Storage.load(), msg => toast(msg));

try {
  state.tab = parseTabId(localStorage.getItem('mtracker.tab'));
  state.chartType = localStorage.getItem('mtracker.chart') === 'line' ? 'line' : 'bar';
} catch { /* private mode: stay on today */ }

attachEvents(repo);
render(repo);

/* first-visit welcome */
try {
  if (!repo.tasks.length && !repo.entries.length && !localStorage.getItem('mtracker.welcomed')) {
    localStorage.setItem('mtracker.welcomed', '1');
    const root = document.getElementById('modal-root');
    if (root) {
      root.innerHTML = '<div class="overlay" data-action="overlay-close"><div class="modal" role="dialog" aria-modal="true"><div class="welcome">' +
        '<h3>به mTracker خوش آمدی</h3>' +
        '<p style="font-size:.9rem;color:var(--muted)">این برنامه بر پایه روش «پایداری» کار می‌کند: مهم نیست یک روز چقدر کار کنی، مهم این است که هر روز کمی کار کنی.</p>' +
        '<ol>' +
        '<li>یک تسک بساز و هدف روزانه‌اش را مشخص کن</li>' +
        '<li>هر روز ساعت کارکردت را ثبت کن</li>' +
        '<li>در گزارش ماهانه چک کن: انحراف معیارت باید کمتر از نصف میانگینت باشد</li>' +
        '</ol>' +
        '<div class="modal-actions">' +
        '<button class="btn ghost" data-action="load-sample">دیدن با داده نمونه</button>' +
        '<button class="btn primary" data-action="open-task">شروع با اولین تسک</button>' +
        '</div></div></div></div>';
    }
  }
} catch { /* private mode etc. */ }

/* ==========================================================================
   SOLID-STATE QUANTUM FIELD (HEX-PHONONS & PHOSPHORESCENT INTERFERENCE)
   ========================================================================== */
(function setupQuantumPhononLattice() {
  if (typeof window === 'undefined') return;

  let canvas = document.getElementById('bg-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'bg-canvas';
    document.body.prepend(canvas);
  }

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  let w = window.innerWidth;
  let h = window.innerHeight;

  let isMobile = w <= 640;
  let GRID_STEP = isMobile ? 38 : 26;
  let cols = 0;
  let rows = 0;

  interface PhononNode {
    ox: number;
    oy: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    ax: number;
    ay: number;
    baseR: number;
    mass: number;
    r: number;
    g: number;
    b: number;
    strain: number;
    phosphor: number; // پایداری پس‌درخشش فسفرسانس
    phase: number;
  }

  let nodes: PhononNode[] = [];
  let gridMatrix: (PhononNode | null)[][] = [];

  function hexToRgb(hex: string): [number, number, number] {
    const c = hex.replace('#', '');
    if (c.length === 6) {
      const num = parseInt(c, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
    return [79, 163, 163];
  }

  function getDynamicPalettes(): [number, number, number][] {
    const active = repo.activeTasks();
    if (active.length > 0) {
      return active.map(t => hexToRgb(t.color));
    }
    return [[79, 163, 163], [56, 189, 248], [127, 176, 138]];
  }

  function buildLattice() {
    nodes = [];
    gridMatrix = [];
    isMobile = w <= 640;
    GRID_STEP = isMobile ? 38 : 26;
    cols = Math.floor(w / GRID_STEP) + 2;
    rows = Math.floor(h / GRID_STEP) + 2;
    const startX = (w - (cols - 1) * GRID_STEP) / 2;
    const startY = (h - (rows - 1) * GRID_STEP) / 2;
    const palettes = getDynamicPalettes();

    for (let r = 0; r < rows; r++) {
      gridMatrix[r] = [];
      for (let c = 0; c < cols; c++) {
        const x = startX + c * GRID_STEP;
        const y = startY + r * GRID_STEP;
        const color = palettes[(r + c) % palettes.length]!;

        const node: PhononNode = {
          ox: x,
          oy: y,
          x,
          y,
          vx: 0,
          vy: 0,
          ax: 0,
          ay: 0,
          baseR: 0.95,
          mass: 0.95 + Math.sin(r * 0.35) * Math.cos(c * 0.35) * 0.15,
          r: color[0],
          g: color[1],
          b: color[2],
          strain: 0,
          phosphor: 0,
          phase: Math.random() * Math.PI * 2
        };

        nodes.push(node);
        gridMatrix[r]![c] = node;
      }
    }
  }

  function resize() {
    if (!canvas || !ctx) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    buildLattice();
  }
  resize();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => { resize(); wakeAnimation(); }, 120);
  }, { passive: true });

  const mouse = {
    x: -3000,
    y: -3000,
    targetX: -3000,
    targetY: -3000,
    vx: 0,
    vy: 0,
    prevX: -3000,
    prevY: -3000,
    active: false,
    hoverScalar: 0
  };

  interface QuantumShockwave {
    x: number;
    y: number;
    radius: number;
    energy: number;
    implosionTimer: number;
    interferencePhase: number;
  }

  const shockwaves: QuantumShockwave[] = [];
  let isPageVisible = true;
  let tick = 0;

  document.addEventListener('visibilitychange', () => {
    isPageVisible = !document.hidden;
    if (isPageVisible) wakeAnimation();
  });
  let lastMoveTime = 0;
  let cardUpdateQueued = false;
  window.addEventListener('pointermove', (e) => {
    mouse.targetX = e.clientX;
    mouse.targetY = e.clientY;
    mouse.active = true;

    const now = performance.now();
    if (now - lastMoveTime > 16) { // ~60 fps cap
      lastMoveTime = now;
      wakeAnimation();
    }

    if (e.pointerType !== 'touch' && !cardUpdateQueued) {
      cardUpdateQueued = true;
      requestAnimationFrame(() => {
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const card = target?.closest<HTMLElement>('.card');
        if (card) {
          const rect = card.getBoundingClientRect();
          card.style.setProperty('--card-mx', `${e.clientX - rect.left}px`);
          card.style.setProperty('--card-my', `${e.clientY - rect.top}px`);
        }
        cardUpdateQueued = false;
      });
    }
  }, { passive: true });
  const releasePointer = () => {
    mouse.active = false;
    mouse.targetX = -3000;
    mouse.targetY = -3000;
    wakeAnimation();
  };

  window.addEventListener('pointerleave', () => {
    mouse.active = false;
    wakeAnimation();
  });

  window.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      releasePointer();
    }
  }, { passive: true });

  window.addEventListener('pointercancel', () => {
    releasePointer();
  }, { passive: true });

  window.addEventListener('touchend', () => {
    releasePointer();
  }, { passive: true });

  window.addEventListener('touchcancel', () => {
    releasePointer();
  }, { passive: true });

  // انفجار فوتونی دو مرحله‌ای با ضربه شرودینگر (بهینه‌سازی شده برای لمس موبایل)
  window.addEventListener('pointerdown', (e) => {
    wakeAnimation();
    shockwaves.push({
      x: e.clientX,
      y: e.clientY,
      radius: 3,
      energy: isMobile ? 18 : 26,
      implosionTimer: isMobile ? 3 : 5,
      interferencePhase: Math.random() * Math.PI * 2
    });

    const triggerRadius = isMobile ? 100 : 150;
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]!;
      const dx = e.clientX - node.x;
      const dy = e.clientY - node.y;
      const d = Math.hypot(dx, dy);
      if (d < triggerRadius && d > 1) {
        const implode = Math.pow((triggerRadius - d) / triggerRadius, 2.2) * (isMobile ? 6.5 : 9.2);
        node.vx += (dx / d) * implode;
        node.vy += (dy / d) * implode;
        node.phosphor = Math.min(1, node.phosphor + (1 - d / triggerRadius) * 0.8);
      }
    }
  });

  // ثوابت فیزیک شبکه بس‌ذره‌ای
  const RESTORE_K = 0.056;
  const PHONON_ORTHO = 0.018;
  const PHONON_DIAG = 0.007;
  const DAMPING = 0.865;
  const DISPERSAL_LIMIT = 15;
  const INTERACTION_CUTOFF = 78;
  let isRunning = false;
  let settleFrames = 0;
  let stateRgb: [number, number, number] = [79, 163, 163];

  function refreshStateRgb() {
    try {
      const monthStats = overallMonthAnalysis(repo, monthStartOf(new Date()));
      stateRgb = monthStats.status === 'ok' ? [127, 176, 138] : (monthStats.status === 'volatile' ? [194, 161, 77] : [79, 163, 163]);
    } catch {
      stateRgb = [79, 163, 163];
    }
  }
  refreshStateRgb();
  (function scheduleRefresh() {
    setTimeout(() => { refreshStateRgb(); scheduleRefresh(); }, 30_000);
  })();

  function wakeAnimation() {
    settleFrames = 0;
    if (!isRunning && isPageVisible) {
      isRunning = true;
      requestAnimationFrame(draw);
    }
  }

  function draw() {
    if (!ctx || !isPageVisible) { isRunning = false; return; }
    ctx.clearRect(0, 0, w, h);
    tick += 0.016;

    mouse.vx = mouse.targetX - mouse.prevX;
    mouse.vy = mouse.targetY - mouse.prevY;
    mouse.prevX = mouse.targetX;
    mouse.prevY = mouse.targetY;

    mouse.x += (mouse.targetX - mouse.x) * 0.16;
    mouse.y += (mouse.targetY - mouse.y) * 0.16;
    mouse.hoverScalar += ((mouse.active ? 1 : 0) - mouse.hoverScalar) * 0.06;

    // امواج شوک تداخل کوانتومی
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i]!;
      if (sw.implosionTimer > 0) {
        sw.implosionTimer--;
      } else {
        sw.radius += 6.5;
        sw.energy *= 0.945;
        if (sw.energy < 0.12 || sw.radius > 320) {
          shockwaves.splice(i, 1);
          continue;
        }

        // تداخل موج با فاز سینوسی در جبهه موج
        const waveAlpha = Math.min(0.38, sw.energy * 0.022);
        ctx.beginPath();
        ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(79, 163, 163, ${waveAlpha})`;
        ctx.lineWidth = 1.1;
        ctx.stroke();
      }
    }

    let totalKinetic = 0;
    const activeNodes: PhononNode[] = [];

    // ۱. دینامیک شبکه فونونی و محاسبات تنش تانسوری
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const node = gridMatrix[r]![c]!;

        // نیروی بازگرداننده پایه‌ای
        const dxO = node.ox - node.x;
        const dyO = node.oy - node.y;
        node.ax = (dxO * RESTORE_K) / node.mass;
        node.ay = (dyO * RESTORE_K) / node.mass;

        // جفت‌شدگی ارتوگونال با همسایه‌ها
        if (c > 0) {
          const left = gridMatrix[r]![c - 1]!;
          node.ax += ((left.x - left.ox) - (node.x - node.ox)) * PHONON_ORTHO;
        }
        if (c < cols - 1) {
          const right = gridMatrix[r]![c + 1]!;
          node.ax += ((right.x - right.ox) - (node.x - node.ox)) * PHONON_ORTHO;
        }
        if (r > 0) {
          const top = gridMatrix[r - 1]![c]!;
          node.ay += ((top.y - top.oy) - (node.y - node.oy)) * PHONON_ORTHO;
        }
        if (r < rows - 1) {
          const bottom = gridMatrix[r + 1]![c]!;
          node.ay += ((bottom.y - bottom.oy) - (node.y - node.oy)) * PHONON_ORTHO;
        }

        // جفت‌شدگی فونونی قطری (پخش تنش آن‌ایزوتروپ)
        if (r > 0 && c > 0) {
          const tl = gridMatrix[r - 1]![c - 1]!;
          node.ax += ((tl.x - tl.ox) - (node.x - node.ox)) * PHONON_DIAG;
          node.ay += ((tl.y - tl.oy) - (node.y - node.oy)) * PHONON_DIAG;
        }
        if (r < rows - 1 && c < cols - 1) {
          const br = gridMatrix[r + 1]![c + 1]!;
          node.ax += ((br.x - br.ox) - (node.x - node.ox)) * PHONON_DIAG;
          node.ay += ((br.y - br.oy) - (node.y - node.oy)) * PHONON_DIAG;
        }

        // دافعه بوهمی و کشش اسپینی نرم ماوس
        if (mouse.hoverScalar > 0.01) {
          const dxM = node.x - mouse.x;
          const dyM = node.y - mouse.y;
          const distM = Math.hypot(dxM, dyM);

          if (distM < INTERACTION_CUTOFF && distM > 0.1) {
            const proximity = 1 - (distM / INTERACTION_CUTOFF);
            const repulseForce = Math.pow(proximity, 2.1) * 4.2 * mouse.hoverScalar;

            const spin = 0.035 * proximity;
            const normX = dxM / distM;
            const normY = dyM / distM;

            node.ax += normX * repulseForce - normY * (mouse.vy * spin);
            node.ay += normY * repulseForce + normX * (mouse.vx * spin);

            node.phosphor = Math.min(1, node.phosphor + proximity * 0.08);
          }
        }

        // موج شوک برهم‌کنش کلیک / لمس
        for (let s = 0; s < shockwaves.length; s++) {
          const sw = shockwaves[s]!;
          if (sw.implosionTimer <= 0) {
            const dW = Math.hypot(node.x - sw.x, node.y - sw.y);
            const diff = Math.abs(dW - sw.radius);

            if (diff < 24) {
              const phase = (diff / 24) * Math.PI;
              const impulse = Math.cos(phase) * (sw.energy / (dW * 0.09 + 1));
              const angle = Math.atan2(node.y - sw.y, node.x - sw.x);
              node.ax += Math.cos(angle) * impulse * 0.48;
              node.ay += Math.sin(angle) * impulse * 0.48;
              node.phosphor = Math.min(1, node.phosphor + Math.cos(phase) * 0.35);
            }
          }
        }

        node.vx = (node.vx + node.ax) * DAMPING;
        node.vy = (node.vy + node.ay) * DAMPING;

        // مهار جابه‌جایی الاستیک میکرو
        const dispX = (node.x + node.vx) - node.ox;
        const dispY = (node.y + node.vy) - node.oy;
        const dispMag = Math.hypot(dispX, dispY);

        if (dispMag > DISPERSAL_LIMIT) {
          const scale = DISPERSAL_LIMIT / dispMag;
          node.vx = (node.ox + dispX * scale) - node.x;
          node.vy = (node.oy + dispY * scale) - node.y;
        }

        node.x += node.vx;
        node.y += node.vy;

        // استهلاک نمایی فسفرسانس
        node.phosphor *= 0.955;
        const speed = Math.hypot(node.vx, node.vy);
        const distOrig = Math.hypot(node.x - node.ox, node.y - node.oy);
        totalKinetic += speed + distOrig + node.phosphor;
        node.strain = Math.min(1, (distOrig / DISPERSAL_LIMIT) * 0.72 + (speed / 3.0) * 0.28);

        if (node.strain > 0.07 || node.phosphor > 0.1) {
          activeNodes.push(node);
        }

        // پاشش نوری براگ متأثر از فسفرسانس
        const combinedGlow = Math.max(node.strain, node.phosphor);
        const braggShift = combinedGlow * 55;
        const renderR = Math.min(255, Math.floor(node.r + braggShift * 0.25));
        const renderG = Math.min(255, Math.floor(node.g + braggShift * 0.55));
        const renderB = Math.min(255, Math.floor(node.b + braggShift * 0.95));

        node.phase += 0.02;
        const quantumFlicker = 0.95 + Math.sin(node.phase + tick) * 0.05;
        const nodeAlpha = (0.11 + combinedGlow * 0.58) * quantumFlicker;
        const nodeRadius = node.baseR + combinedGlow * 0.85;

        ctx.beginPath();
        ctx.arc(node.x, node.y, nodeRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${renderR}, ${renderG}, ${renderB}, ${nodeAlpha})`;
        ctx.fill();
      }
    }
    // ۲. تارهای الاستیک فوتونی بین گره‌های برانگیخته
    const maxThreadDist = GRID_STEP * 1.45;
    const maxDistSq = maxThreadDist * maxThreadDist;
    ctx.lineWidth = 0.65;
    for (let i = 0; i < activeNodes.length; i++) {
      const p1 = activeNodes[i]!;
      for (let j = i + 1; j < activeNodes.length; j++) {
        const p2 = activeNodes[j]!;
        const dx = p1.x - p2.x;
        if (Math.abs(dx) > maxThreadDist) continue;
        const dy = p1.y - p2.y;
        if (Math.abs(dy) > maxThreadDist) continue;
        const dSq = dx * dx + dy * dy;
        if (dSq < maxDistSq) {
          const d = Math.sqrt(dSq);
          const avgGlow = Math.max(
            (p1.strain + p2.strain) * 0.5,
            (p1.phosphor + p2.phosphor) * 0.5
          );
          const alpha = (1 - (d / maxThreadDist)) * avgGlow * 0.42;

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          const midX = (p1.x + p2.x) * 0.5 + (p1.vy - p2.vy) * 2.0;
          const midY = (p1.y + p2.y) * 0.5 - (p1.vx - p2.vx) * 2.0;
          ctx.quadraticCurveTo(midX, midY, p2.x, p2.y);
          ctx.strokeStyle = `rgba(${stateRgb[0]}, ${stateRgb[1]}, ${stateRgb[2]}, ${alpha})`;
          ctx.stroke();
        }
      }
    }

    const isQuiet = shockwaves.length === 0 && !mouse.active && mouse.hoverScalar < 0.005 && activeNodes.length === 0 && totalKinetic < 1.0;
    if (isQuiet) {
      settleFrames++;
    } else {
      settleFrames = 0;
    }

    if (settleFrames > 25) {
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]!;
        n.x = n.ox;
        n.y = n.oy;
        n.vx = 0;
        n.vy = 0;
        n.phosphor = 0;
        n.strain = 0;
      }
      isRunning = false;
      return;
    }

    requestAnimationFrame(draw);
  }

  // Defer until after the app's first render so JS startup isn't competing with canvas
  requestAnimationFrame(() => requestAnimationFrame(wakeAnimation));
})();

export { state };