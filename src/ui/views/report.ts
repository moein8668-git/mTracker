/* view: گزارش (ماه شمسی / N روز اخیر / بازه دلخواه) */
import type { Repo } from '../../storage';
import { appSettings, fmtHours, faNum } from '../../settings';
import { monthStartOf, isoOf, todayIso, isoToDate, jLabel, jShortLabel } from '../../jalali';
import { taskPeriodAnalysis, overallPeriodAnalysis, scheduleSummary } from '../../analysis';
import { resolvePeriod, type ResolvedPeriod } from '../../period';
import type { AnalyzeResult, Task } from '../../types';
import { esc, normalizeDaysPerWeek } from '../../utils';
import { state } from '../state';
import { badge, VERDICT_NOTE } from '../bits';
import { chartHTML } from '../charts/bars';
import { lineChartHTML, seriesForTask, type LineSeries } from '../charts/line';
import { wallHTML } from '../wall';

function kindSeg(): string {
  const k = state.period.kind;
  const b = (id: string, label: string) =>
    '<button data-action="set-period" data-kind="' + id + '" class="seg-pill' + (k === id ? ' active' : '') + '">' + label + '</button>';
  return '<div class="seg-pills rb-kind-pills">' + 
    b('month', 'ماه شمسی') + b('rolling', 'روزهای اخیر') + b('custom', 'بازه دلخواه') + 
  '</div>';
}

function chartTypeSeg(): string {
  const isLine = state.chartType === 'line';
  const b = (chart: string, label: string, active: boolean) =>
    '<button data-action="set-chart" data-chart="' + chart + '" class="seg-pill' + (active ? ' active' : '') + '">' + label + '</button>';
  return '<div class="seg-pills rb-chart-pills">' + 
    b('bar', 'میله‌ای', !isLine) + b('line', 'خطی', isLine) + 
  '</div>';
}

function rcalMarkup(): string {
  return '<div class="rcal" id="report-cal" style="display:none; border-radius:4px;">' +
    '<div class="ecal-head-row">' +
    '<button type="button" class="btn small ghost" data-action="rcal-prev" style="border-radius:4px;">ماه قبل</button>' +
    '<div class="ecal-title" id="report-cal-title"></div>' +
    '<button type="button" class="btn small ghost" data-action="rcal-next" style="border-radius:4px;">ماه بعد</button>' +
    '</div>' +
    '<div class="ecal-grid" id="report-cal-grid"></div>' +
    '<div class="rcal-hint" id="report-cal-hint"></div>' +
    '</div>';
}

function periodNav(p: ResolvedPeriod): string {
  const kind = state.period.kind;
  if (kind === 'month') {
    return '<div class="rb-nav rb-month-nav">' +
      '<button class="btn small ghost" data-action="month-prev">‹ ماه قبل</button>' +
      '<button class="btn small ghost" data-action="month-next"' + (p.isCurrent ? ' disabled' : '') + '>ماه بعد ›</button>' +
      '</div>';
  }
  if (kind === 'rolling') {
    return '<div class="rb-nav seg-pills rb-rolling-pills">' + 
      [7, 14, 30, 90].map(d => {
        const isActive = state.period.rollingDays === d;
        return '<button data-action="set-rolling" data-days="' + d + '" class="seg-pill small' + (isActive ? ' active' : '') + '">' + faNum(d) + ' روز</button>';
      }).join('') + 
    '</div>';
  }

  const fromIso = state.period.from || isoOf(new Date(Date.now() - 13 * 864e5));
  const toIso = state.period.to || todayIso();

  return '<div class="rb-nav range-wrap">' +
    '<button type="button" class="date-btn small-date" data-action="rcal-toggle" data-field="from">' +
      '<span class="date-lbl">از</span>' +
      '<b class="date-val">' + jShortLabel(fromIso) + '</b>' +
    '</button>' +
    '<span class="range-sep">تا</span>' +
    '<button type="button" class="date-btn small-date" data-action="rcal-toggle" data-field="to">' +
      '<b class="date-val">' + jShortLabel(toIso) + '</b>' +
    '</button>' +
    rcalMarkup() +
  '</div>';
}

function statCards(items: { label: string; value: string; hint?: string }[]): string {
  return '<div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin:14px 0 16px 0;">' +
    items.map(it =>
      '<div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.06); padding:8px 12px; border-radius:4px; display:flex; flex-direction:column; gap:4px;">' +
        '<span style="font-size:0.75rem; opacity:0.65;">' + it.label + '</span>' +
        '<div style="display:flex; align-items:baseline; gap:6px;">' +
          '<span style="font-size:1.1rem; font-weight:700; line-height:1.2;">' + it.value + '</span>' +
          (it.hint ? '<span style="font-size:0.7rem; opacity:0.5; font-weight:normal;">' + it.hint + '</span>' : '') +
        '</div>' +
      '</div>'
    ).join('') +
  '</div>';
}

function renderTaskBlock(t: Task, repo: Repo, p: ResolvedPeriod, s: ReturnType<typeof appSettings>): string {
  const a: AnalyzeResult = taskPeriodAnalysis(repo, t, p.startIso, p.endIso);
  const isTracked = normalizeDaysPerWeek(t.daysPerWeek) > 0;
  const badgeHtml = isTracked ? badge(a.status) : '<span class="badge mutedb" style="border-radius:3px;">بدون پایداری</span>';

  const chart = state.chartType === 'line'
    ? lineChartHTML(a.days, [{ name: t.name, color: t.color, values: a.days.map(x => x.hours), taskId: t.id }],
        { mean: a.mean, target: t.targetDailyHours }, s)
    : chartHTML(a.days, { mean: a.mean, target: t.targetDailyHours, taskId: t.id }, s);

  const stats = [
    { label: 'مجموع کارکرد', value: fmtHours(a.total, s) },
    { label: 'میانگین روزانه', value: fmtHours(a.mean, s) },
    { 
      label: 'انحراف معیار', 
      value: fmtHours(a.sd, s), 
      hint: isTracked ? '(مجاز: ' + fmtHours(a.sdLimit, s) + ')' : undefined 
    },
    { label: 'روزهای فعال', value: faNum(a.activeDays) + ' از ' + faNum(a.n) }
  ];

  const targetRow = t.targetDailyHours > 0
    ? '<div style="margin:12px 0 16px 0; padding:10px 14px; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:4px;">' +
        '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">' +
          '<span style="font-size:0.8rem; font-weight:600;">پیشرفت هدف</span>' +
          '<span style="font-size:0.82rem; font-weight:700;">' + faNum(Math.round(a.targetPct || 0)) + '٪</span>' +
        '</div>' +
        '<div class="progress" style="height:5px; margin:0; border-radius:2px;"><i style="width:' + Math.min(100, Math.max(0, a.targetPct || 0)).toFixed(0) + '%; border-radius:2px;"></i></div>' +
      '</div>'
    : '';

  const statusMsg = isTracked ? VERDICT_NOTE[a.status] : 'این تسک بدون برنامهٔ پایداری است و در تب «امروز» نمایش داده نمی‌شود.';
  const clickHint = state.chartType === 'line' ? 'برای دیدن روز روی نقاط کلیک کنید' : 'برای دیدن روز روی میله‌ها کلیک کنید';

  return '<section class="card sheet-block" style="--task:' + esc(t.color) + '; padding:22px; margin-bottom:20px; border-radius:4px; border-top:3px solid var(--task);">' +
    '<div class="tr-head" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:6px;">' +
      '<div class="tr-title" style="display:flex; align-items:center; gap:8px;">' +
        '<span class="dot" style="background:var(--task); width:8px; height:8px; border-radius:2px; display:inline-block;"></span>' +
        '<h3 style="margin:0; font-size:1.15rem;">' + esc(t.name) + '</h3>' + 
        badgeHtml + 
      '</div>' +
      '<span class="tr-sched" style="font-size:0.8rem; opacity:0.75;">' + scheduleSummary(t) + (t.targetDailyHours > 0 ? ' • هدف ' + fmtHours(t.targetDailyHours, s) : '') + '</span>' +
    '</div>' +
    statCards(stats) +
    targetRow +
    '<div class="tr-chart" style="margin:16px 0 12px 0;">' + chart + '</div>' +
    '<div class="tr-foot" style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; opacity:0.8; margin-top:14px; padding-top:10px; border-top:1px dashed rgba(255,255,255,0.08);">' +
      '<span>' + statusMsg + '</span>' +
      '<span class="tr-hint" style="opacity:0.6;">' + clickHint + '</span>' +
    '</div>' +
    '</section>';
}

export function viewReport(repo: Repo): string {
  const s = appSettings(repo.db);
  const periodState = { ...state.period, monthStart: state.period.monthStart || isoOf(monthStartOf(new Date())) };
  const p = resolvePeriod(repo, periodState);
  const tasks = repo.activeTasks();

  const htmlHeader = '<section class="card report-bar">' +
    '<div class="rb-top-row">' +
      '<div class="rb-title-group">' +
        '<h2 class="rb-title">' + p.title + '</h2>' +
        (p.sub ? '<span class="rb-sub">• ' + p.sub + '</span>' : '') +
      '</div>' +
      '<div class="rb-nav-wrap">' + periodNav(p) + '</div>' +
    '</div>' +
    '<div class="rb-controls-row">' +
      kindSeg() +
      chartTypeSeg() +
    '</div>' +
    '</section>';

  if (!tasks.length) {
    return htmlHeader + '<section class="card empty-state" style="padding:56px 24px; text-align:center; border-radius:4px;">' +
      '<h2 style="margin-bottom:8px;">تسکی وجود ندارد</h2>' +
      '<p style="margin-bottom:22px; opacity:0.75;">برای دیدن تحلیل، اول یک تسک بساز و روزها را ثبت کن.</p>' +
      '<button class="btn primary" data-action="open-task" style="padding:8px 22px; border-radius:4px;">ساخت تسک</button>' +
    '</section>';
  }

  const ov = overallPeriodAnalysis(repo, p.startIso, p.endIso);
  const ovSeries: LineSeries[] = [
    { name: 'مجموع', color: 'var(--ink)', total: true, values: ov.days.map(d => d.hours) },
    ...tasks.map(t => ({ name: t.name, color: t.color, values: seriesForTask(repo, t, ov.days), taskId: t.id }))
  ];
  const ovChart = state.chartType === 'line'
    ? lineChartHTML(ov.days, ovSeries, { mean: ov.mean, clickable: false, hoverDay: true }, s)
    : chartHTML(ov.days, { mean: ov.mean }, s);

  const wallMetaText = p.meta ? jLabel(isoToDate(p.meta.startIso)) : 'نمای کل';

  const overallStats = [
    { label: 'مجموع ساعت کل', value: fmtHours(ov.total, s) },
    { label: 'میانگین روزانه', value: fmtHours(ov.mean, s) },
    { label: 'انحراف معیار', value: fmtHours(ov.sd, s) },
    { label: 'روزهای فعال', value: faNum(ov.activeDays) + ' از ' + faNum(ov.n) }
  ];

  let html = htmlHeader +
    '<div class="stack" style="display:flex; flex-direction:column; gap:22px;">' +
    '<section class="card wall-card" style="padding:22px; border-radius:4px;">' +
      '<div class="card-head" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<h3 style="margin:0; font-size:1.15rem;">دیوار ماه</h3>' +
        '<span class="mini-chip ' + (p.meta ? 'none' : 'hit') + '" style="border-radius:3px;">' + wallMetaText + '</span>' +
      '</div>' +
      '<p class="rule-hint" style="margin:0 0 16px 0; font-size:0.8rem; opacity:0.7;">هر خانه یک روز؛ پررنگ‌تر یعنی ساعت بیشتر. نگه‌دار برای جزئیات، بزن برای دیدن روز.</p>' +
      wallHTML(ov.days, s, todayIso(), p.meta?.endIso) + 
    '</section>' +

    '<section class="card sheet-block first" style="padding:24px; border-radius:4px;">' +
      '<div class="card-head" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">' +
        '<h3 style="margin:0; font-size:1.2rem;">نمای کلی</h3>' + 
        badge(ov.status) + 
      '</div>' +
      statCards(overallStats) +
      '<div class="tr-chart" style="margin:18px 0 14px 0;">' + ovChart + '</div>' +
      '\u003cdiv class="tr-foot" style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding-top:12px; border-top:1px dashed rgba(255,255,255,0.08); font-size:0.82rem; opacity:0.8;"\u003e' +
        '\u003cspan\u003e' + VERDICT_NOTE[ov.status] + '\u003c/span\u003e' +
        (state.chartType === 'line' ? '\u003cspan class="tr-hint" style="opacity:0.6;"\u003eبرای رفتن به روز روی نقاط کلیک کنید\u003c/span\u003e' : '') +
      '\u003c/div\u003e' +
    '</section>';

  for (const t of tasks) {
    html += renderTaskBlock(t, repo, p, s);
  }
  
  html += '</div>';
  return html;
}