/* Line chart (hand-rolled SVG) + per-task/total series builders. */

import { toJ, isoToDate, jDayLabel, jShortLabel } from '../../jalali';
import { fmtHours, faNum, type AppSettings } from '../../settings';
import type { DayPoint, Task } from '../../types';
import type { Repo } from '../../storage';
import { taskEffectiveStart } from '../../analysis';

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
  /* imported tasks have entries older than createdAt — cut at effective start */
  const start = taskEffectiveStart(repo, task);
  return days.map(d => (start && d.date < start) ? null : (byDate.get(d.date) || 0));
}

function legendHTML(items: { name: string; color: string }[]): string {
  if (!items || items.length < 2) return '';
  return '<div class="legend">' + items.map(it => '<span><i style="border-color:' + it.color + '"></i>' + esc(it.name) + '</span>').join('') + '</div>';
}

import { esc } from '../../utils';

export function lineChartHTML(days: DayPoint[], series: LineSeries[], opts: {
  mean?: number; target?: number; clickable?: boolean; h?: number; hoverDay?: boolean;
}, s: AppSettings): string {
  const n = days.length;
  if (!n) return '<div class="chart-empty">داده‌ای برای نمایش نیست</div>';
  const { mean = 0, target = 0, clickable = true, h = 190, hoverDay = false } = opts;
  const rtl = s.chartDir === 'rtl';
  const mobile = typeof window !== 'undefined' && window.innerWidth && window.innerWidth < 640;
  const W = mobile ? 360 : 700;
  const padR = rtl ? 64 : 14, padL = rtl ? 14 : 64, padT = 14, padB = 26;
  const H = Math.max(h, 90);
  const plotW = W - padR - padL, plotH = H - padT - padB;
  let maxV = target || 0;
  for (const ser of series) for (const v of ser.values) if (v != null && v > maxV) maxV = v;
  if (mean > maxV) maxV = mean;
  maxV = Math.max(maxV, 1) * 1.15;
  const insetX = 14;
  const step = n === 1 ? (plotW - 2 * insetX) / 2 : (plotW - 2 * insetX) / (n - 1);
  const X = (i: number) => rtl ? W - padR - insetX - i * step : padL + insetX + i * step;
  const Y = (v: number) => padT + (1 - v / maxV) * plotH;
  const yLabX = rtl ? W - padR + 8 : padL - 8;
  const yLabAnchor = rtl ? 'start' : 'end';

  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = maxV * k / 4;
    grid += '<line class="lc-grid" x1="' + padL + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(v).toFixed(1) + '"/>' +
      '<text x="' + yLabX + '" y="' + (Y(v) + 3.5).toFixed(1) + '" text-anchor="' + yLabAnchor + '">' + fmtHours(v, s) + '</text>';
  }
  const tickEvery = n > 45 ? 14 : n > 20 ? 7 : 5;
  let ticks = '';
  for (let i = 0; i < n; i++) {
    const j = toJ(isoToDate(days[i]!.date));
    if (!(i === 0 || i === n - 1 || j.jd % tickEvery === 0)) continue;
    if (n === 1 && i !== 0) continue;
    const anchor = i === 0 ? (rtl ? 'end' : 'start') : (i === n - 1 ? (rtl ? 'start' : 'end') : 'middle');
    const x = X(i).toFixed(1);
    ticks += '<line class="lc-axis" x1="' + x + '" y1="' + (H - padB) + '" x2="' + x + '" y2="' + (H - padB + 4) + '"/>';
    if (i !== 0) {
      ticks += '<text x="' + x + '" y="' + (H - 8) + '" text-anchor="' + anchor + '">' + (n > 10 ? faNum(j.jd) : jShortLabel(days[i]!.date)) + '</text>';
    }
  }
  let paths = '';
  for (const ser of series) {
    let dPath = '', pen = false;
    for (let i = 0; i < n; i++) {
      const v = ser.values[i];
      if (v == null) { pen = false; continue; }
      dPath += (pen ? ' L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1);
      pen = true;
    }
    if (dPath) paths += '<path class="lc-line" d="' + dPath + '" style="stroke:' + ser.color + '"' + (ser.total ? ' stroke-width="2.5"' : '') + '/>';
  }
  let dots = '';
  if (n <= 62) {
    const r = n > 40 ? 2.2 : 3;
    for (const ser of series) {
      if (ser.total && !hoverDay) continue;
      for (let i = 0; i < n; i++) {
        const v = ser.values[i];
        if (v == null) continue;
        const cx = X(i).toFixed(1), cy = Y(v).toFixed(1);
        if (hoverDay) {
          dots += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + ser.color + '" class="lc-dot"/>';
          dots += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="transparent" class="lc-dot" data-hover-day="' + days[i]!.date + '"/>';
          continue;
        }
        dots += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + ser.color + '"' + (clickable && ser.taskId ? ' class="lc-dot"' : '') + '><title>' + jDayLabel(days[i]!.date) + ': ' + fmtHours(v, s) + ' ساعت</title></circle>';
        if (clickable && ser.taskId) {
          dots += '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="transparent" class="lc-dot" data-action="edit-day" data-task="' + ser.taskId + '" data-date="' + days[i]!.date + '"/>';
        }
      }
    }
  }
  let lines = '';
  if (mean > 0) lines += '<line class="lc-mean" x1="' + padL + '" y1="' + Y(mean).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(mean).toFixed(1) + '"><title>میانگین: ' + fmtHours(mean, s) + ' ساعت</title></line>';
  if (target > 0) lines += '<line class="lc-target" x1="' + padL + '" y1="' + Y(target).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(target).toFixed(1) + '"><title>هدف روزانه: ' + fmtHours(target, s) + ' ساعت</title></line>';
  return '<svg class="linechart" viewBox="0 0 ' + W + ' ' + H + '" role="img">' + grid + lines + paths + ticks + dots + '</svg>' +
    legendHTML(series.map(sr => ({ name: sr.name, color: sr.color }))) + axisCaption();
}

import { axisCaption } from './bars';
