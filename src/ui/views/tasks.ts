/* view: تسک‌ها */

import type { Repo } from '../../storage';
import { appSettings, fmtHours, FA_DATE_FULL, faNum } from '../../settings';
import { isoToDate, localDateOf } from '../../jalali';
import { scheduleSummary } from '../../analysis';
import { esc } from '../../utils';

export function viewTasks(repo: Repo): string {
  const s = appSettings(repo.db);
  const tasks = repo.activeTasks();
  let html = '<section class="hero"><div><div class="hero-date">تسک‌ها</div>' +
    '<div class="hero-sub">' + faNum(tasks.length) + ' تسک فعال</div></div>' +
    '<button class="btn primary" data-action="open-task">تسک جدید</button></section>';
  if (!tasks.length) {
    return html + '<section class="card empty-state"><h2>هنوز تسکی نساخته‌ای</h2>' +
      '<p>هر تسک یک کار تخصصی است که می‌خواهی هر روز به آن وقت بدهی؛ مثلا زبان، برنامه‌نویسی یا ورزش.</p>' +
      '<button class="btn primary" data-action="open-task">ساخت اولین تسک</button></section>';
  }
  html += '<section class="card">' + tasks.map(t => {
    const cnt = repo.entriesForTask(t.id).length;
    return '<div class="task-row">' +
      '<span class="dot" style="--task:' + t.color + '"></span>' +
      '<div><div class="t-name">' + esc(t.name) + '</div>' +
      '<div class="t-meta">' +
      (t.targetDailyHours > 0 ? 'هدف روزانه: ' + fmtHours(t.targetDailyHours, s) + ' ساعت' : 'بدون هدف') +
      ' | ' + scheduleSummary(t) +
      ' | ' + faNum(cnt) + ' ثبت | ساخت: ' + FA_DATE_FULL.format(isoToDate(localDateOf(t.createdAt))) +
      '</div></div>' +
      '<div class="t-actions">' +
      '<button class="btn small" data-action="open-entry" data-task="' + t.id + '">ثبت ساعت</button>' +
      '<button class="btn small ghost" data-action="open-task" data-task="' + t.id + '">ویرایش</button>' +
      '<button class="btn small ghost" data-action="delete-task" data-task="' + t.id + '">حذف</button>' +
      '</div></div>';
  }).join('') + '</section>';
  return html;
}
