/* Month wall: 7-column RTL grid. Pure presentational mapping over DayPoints. */

import type { AppSettings } from '../settings';
import { fmtHours, faNum } from '../settings';
import { isoToDate, toJ, jDayLabel } from '../jalali';
import type { DayPoint } from '../types';

const WEEK_HEAD = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

function levelOf(h: number, max: number): number {
  if (h <= 0) return 0;
  if (max <= 0) return 1;
  const r = h / max;
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  return 4;
}

export function wallHTML(days: DayPoint[], s: AppSettings, today: string): string {
  if (!days.length) return '<div class="chart-empty">داده‌ای برای نمایش نیست</div>';
  const max = Math.max(...days.map(d => d.hours), 0);
  const by: Record<string, number> = {};
  for (const d of days) by[d.date] = d.hours;
  const startIso = days[0]!.date;
  /* Iranian week starts Saturday (getDay 6) */
  const lead = (isoToDate(startIso).getDay() - 6 + 7) % 7;
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="wall-cell blank" aria-hidden="true"></span>';
  for (const d of days) {
    const h = by[d.date] || 0;
    const lvl = levelOf(h, max);
    const j = toJ(isoToDate(d.date));
    const isToday = d.date === today;
    const title = jDayLabel(d.date) + ': ' + fmtHours(h, s) + ' ساعت';
    cells += '<span class="wall-cell lvl' + lvl + (isToday ? ' today' : '') + '" title="' + title + '">' +
      '<b>' + faNum(j.jd) + '</b>' +
      (h > 0 ? '<i>' + fmtHours(h, s) + '</i>' : '') +
      '</span>';
  }
  const head = WEEK_HEAD.map(w => '<span class="wall-head">' + w + '</span>').join('');
  const total = days.reduce((a, d) => a + d.hours, 0);
  return '<div class="wall">' +
    '<div class="wall-top"><span class="wall-cap">دیوار ماه — هر خانه یک روز</span>' +
    '<span class="wall-scale"><i class="wall-cell lvl0 mini"></i><i class="wall-cell lvl1 mini"></i>' +
    '<i class="wall-cell lvl2 mini"></i><i class="wall-cell lvl3 mini"></i><i class="wall-cell lvl4 mini"></i>' +
    '<span class="wall-total">' + fmtHours(total, s) + ' ساعت</span></span></div>' +
    '<div class="wall-grid">' + head + cells + '</div></div>';
}
