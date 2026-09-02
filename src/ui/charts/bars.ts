/* Bar chart (DOM) + axis caption. */

import { toJ, isoToDate, jDayLabel } from '../../jalali';
import { fmtHours, faNum, type AppSettings } from '../../settings';
import type { DayPoint } from '../../types';

export function axisCaption(): string {
  return '<div class="axis-cap">محور افقی: تاریخ | محور عمودی: ساعت کارکرد</div>';
}

export function chartHTML(days: DayPoint[], opts: { mean?: number; target?: number; taskId?: string | null } = {}, s: AppSettings): string {
  const { mean = 0, target = 0, taskId = null } = opts;
  if (!days.length) return '<div class="chart-empty">داده‌ای برای نمایش نیست</div>';
  const maxV = Math.max(target || 0, ...days.map(d => d.hours), 1) * 1.15;
  const lastJd = toJ(isoToDate(days[days.length - 1]!.date)).jd;
  const bars = days.map(d => {
    const j = toJ(isoToDate(d.date));
    const h = (d.hours / maxV) * 100;
    const showLabel = j.jd === 1 || j.jd === lastJd || j.jd % 5 === 0;
    const attrs = taskId ? ' class="bar-col clickable" data-action="edit-day" data-task="' + taskId + '" data-date="' + d.date + '"' : ' class="bar-col"';
    return '<div' + attrs + ' title="' + jDayLabel(d.date) + ': ' + fmtHours(d.hours, s) + ' ساعت">' +
      '<div class="bar ' + (d.hours > 0 ? '' : 'zero') + '" style="height:' + h.toFixed(1) + '%"></div>' +
      '<span class="bar-day">' + (showLabel ? faNum(j.jd) : '') + '</span>' +
      '</div>';
  }).join('');
  let lines = '';
  if (mean > 0) lines += '<div class="plot-line mean" style="bottom:calc(15px + ' + (mean / maxV * 100).toFixed(1) + '%)" title="میانگین: ' + fmtHours(mean, s) + ' ساعت"></div>';
  if (target > 0) lines += '<div class="plot-line target" style="bottom:calc(15px + ' + (target / maxV * 100).toFixed(1) + '%)" title="هدف روزانه: ' + fmtHours(target, s) + ' ساعت"></div>';
  return '<div class="plot" style="direction:' + s.chartDir + '"><div class="bars">' + bars + '</div>' + lines + '</div>' +
    ((mean > 0 || target > 0) ?
      '<div class="legend">' +
      (mean > 0 ? '<span class="lg-mean"><i></i>میانگین ' + fmtHours(mean, s) + '</span>' : '') +
      (target > 0 ? '<span class="lg-target"><i></i>هدف ' + fmtHours(target, s) + '</span>' : '') +
      '</div>' : '') + axisCaption();
}
