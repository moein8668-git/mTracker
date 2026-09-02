/* view: امروز */

import type { Repo } from '../../storage';
import { appSettings, fmtHours, FA_DATE_FULL, faNum } from '../../settings';
import { todayIso, monthStartOf } from '../../jalali';
import { taskWeekAnalysis, overallMonthAnalysis } from '../../analysis';
import { badge, statBox } from '../bits';
import { esc } from '../../utils';

export function viewToday(repo: Repo): string {
  const s = appSettings(repo.db);
  const tasks = repo.activeTasks();
  const tIso = todayIso();
  const todayTotal = repo.entries.filter(e => e.date === tIso).reduce((a, e) => a + e.hours, 0);

  let html = '<section class="hero">' +
    '<div><div class="hero-date">' + FA_DATE_FULL.format(new Date()) + '</div>' +
    '<div class="hero-sub">' + (todayTotal > 0
      ? 'امروز ' + fmtHours(todayTotal, s) + ' ساعت ثبت شده'
      : 'امروز هنوز چیزی ثبت نشده') + '</div></div>' +
    '<button class="btn primary" data-action="open-entry">ثبت دستی ساعت</button>' +
    '</section>';

  if (!tasks.length) {
    return html + '<section class="card empty-state">' +
      '<h2>اولین تسکت را بساز</h2>' +
      '<p>برای هر کار تخصصی یک تسک بساز، هدف روزانه‌اش را مشخص کن و هر روز ساعت کارکردت را ثبت کن. میانگین، انحراف معیار و قانون پایداری (SD کمتر از نصف میانگین) خودکار محاسبه می‌شود.</p>' +
      '<button class="btn primary" data-action="open-task">ساخت تسک</button>' +
      '<button class="btn ghost" data-action="load-sample">دیدن با داده نمونه</button>' +
      '</section>';
  }

  html += '<div class="task-grid">' + tasks.map(t => {
    const e = repo.findEntry(t.id, tIso);
    const wk = taskWeekAnalysis(repo, t);
    const wkChip = wk ? '<div class="week-chip"><span class="wc-label">۷ روز اخیر</span>' +
      '<span>میانگین <b>' + fmtHours(wk.mean, s) + '</b></span>' +
      '<span>انحراف <b>' + fmtHours(wk.sd, s) + '</b></span>' +
      badge(wk.status) + '</div>' : '';
    return '<article class="card task-card" style="--task:' + t.color + '">' +
      '<header><span class="dot"></span><h3>' + esc(t.name) + '</h3>' +
      '<span class="target-chip">' + (t.targetDailyHours > 0 ? 'هدف: ' + fmtHours(t.targetDailyHours, s) + ' ساعت در روز' : 'بدون هدف') + '</span></header>' +
      '<div class="today-row">' +
      (e ? '<div class="today-hours">' + fmtHours(e.hours, s) + ' ساعت</div>'
         : '<div class="today-hours none">ثبت نشده</div>') +
      '<div class="quick">' +
      '<button class="btn small" data-action="quick-add" data-task="' + t.id + '" data-amount="0.5">+۳۰ دقیقه</button>' +
      '<button class="btn small" data-action="quick-add" data-task="' + t.id + '" data-amount="1">+۱ ساعت</button>' +
      '<button class="btn small ghost" data-action="open-entry" data-task="' + t.id + '">ویرایش</button>' +
      '</div></div>' + wkChip + '</article>';
  }).join('') + '</div>';

  const ov = overallMonthAnalysis(repo, monthStartOf(new Date()));
  html += '<section class="card" style="margin-top:16px">' +
    '<div class="card-head"><h3>ماه جاری (همه تسک‌ها)</h3>' + badge(ov.status) +
    '<button class="btn small ghost" data-action="tab" data-tab="report" style="margin-inline-start:auto">گزارش کامل</button></div>' +
    '<div class="stats">' +
    statBox('مجموع ساعت', fmtHours(ov.total, s), 'ساعت') +
    statBox('میانگین روزانه', fmtHours(ov.mean, s), 'ساعت') +
    statBox('انحراف معیار', fmtHours(ov.sd, s), 'ساعت') +
    statBox('روزهای فعال', faNum(ov.activeDays) + ' از ' + faNum(ov.n), '') +
    '</div></section>';
  return html;
}
