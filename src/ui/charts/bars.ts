/* Bar chart (DOM) + axis caption. */
import { toJ, isoToDate } from '../../jalali';
import { fmtHours, faNum, type AppSettings } from '../../settings';
import type { DayPoint } from '../../types';
import { levelOf } from '../wall';

export function axisCaption(): string {
  return '<div class="axis-cap">محور افقی: تاریخ | محور عمودی: ساعت کارکرد</div>';
}

/* plot is 150px tall: 18px day-label row + 132px drawable bar area */
const LAB_H = 18;
const BAR_AREA = 132;
/* overall charts speak the wall's teal language */
const LEVEL_BG = ['', 'rgba(79, 163, 163, .16)', 'rgba(79, 163, 163, .32)', 'rgba(79, 163, 163, .58)', 'var(--accent)'];

export function chartHTML(days: DayPoint[], opts: { mean?: number; target?: number; taskId?: string | null } = {}, s: AppSettings): string {
  const { mean = 0, target = 0, taskId = null } = opts;
  if (!days.length) return '<div class="chart-empty">داده‌ای برای نمایش نیست</div>';
  const maxV = Math.max(target || 0, ...days.map(d => d.hours), 1) * 1.22;
  const rawMax = Math.max(...days.map(d => d.hours), 0);
  const lastJd = toJ(isoToDate(days[days.length - 1]!.date)).jd;
  const yPx = (v: number) => LAB_H + (v / maxV) * BAR_AREA;

  /* y-axis: gridlines + hour labels (same language as the line chart) */
  let grid = '';
  for (let k = 0; k <= 4; k++) {
    const v = maxV * k / 4;
    const b = yPx(v).toFixed(1);
    grid += '<div class="plot-grid' + (k === 0 ? ' zero' : '') + '" style="bottom:' + b + 'px"></div>' +
      '<span class="plot-ylab" style="bottom:' + b + 'px">' + fmtHours(v, s) + '</span>';
  }

  const useLevels = !taskId;
  const bars = days.map((d, i) => {
    const j = toJ(isoToDate(d.date));
    const h = (d.hours / maxV) * 88; /* 132px of the 150px column */
    const showLabel = j.jd === 1 || j.jd === lastJd || j.jd % 5 === 0;
    const delay = Math.min(i * 8, 360);
    const bg = useLevels && d.hours > 0 ? 'background:' + LEVEL_BG[levelOf(d.hours, rawMax)] + ';' : '';
    const attrs = ' class="bar-col clickable" data-action="goto-day" data-date="' + d.date + '" data-hover-day="' + d.date + '"';
    return '<div' + attrs + '>' +
      '<div class="bar ' + (d.hours > 0 ? '' : 'zero') + '" style="height:' + h.toFixed(1) + '%;' + bg + 'animation-delay:' + delay + 'ms"></div>' +
      '<span class="bar-day">' + (showLabel ? faNum(j.jd) : '') + '</span>' +
      '</div>';
  }).join('');

  let lines = '';
  if (mean > 0) lines += '<div class="plot-line mean" style="bottom:' + yPx(mean).toFixed(1) + 'px" title="میانگین: ' + fmtHours(mean, s) + ' ساعت"></div>';
  if (target > 0) lines += '<div class="plot-line target" style="bottom:' + yPx(target).toFixed(1) + 'px" title="هدف روزانه: ' + fmtHours(target, s) + ' ساعت"></div>';

  return '<div class="plot plot-bars" style="direction:' + s.chartDir + '">' + grid +
    '<div class="bars">' + bars + '</div>' + lines + '</div>' +
    ((mean > 0 || target > 0) ?
      '<div class="legend">' +
      (mean > 0 ? '<span class="lg-mean"><i></i>میانگین ' + fmtHours(mean, s) + '</span>' : '') +
      (target > 0 ? '<span class="lg-target"><i></i>هدف ' + fmtHours(target, s) + '</span>' : '') +
      '</div>' : '') + axisCaption();
}