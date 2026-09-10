/* Line chart (hand-rolled SVG) - Modern Linear/Vercel Style */
import { toJ, isoToDate, jDayLabel, jShortLabel } from '../../jalali';
import { fmtHours, faNum, type AppSettings } from '../../settings';
import type { DayPoint, Task } from '../../types';
import type { Repo } from '../../storage';
import { taskEffectiveStart } from '../../analysis';
import { esc } from '../../utils';
import { axisCaption } from './bars';

export interface LineSeries {
  name: string;
  color: string;
  values: (number | null)[];
  taskId?: string;
  total?: boolean;
}

export function seriesForTask(repo: Repo, task: Task, days: DayPoint[]): (number | null)[] {
  const byDate = new Map<string, number>();
  for (const e of repo.entriesForTask(task.id)) byDate.set(e.date, (byDate.get(e.date) || 0) + e.hours);
  const start = taskEffectiveStart(repo, task);
  return days.map(d => (start && d.date < start ? null : byDate.get(d.date) || 0));
}

let gradSeq = 0;

/* منحنی روان با مهار امواج اضافی و خطوط تخت در مقادیر صفر متوالی */
function smoothPath(pts: { x: number; y: number }[], yTop: number, yBase: number): string {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return 'M' + pts[0]!.x.toFixed(1) + ' ' + pts[0]!.y.toFixed(1) + ' h0.1';

  const cy = (y: number) => Math.max(yTop, Math.min(yBase, y));
  let d = 'M' + pts[0]!.x.toFixed(1) + ' ' + pts[0]!.y.toFixed(1);

  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1]!;
    const p1 = pts[i]!;
    const p2 = pts[i + 1]!;
    const p3 = pts[i + 2 < n ? i + 2 : n - 1]!;

    if (Math.abs(p1.y - yBase) < 0.5 && Math.abs(p2.y - yBase) < 0.5) {
      d += ' L' + p2.x.toFixed(1) + ' ' + yBase.toFixed(1);
      continue;
    }

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = cy(p1.y + (p2.y - p0.y) / 6);
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = cy(p2.y - (p3.y - p1.y) / 6);

    d +=
      ' C' +
      cp1x.toFixed(1) +
      ' ' +
      cp1y.toFixed(1) +
      ' ' +
      cp2x.toFixed(1) +
      ' ' +
      cp2y.toFixed(1) +
      ' ' +
      p2.x.toFixed(1) +
      ' ' +
      p2.y.toFixed(1);
  }
  return d;
}

function segmentsOf(
  values: (number | null)[],
  X: (i: number) => number,
  Y: (v: number) => number
): { x: number; y: number }[][] {
  const segs: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v == null) {
      if (cur.length) {
        segs.push(cur);
        cur = [];
      }
      continue;
    }
    cur.push({ x: X(i), y: Y(v) });
  }
  if (cur.length) segs.push(cur);
  return segs;
}

function legendHTML(items: { name: string; color: string }[]): string {
  if (!items || items.length === 0) return '';
  return (
    '<div class="legend">' +
    items
      .map(it => '<span><i style="border-color:' + it.color + ';background:' + it.color + '"></i>' + esc(it.name) + '</span>')
      .join('') +
    '</div>'
  );
}

function linesLegend(mean: number, target: number, s: AppSettings): string {
  if (!(mean > 0 || target > 0)) return '';
  return (
    '<div class="legend">' +
    (mean > 0 ? '<span class="lg-mean"><i></i>میانگین ' + fmtHours(mean, s) + '</span>' : '') +
    (target > 0 ? '<span class="lg-target"><i></i>هدف ' + fmtHours(target, s) + '</span>' : '') +
    '</div>'
  );
}

export function lineChartHTML(
  days: DayPoint[],
  series: LineSeries[],
  opts: {
    mean?: number;
    target?: number;
    clickable?: boolean;
    h?: number;
    hoverDay?: boolean;
    taskId?: string | null;
  } = {},
  s: AppSettings
): string {
  const n = days.length;
  if (!n) return '<div class="chart-empty">داده‌ای برای نمایش نیست</div>';
  const { mean = 0, target = 0, h = 220 } = opts;
  const rtl = s.chartDir === 'rtl';

  // ابعاد پایه SVG
  const W = Math.max(680, n * 24);
  const H = Math.max(h, 220);

  const padL = rtl ? 35 : 65;
  const padR = rtl ? 65 : 35;
  const padT = 24;
  const padB = 40;

  const plotW = W - padR - padL;
  const plotH = H - padT - padB;
  const yBase = H - padB;

  let peak = Math.max(target || 0, mean || 0, 1);
  for (const ser of series) {
    for (const v of ser.values) {
      if (v != null && v > peak) peak = v;
    }
  }
  const maxV = peak * 1.22;

  const insetX = 20;
  const step = n > 1 ? (plotW - 2 * insetX) / (n - 1) : 0;

  const X = (i: number) => {
    if (n === 1) return padL + plotW / 2;
    return rtl ? W - padR - insetX - i * step : padL + insetX + i * step;
  };
  const Y = (v: number) => padT + (1 - v / maxV) * plotH;

  /* محور عمودی Y */
  const yLabX = rtl ? W - padR + 12 : padL - 12;
  const yLabAnchor = rtl ? 'start' : 'end';

  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = (maxV * k) / 4;
    const yPos = Y(v).toFixed(1);
    grid +=
      '<line class="lc-grid" x1="' + padL + '" y1="' + yPos + '" x2="' + (W - padR) + '" y2="' + yPos + '"/>' +
      '<text class="lc-ylab" x="' + yLabX + '" y="' + (Y(v) + 4).toFixed(1) + '" text-anchor="' + yLabAnchor + '">' +
      fmtHours(v, s) +
      '</text>';
  }

  /* محور افقی X */
  let ticks = '<line class="lc-base" x1="' + padL + '" y1="' + yBase + '" x2="' + (W - padR) + '" y2="' + yBase + '"/>';
  const tickEvery = n > 45 ? 7 : n > 20 ? 4 : 2;

  for (let i = 0; i < n; i++) {
    const j = toJ(isoToDate(days[i]!.date));
    const isFirst = i === 0;
    const isLast = i === n - 1;
    const isPeriodic = j.jd % tickEvery === 0;

    if (!isFirst && !isLast && (!isPeriodic || i < 2 || i > n - 3)) continue;

    const x = X(i).toFixed(1);
    ticks +=
      '<line class="lc-axis" x1="' + x + '" y1="' + yBase + '" x2="' + x + '" y2="' + (yBase + 5) + '"/>' +
      '<text class="lc-xlab" x="' + x + '" y="' + (yBase + 22) + '" text-anchor="middle">' +
      (n > 10 ? faNum(j.jd) : esc(jShortLabel(days[i]!.date))) +
      '</text>';
  }

  const seq = gradSeq++;
  const isMulti = series.length > 1;
  const totalSer = series.find(s => s.total) || (isMulti ? null : series[0]);

  let defs = '';
  let areas = '';
  let paths = '';

  const styles = `
    <style>
      .lc-scroll-wrap {
        width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch;
        padding-bottom: 6px;
      }
      .linechart {
        min-width: 580px;
        width: 100%;
        height: auto;
        display: block;
      }
      .lc-grid { stroke: rgba(255, 255, 255, 0.08); stroke-width: 1; stroke-dasharray: 4,4; }
      .lc-base { stroke: rgba(255, 255, 255, 0.15); stroke-width: 1; }
      .lc-axis { stroke: rgba(255, 255, 255, 0.2); stroke-width: 1; }
      .lc-ylab, .lc-xlab { font-size: 11px; fill: rgba(255, 255, 255, 0.45); font-family: inherit; }
      .lc-mean { stroke: #e3b341; stroke-dasharray: 4,4; stroke-width: 1.2; opacity: 0.75; }
      .lc-target { stroke: #2ea043; stroke-dasharray: 4,4; stroke-width: 1.2; opacity: 0.75; }
      .lc-line { transition: opacity 0.2s ease, stroke-width 0.2s ease; pointer-events: none; }
      .linechart:hover .lc-line { opacity: 0.25; }
      .linechart .lc-line:hover { opacity: 1 !important; stroke-width: 2.8px !important; }
      .lc-hero-area { pointer-events: none; }
      .lc-day-col { cursor: default; }
      .lc-day-col.clickable { cursor: pointer; }
      .lc-day-col .lc-guide { opacity: 0; transition: opacity 0.15s ease; pointer-events: none; }
      .lc-day-col .lc-hover-dot { opacity: 0; transition: opacity 0.15s ease, transform 0.15s ease; transform-box: fill-box; transform-origin: center; pointer-events: none; }
      .lc-day-col:hover .lc-guide { opacity: 1; }
      .lc-day-col:hover .lc-hover-dot { opacity: 1; transform: scale(1.3); }
      .lc-hit-area { pointer-events: all; }
    </style>
  `;

  if (totalSer) {
    const segs = segmentsOf(totalSer.values, X, Y);
    let dArea = '';
    for (const seg of segs) {
      if (seg.length > 1) {
        dArea +=
          smoothPath(seg, padT, yBase) +
          ' L' + seg[seg.length - 1]!.x.toFixed(1) + ' ' + yBase.toFixed(1) +
          ' L' + seg[0]!.x.toFixed(1) + ' ' + yBase.toFixed(1) + ' Z';
      }
    }
    if (dArea) {
      const gid = 'hero-grad-' + seq;
      defs += `
        <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${totalSer.color}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${totalSer.color}" stop-opacity="0.0"/>
        </linearGradient>
      `;
      areas = `<path class="lc-hero-area" d="${dArea}" fill="url(#${gid})" stroke="none"/>`;
    }
  }

  series.forEach((ser) => {
    const segs = segmentsOf(ser.values, X, Y);
    let dLine = '';
    for (const seg of segs) {
      dLine += smoothPath(seg, padT, yBase);
    }
    if (!dLine) return;

    const strokeW = ser.total ? '2.5' : '1.8';
    paths += `
      <path class="lc-line" pathLength="1" stroke-linecap="round" stroke-linejoin="round" d="${dLine}"
        style="stroke:${ser.color};stroke-width:${strokeW};" />
    `;
  });

  const currentTaskId =
    opts.taskId ||
    (series.length === 1 && series[0]?.taskId ? series[0].taskId : (series.find(sr => sr.taskId && !sr.total)?.taskId || null));

  const colW = n > 1 ? step : plotW;
  let interaction = '';

  for (let i = 0; i < n; i++) {
    const cx = X(i);
    const dateStr = days[i]!.date;
    const safeDate = esc(dateStr);

    let tip = esc(jDayLabel(dateStr)) + '\n────────────────\n';
    let hasData = false;

    let dayDots = '';
    for (const ser of series) {
      const v = ser.values[i];
      if (v != null && v > 0) {
        hasData = true;
        tip += '• ' + esc(ser.name) + ': ' + fmtHours(v, s) + ' ساعت\n';
        const cy = Y(v).toFixed(1);
        const r = ser.total ? '4' : '3.2';
        dayDots += `
          <circle class="lc-hover-dot" cx="${cx.toFixed(1)}" cy="${cy}" r="${r}" fill="${ser.color}" stroke="#161b22" stroke-width="2"/>
        `;
      }
    }

    if (!hasData) {
      tip += 'بدون ثبت کارکرد';
    }

    const clickAttrs = currentTaskId
      ? `class="lc-day-col clickable" data-action="edit-day" data-task="${esc(currentTaskId)}" data-date="${safeDate}" data-hover-day="${safeDate}"`
      : `class="lc-day-col" data-hover-day="${safeDate}"`;

    const hitAreaAttrs = currentTaskId
      ? `data-action="edit-day" data-task="${esc(currentTaskId)}" data-date="${safeDate}" style="cursor:pointer;"`
      : `style="cursor:default;"`;

    interaction += `
      <g ${clickAttrs}>
        <title>${tip.trim()}</title>
        <line class="lc-guide" x1="${cx.toFixed(1)}" y1="${padT}" x2="${cx.toFixed(1)}" y2="${yBase}" stroke="rgba(255,255,255,0.2)" stroke-dasharray="3,3" stroke-width="1.2"/>
        ${dayDots}
        <rect class="lc-hit-area" ${hitAreaAttrs} x="${(cx - colW / 2).toFixed(1)}" y="${padT}" width="${colW.toFixed(1)}" height="${plotH}" fill="#ffffff" opacity="0"/>
      </g>
    `;
  }

  let lines = '';
  if (mean > 0) {
    lines += `<line class="lc-mean" x1="${padL}" y1="${Y(mean).toFixed(1)}" x2="${W - padR}" y2="${Y(mean).toFixed(1)}"><title>میانگین: ${fmtHours(mean, s)} ساعت</title></line>`;
  }
  if (target > 0) {
    lines += `<line class="lc-target" x1="${padL}" y1="${Y(target).toFixed(1)}" x2="${W - padR}" y2="${Y(target).toFixed(1)}"><title>هدف روزانه: ${fmtHours(target, s)} ساعت</title></line>`;
  }

  const legendItems = series.map(sr => ({ name: sr.name, color: sr.color }));

  return (
    styles +
    `<div class="lc-scroll-wrap">` +
    `<svg class="linechart" viewBox="0 0 ${W} ${H}" style="direction:ltr;overflow:visible;" preserveAspectRatio="xMidYMid meet" role="img">` +
    (defs ? `<defs>${defs}</defs>` : '') +
    grid +
    areas +
    lines +
    paths +
    ticks +
    interaction +
    `</svg>` +
    `</div>` +
    legendHTML(legendItems) +
    linesLegend(mean, target, s) +
    axisCaption()
  );
}