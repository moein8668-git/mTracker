/* view: گزارش (ماه شمسی / N روز اخیر / بازه دلخواه) */

import type { Repo } from '../../storage';
import { appSettings, fmtHours, faNum } from '../../settings';
import { monthStartOf, isoOf, addDays, todayIso } from '../../jalali';
import { taskPeriodAnalysis, overallPeriodAnalysis } from '../../analysis';
import { resolvePeriod, type ResolvedPeriod } from '../../period';
import type { AnalyzeResult } from '../../types';
import { esc, normalizeDaysPerWeek } from '../../utils';
import { state } from '../state';
import { badge, VERDICT_NOTE, statBox } from '../bits';
import { chartHTML } from '../charts/bars';
import { lineChartHTML, seriesForTask, type LineSeries } from '../charts/line';
import { wallHTML } from '../wall';
function kindSeg(): string {
  const k = state.period.kind;
  const b = (id: string, label: string) => '<button data-action="set-period" data-kind="' + id + '"' + (k === id ? ' class="active"' : '') + '>' + label + '</button>';
  return '<div class="seg">' + b('month', 'ماه شمسی') + b('rolling', '۳۰ روز اخیر') + b('custom', 'بازه دلخواه') + '</div>';
}

function chartTypeSeg(): string {
  return '<div class="seg">' +
    '<button data-action="set-chart" data-chart="bar"' + (state.chartType === 'bar' ? ' class="active"' : '') + '>میله‌ای</button>' +
    '<button data-action="set-chart" data-chart="line"' + (state.chartType === 'line' ? ' class="active"' : '') + '>خطی</button>' +
    '</div>';
}

function periodControls(p: ResolvedPeriod): string {
  const kind = state.period.kind;
  if (kind === 'month') {
    return '<section class="card month-nav">' +
      '<button class="btn ghost" data-action="month-prev">ماه قبل</button>' +
      '<div class="month-title"><h2>' + p.title + '</h2><div class="month-sub">' + p.sub + '</div></div>' +
      '<button class="btn ghost" data-action="month-next"' + (p.isCurrent ? ' disabled' : '') + '>ماه بعد</button>' +
      '</section>';
  }
  if (kind === 'rolling') {
    return '<section class="card month-nav">' +
      '<div class="seg">' + [7, 14, 30, 90].map(d =>
        '<button data-action="set-rolling" data-days="' + d + '"' + (state.period.rollingDays === d ? ' class="active"' : '') + '>' + faNum(d) + ' روز</button>').join('') + '</div>' +
      '<div class="month-title"><h2>' + p.title + '</h2><div class="month-sub">' + p.sub + '</div></div>' +
      '</section>';
  }
  return '<section class="card month-nav">' +
    '<div class="custom-dates">' +
    '<label>از<input type="date" id="p-from" value="' + (state.period.from || '') + '" max="' + todayIso() + '"></label>' +
    '<label>تا<input type="date" id="p-to" value="' + (state.period.to || '') + '" max="' + todayIso() + '"></label>' +
    '</div>' +
    '<div class="month-title"><h2>' + p.title + '</h2><div class="month-sub">' + p.sub + '</div></div>' +
    '</section>';
}

export function viewReport(repo: Repo): string {
  const s = appSettings(repo.db);
  if (!state.period.monthStart) state.period.monthStart = isoOf(monthStartOf(new Date()));
  const p = resolvePeriod(repo, state.period);
  const tasks = repo.activeTasks();

  let html = '<section class="card period-bar">' + kindSeg() + '<span class="grow"></span>' + chartTypeSeg() + '</section>' + periodControls(p);

  if (!tasks.length) {
    return html + '<section class="card empty-state"><h2>تسکی وجود ندارد</h2>' +
      '<p>برای دیدن تحلیل، اول یک تسک بساز و روزها را ثبت کن.</p>' +
      '<button class="btn primary" data-action="open-task">ساخت تسک</button></section>';
  }

  const ov = overallPeriodAnalysis(repo, p.startIso, p.endIso);
  const ovSeries: LineSeries[] = ([{ name: 'مجموع', color: 'var(--ink)', total: true, values: ov.days.map(d => d.hours) }] as LineSeries[]).concat(
    tasks.map(t => ({ name: t.name, color: t.color, values: seriesForTask(repo, t, ov.days), taskId: t.id }))
  );
  const ovChart = state.chartType === 'line'
    ? lineChartHTML(ov.days, ovSeries, { mean: ov.mean, clickable: false }, s)
    : chartHTML(ov.days, { mean: ov.mean }, s);
  html += '<div class="stack">';
  html += '<section class="card wall-card"><div class="card-head"><h3>دیوار ماه</h3><span class="mini-chip hit">نمای کل</span></div>' +
    '<p class="rule-hint">پررنگ‌تر یعنی ساعت بیشتر؛ خانه امروز با قاب مشخص است.</p>' +
    wallHTML(ov.days, s, todayIso()) + '</section>';
  html += '<section class="card"><div class="card-head"><h3>همه تسک‌ها</h3>' + badge(ov.status) + '</div>' +
    '<p class="rule-hint">' + VERDICT_NOTE[ov.status] + '</p>' +
    '<div class="stats">' +
    statBox('مجموع ساعت', fmtHours(ov.total, s), 'ساعت') +
    statBox('میانگین روزانه', fmtHours(ov.mean, s), 'ساعت') +
    statBox('انحراف معیار', fmtHours(ov.sd, s), 'ساعت') +
    statBox('روزهای فعال', faNum(ov.activeDays) + ' از ' + faNum(ov.n), '') +
    '</div>' + ovChart + '</section>';

  for (const t of tasks) {
    const a: AnalyzeResult = taskPeriodAnalysis(repo, t, p.startIso, p.endIso);
    const d = normalizeDaysPerWeek(t.daysPerWeek);
    const isTracked = d > 0;
    const targetStat = t.targetDailyHours > 0
      ? statBox('میانگین نسبت به هدف', fmtHours(a.mean, s) + ' / ' + fmtHours(t.targetDailyHours, s), 'ساعت',
          '<div class="progress"><i style="width:' + Math.min(100, a.targetPct || 0).toFixed(0) + '%"></i></div>')
      : '';
    const chart = state.chartType === 'line'
      ? lineChartHTML(a.days, [{ name: t.name, color: t.color, values: a.days.map(x => x.hours), taskId: t.id }],
          { mean: a.mean, target: t.targetDailyHours }, s)
      : chartHTML(a.days, { mean: a.mean, target: t.targetDailyHours, taskId: t.id }, s);
    const badgeHtml = isTracked ? badge(a.status) : '<span class="badge mutedb">بدون پایداری</span>';
    const verdictHtml = isTracked
      ? '<p class="rule-hint">' + VERDICT_NOTE[a.status] + '</p>'
      : '<p class="rule-hint">این تسک بدون برنامهٔ پایداری تنظیم شده است و در تب «امروز» نمایش داده نمی‌شود.</p>';
    const sdLimitStat = isTracked ? statBox('حد مجاز نوسان', fmtHours(a.sdLimit, s), 'ساعت') : '';
    const ruleFooter = isTracked
      ? '<p class="rule-hint">قانون پایداری: انحراف معیار باید <b class="' + (a.status === 'ok' ? 'c-ok' : a.status === 'volatile' ? 'c-warn' : 'c-muted') + '">کمتر از ' + fmtHours(a.sdLimit, s) + ' ساعت</b> باشد.' +
        (d < 7 ? ' (هدف: ' + faNum(d) + ' روز در هفته)' : '') +
        (state.chartType === 'line' ? ' روی نقاط خط کلیک کن تا ثبت همان روز را ویرایش کنی.' : ' روی میله‌ها کلیک کن تا ثبت همان روز را ویرایش کنی.') + '</p>'
      : '<p class="rule-hint">' + (state.chartType === 'line' ? 'روی نقاط خط کلیک کن تا ثبت همان روز را ویرایش کنی.' : 'روی میله‌ها کلیک کن تا ثبت همان روز را ویرایش کنی.') + '</p>';
    html += '<section class="card" style="--task:' + t.color + '">' +
      '<div class="card-head"><span class="dot"></span><h3>' + esc(t.name) + '</h3>' + badgeHtml + '</div>' +
      verdictHtml +
      '<div class="stats">' +
      statBox('مجموع ساعت', fmtHours(a.total, s), 'ساعت') +
      statBox('میانگین روزانه', fmtHours(a.mean, s), 'ساعت') +
      statBox('انحراف معیار', fmtHours(a.sd, s), 'ساعت') +
      sdLimitStat +
      statBox('روزهای فعال', faNum(a.activeDays) + ' از ' + faNum(a.n), '') +
      targetStat +
      '</div>' + chart +
      ruleFooter +
      '</section>';
  }
  html += '</div>';
  return html;
}
