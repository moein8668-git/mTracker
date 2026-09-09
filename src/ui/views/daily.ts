/* view: تحلیل روزانه */
import type { Repo } from '../../storage';
import { appSettings, fmtHours, FA_DATE_FULL, faNum } from '../../settings';
import { todayIso, isoOf, isoToDate, addDays, monthStartOf } from '../../jalali';
import { taskPeriodAnalysis, streakOf, overallRollingMean } from '../../analysis';
import { analyze } from '../../analytics';
import { esc } from '../../utils';
import { statBox } from '../bits';
import { lineChartHTML } from '../charts/line';
import { state } from '../state';
import { jcalHTML } from '../jcal';

export function viewDaily(repo: Repo): string {
  const s = appSettings(repo.db);
  if (!state.day) state.day = todayIso();
  const dIso = state.day;
  const tIso = todayIso();
  const isToday = dIso === tIso;
  const tasks = repo.activeTasks();
  const calView = state.calMonth || isoOf(monthStartOf(isoToDate(dIso)));

  let html = '<section class="card daily-nav">' +
    '<button class="btn ghost" data-action="day-prev">روز قبل</button>' +
    '<div class="month-title"><h2>' + FA_DATE_FULL.format(isoToDate(dIso)) + '</h2>' +
    '<div class="month-sub">' + (isToday ? '<span class="mini-chip hit">امروز</span>' : '<span class="mini-chip none">روز انتخاب‌شده</span>') + '</div></div>' +
    '<button class="btn ghost" data-action="day-next"' + (isToday ? ' disabled' : '') + '>روز بعد</button>' +
    '</section>';

  if (!tasks.length) {
    return html + '<section class="card empty-state"><h2>تسکی وجود ندارد</h2>' +
      '<p>برای تحلیل روزانه، اول یک تسک بساز.</p>' +
      '<button class="btn primary" data-action="open-task">ساخت تسک</button></section>';
  }

  const dayEntries = repo.entries.filter(e => e.date === dIso);
  const byTask = new Map(dayEntries.map(e => [e.taskId, e]));
  const dayTotal = dayEntries.reduce((a, e) => a + e.hours, 0);
  const targetSum = tasks.reduce((a, t) => a + (t.targetDailyHours || 0), 0);
  const goalPct = targetSum > 0 ? (dayTotal / targetSum) * 100 : null;
  const m7 = overallRollingMean(repo, 7, dIso);
  const m30 = overallRollingMean(repo, 30, dIso);
  const delta30 = m30 > 0 ? (dayTotal - m30) / m30 * 100 : null;
  const spark = analyze({ startIso: isoOf(addDays(isoToDate(dIso), -13)), endIso: dIso, entries: repo.entries, target: 0 });

  html += '<div class="daily-cols">';
  html += '<section class="card jcal-card"><div class="card-head"><h3>تقویم شمسی</h3>' +
    (isToday ? '' : '<button class="btn small ghost" data-action="day-today" style="margin-inline-start:auto">برو به امروز</button>') +
    '</div>' +
    jcalHTML(repo, calView, dIso, s) +
    '<p class="rule-hint">💡 برای جابه‌جایی تاریخ، روز مورد نظر را انتخاب کن. میزان کارکرد با غلظت رنگ نمایش داده می‌شود.</p></section>';

  html += '<section class="card"><div class="card-head"><h3>خلاصه کارکرد روز</h3>' +
    '<span class="mini-chip ' + (dayTotal > 0 ? 'hit' : 'none') + '">' + (dayTotal > 0 ? 'ثبت شده' : 'بدون ثبت') + '</span></div>' +
    (goalPct != null
      ? '<div class="day-goal"><div class="dg-head"><span>تحقق هدف روزانه</span><b>' + faNum(Math.round(goalPct)) + '٪</b></div>' +
        '<div class="progress"><i style="width:' + Math.min(100, goalPct).toFixed(0) + '%"></i></div></div>'
      : '<p class="rule-hint" style="margin:12px 0 0">هدفی برای تسک‌ها تعیین نشده تا درصد تحقق محاسبه شود.</p>') +
    '<div class="stats">' +
    statBox('مجموع کارکرد', fmtHours(dayTotal, s), 'ساعت') +
    statBox('هدف تعیین‌شده', targetSum > 0 ? fmtHours(targetSum, s) : '—', targetSum > 0 ? 'ساعت' : '') +
    statBox('میانگین ۷ روز اخیر', fmtHours(m7, s), 'ساعت') +
    statBox('میانگین ۳۰ روز اخیر', fmtHours(m30, s), 'ساعت') +
    '</div>' +
    (delta30 != null ? '<p class="rule-hint">عملکرد امروز <b class="' + (delta30 >= 0 ? 'c-ok' : 'c-warn') + '">' +
    faNum(Math.abs(Math.round(delta30))) + '٪ ' + (delta30 >= 0 ? 'بیشتر' : 'کمتر') + '</b> از میانگین ۳۰ روز گذشته است.</p>' : '') +
    '<p class="rule-hint" style="margin-top:2px">روند ۱۴ روز اخیر (مجموع همه تسک‌ها) — با نگه‌داشتن ماوس روی هر نقطه، تسک‌های همان روز را می‌بینی:</p>' +
    lineChartHTML(spark.days, [{ name: 'مجموع', color: 'var(--ink)', total: true, values: spark.days.map(d => d.hours) }], { h: 120, clickable: false, hoverDay: true }, s) +
    '</section>';
  html += '</div>';

  html += '<section class="card" style="margin-top:14px"><div class="card-head"><h3>تسک‌ها در این روز</h3></div>';
  for (const t of tasks) {
    const e = byTask.get(t.id);
    const tp = taskPeriodAnalysis(repo, t, isoOf(addDays(isoToDate(dIso), -29)), dIso);
    const st = streakOf(repo, t.id, dIso);
    const chip = e
      ? (t.targetDailyHours > 0
        ? (e.hours >= t.targetDailyHours ? '<span class="mini-chip hit">هدف برآورده</span>' : '<span class="mini-chip under">زیر هدف</span>')
        : '<span class="mini-chip hit">ثبت شده</span>')
      : '<span class="mini-chip none">ثبت نشده</span>';

    html += '<div class="day-task">' +
      '<span class="dot" style="--task:' + t.color + '"></span>' +
      '<div class="d-hours' + (e ? '' : ' none') + '">' + (e ? fmtHours(e.hours, s) + ' ساعت' : 'ثبت نشده') + '</div>' +
      '<div>' +
        '<div class="d-name">' + esc(t.name) + '</div>' +
        '<div class="d-meta">' +
        (t.targetDailyHours > 0 ? 'هدف: <b>' + fmtHours(t.targetDailyHours, s) + '</b> ساعت<span class="sep">|</span>' : '') +
        'میانگین ۳۰ روزه: <b>' + fmtHours(tp.mean, s) + '</b>' +
        (st > 0 ? '<span class="sep">|</span>زنجیره: <b>' + faNum(st) + '</b> روز' : '') +
        (e && e.note ? '<span class="sep">|</span>یادداشت: ' + esc(e.note) : '') +
        '</div>' +
      '</div>' +
      chip +
      '<div class="d-actions">' +
      '<button class="btn small" data-action="quick-add" data-task="' + t.id + '" data-date="' + dIso + '" data-amount="0.5">+۳۰ دقیقه</button>' +
      '<button class="btn small" data-action="quick-add" data-task="' + t.id + '" data-date="' + dIso + '" data-amount="1">+۱ ساعت</button>' +
      '<button class="btn small ghost" data-action="open-entry" data-task="' + t.id + '" data-date="' + dIso + '">ویرایش</button>' +
      '</div></div>';
  }
  html += '</section>';
  return html;
}
