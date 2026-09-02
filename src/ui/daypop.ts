/* Day popup (hover/touch on sparkline points). */

import { FA_DATE_FULL } from '../settings';
import { isoToDate } from '../jalali';
import { fmtHours, appSettings } from '../settings';
import { esc } from '../utils';
import type { Repo } from '../storage';

let popEl: HTMLElement | null = null;

export function showDayPop(repo: Repo, date: string, cx: number, cy: number): void {
  if (!popEl) {
    popEl = document.createElement('div');
    popEl.id = 'day-pop';
    document.body.appendChild(popEl);
  }
  const s = appSettings(repo.db);
  const rows: string[] = [];
  let total = 0;
  for (const t of repo.activeTasks()) {
    const en = repo.findEntry(t.id, date);
    if (en && en.hours > 0) {
      rows.push('<div class="dp-row"><span><i class="dot" style="--task:' + t.color + '"></i>' + esc(t.name) + '</span><b>' + fmtHours(en.hours, s) + '</b></div>');
      total += en.hours;
    }
  }
  popEl.innerHTML = '<div class="dp-title">' + FA_DATE_FULL.format(isoToDate(date)) + '</div>' +
    (rows.length
      ? rows.join('') + '<div class="dp-row" style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px"><span>مجموع</span><b>' + fmtHours(total, s) + '</b></div>'
      : '<div class="dp-row">ثبتی در این روز نیست</div>');
  popEl.style.display = 'block';
  popEl.dataset.day = date;
  const w = popEl.offsetWidth, ph = popEl.offsetHeight;
  let x = cx - w / 2, y = cy - ph - 12;
  if (y < 8) y = cy + 14;
  if (x < 8) x = 8;
  if (typeof window !== 'undefined' && window.innerWidth && x + w > window.innerWidth - 8) x = window.innerWidth - w - 8;
  popEl.style.left = x + 'px';
  popEl.style.top = y + 'px';
}

export function hideDayPop(): void {
  if (popEl) popEl.style.display = 'none';
}
