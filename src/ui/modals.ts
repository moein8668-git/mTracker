/* Modal layer — open/close, entry form, task form, settings. */

import type { Repo } from '../storage';
import { getProxyBase } from '../pomodorus';
import { appSettings, FA_DATE_FULL, fmtHours } from '../settings';
import { todayIso, isoToDate } from '../jalali';
import { PALETTE, esc, toNumber } from '../utils';
import { $ } from '../utils';

export function openModal(html: string): void {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '<div class="overlay" data-action="overlay-close"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
}

export function closeModal(): void {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

function updateJHint(): void {
  const input = $('#f-date');
  const el = $('#f-jhint');
  const v = input instanceof HTMLInputElement ? input.value : '';
  if (el) el.textContent = v ? 'تاریخ شمسی: ' + FA_DATE_FULL.format(isoToDate(v)) : '';
}

export function openEntryModal(repo: Repo, opts: { taskId?: string | null; date?: string | null; entryId?: string | null } = {}): void {
  const tasks = repo.activeTasks();
  if (!tasks.length) return;
  let entry = opts.entryId ? repo.entryById(opts.entryId) : undefined;
  if (!entry && opts.taskId && opts.date) entry = repo.findEntry(opts.taskId, opts.date);
  const selTask = entry ? entry.taskId : (opts.taskId || tasks[0]!.id);
  const date = entry ? entry.date : (opts.date || todayIso());
  openModal('<form data-form="entry"' + (entry ? ' data-entry-id="' + entry.id + '"' : '') + '>' +
    '<h3>' + (entry ? 'ویرایش ثبت' : 'ثبت ساعت') + '</h3>' +
    '<label>تسک<select name="task"' + (entry ? ' disabled' : '') + '>' +
    tasks.map(x => '<option value="' + x.id + '"' + (x.id === selTask ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') +
    '</select></label>' +
    '<label>تاریخ<input type="date" name="date" id="f-date" value="' + date + '" max="' + todayIso() + '" required></label>' +
    '<div class="jalali-hint" id="f-jhint"></div>' +
    '<label>ساعت کارکرد<input type="number" name="hours" id="f-hours" step="any" min="0.05" max="24" placeholder="مثلا ۱.۵" value="' + (entry ? entry.hours : '') + '" required autofocus></label>' +
    '<div class="jalali-hint" id="f-hours-hint"></div>' +
    '<label>یادداشت (اختیاری)<input type="text" name="note" maxlength="200" value="' + (entry ? esc(entry.note || '') : '') + '"></label>' +
    '<div class="modal-actions">' +
    (entry ? '<button type="button" class="btn ghost" data-action="delete-entry" data-entry="' + entry.id + '">حذف</button>' : '') +
    '<button type="button" class="btn ghost" data-action="close-modal">انصراف</button>' +
    '<button type="submit" class="btn primary">ذخیره</button>' +
    '</div></form>');
  updateJHint();
  const dateInput = $('#f-date');
  if (dateInput) dateInput.addEventListener('change', updateJHint);
}

export function openTaskModal(repo: Repo, taskId: string | null = null): void {
  const t = taskId ? repo.task(taskId) : undefined;
  const isCustom = !!t && !PALETTE.includes(t.color);
  const used = new Set(repo.activeTasks().filter(x => !t || x.id !== t.id).map(x => x.color));
  const suggested = PALETTE.find(c => !used.has(c)) || PALETTE[0]!;
  openModal('<form data-form="task" data-task-id="' + (taskId || '') + '">' +
    '<h3>' + (t ? 'ویرایش تسک' : 'تسک جدید') + '</h3>' +
    '<label>نام تسک<input type="text" name="name" required maxlength="60" placeholder="مثلا: زبان انگلیسی" value="' + (t ? esc(t.name) : '') + '"></label>' +
    '<label>هدف روزانه به ساعت (اختیاری)<input type="number" name="target" step="any" min="0" max="24" placeholder="مثلا ۲" value="' + (t && t.targetDailyHours ? t.targetDailyHours : '') + '"></label>' +
    '<div class="swatches">' +
    PALETTE.map(c => '<label class="swatch" style="--c:' + c + '" title=""><input type="radio" name="color" value="' + c + '"' +
      ((t ? !isCustom && t.color === c : !isCustom && c === suggested) ? ' checked' : '') + '></label>').join('') +
    '<label class="swatch custom" title="رنگ دلخواه"' + (isCustom ? ' style="background:' + t!.color + '"' : '') + '>' +
    '<input type="color" name="custom-color" id="f-custom-color" value="' + (isCustom ? t!.color : '#4f46e5') + '"' + (isCustom ? ' data-chosen="1"' : '') + '></label>' +
    '</div>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn ghost" data-action="close-modal">انصراف</button>' +
    '<button type="submit" class="btn primary">' + (t ? 'ذخیره' : 'ساخت تسک') + '</button>' +
    '</div></form>');
  const nameInput = document.querySelector('form[data-form="task"] input[name="name"]');
  if (nameInput instanceof HTMLInputElement) nameInput.focus();
}

export function openSettingsModal(repo: Repo): void {
  const s = appSettings(repo.db);
  const seg = (key: 'chartDir' | 'timeFormat', val: string, label: string) =>
    '<button data-action="set-setting" data-key="' + key + '" data-value="' + val + '"' + (s[key] === val ? ' class="active"' : '') + '>' + label + '</button>';
  openModal('<div>' +
    '<h3>تنظیمات</h3>' +
    '<div class="set-row"><div class="set-label">جهت نمودارها<div class="set-sub">شروع محور زمان در نمودارها (پیش‌فرض: چپ به راست)</div></div>' +
    '<div class="seg">' + seg('chartDir', 'ltr', 'چپ به راست') + seg('chartDir', 'rtl', 'راست به چپ') + '</div></div>' +
    '<div class="set-row"><div class="set-label">نمایش ساعت<div class="set-sub">شکل نمایش مقادیر ساعت (پیش‌فرض: ساعت:دقیقه)</div></div>' +
    '<div class="seg">' + seg('timeFormat', 'hm', 'ساعت:دقیقه') + seg('timeFormat', 'decimal', 'اعشاری') + '</div></div>' +
    '<p class="rule-hint">ورودی و خروجی CSV همیشه اعشاری می‌ماند تا با Excel و اپ‌های دیگر سازگار بماند.</p>' +
    '<div class="modal-actions"><button class="btn ghost" data-action="close-modal">بستن</button></div>' +
    '</div>');
}

export function openWelcomeModal(loadSample: () => void, openTask: () => void): void {
  openModal('<div class="welcome">' +
    '<h3>به mTracker خوش آمدی</h3>' +
    '<p style="font-size:.9rem;color:var(--muted)">این برنامه بر پایه روش «پایداری» کار می‌کند: مهم نیست یک روز چقدر کار کنی، مهم این است که هر روز کمی کار کنی.</p>' +
    '<ol>' +
    '<li>یک تسک بساز و هدف روزانه‌اش را مشخص کن</li>' +
    '<li>هر روز ساعت کارکردت را ثبت کن</li>' +
    '<li>در گزارش ماهانه چک کن: انحراف معیارت باید کمتر از نصف میانگینت باشد</li>' +
    '</ol>' +
    '<div class="modal-actions">' +
    '<button class="btn ghost" data-action="load-sample">دیدن با داده نمونه</button>' +
    '<button class="btn primary" data-action="open-task">شروع با اولین تسک</button>' +
    '</div></div>');
  void fmtHours; void loadSample; void openTask; /* handled via delegated actions */
}

export function openPomodorusModal(repo: Repo): void {
  const proxyBase = getProxyBase(repo);
  openModal('<form data-form="pomodorus">' +
    '<h3>ورود از پومودوروس</h3>' +
    '<div class="pomo-auto">' +
    '<div class="set-label">دریافت خودکار <span class="set-sub">— با ورکر پراکسی شخصی‌ات؛ آدرس یک بار ذخیره می‌شود</span></div>' +
    '<label>آدرس ورکر پراکسی<input type="url" id="pomo-proxy" dir="ltr" placeholder="https://mtracker-pomo-proxy.yourname.workers.dev" value="' + esc(proxyBase || '') + '"></label>' +
    '<div class="btnrow" style="align-items:center">' +
    '<label style="margin:0">بازه (روز)<input type="number" id="pomo-days" min="30" max="90" step="30" value="90" style="width:100px"></label>' +
    '<button type="button" class="btn primary" data-action="pomo-autofetch">دریافت خودکار</button>' +
    '</div>' +
    '<div class="jalali-hint" id="pomo-fetch-status"></div>' +
    '</div>' +
    '<div class="rule-hint" style="margin:12px 0 8px;text-align:center">— یا روش دستی (بدون پراکسی) —</div>' +
    '<ol class="pomo-guide">' +
    '<li>نام کاربری‌ات در پومودوروس را بنویس (همان که با آن وارد اپ می‌شوی).</li>' +
    '<li>روی لینکی که ساخته می‌شود بزن؛ صفحه‌ای پر از متن باز می‌شود.</li>' +
    '<li>همهٔ متن آن صفحه را کپی کن: <b>Ctrl+A</b> بعد <b>Ctrl+C</b> (در موبایل: لمس طولانی → انتخاب همه → کپی).</li>' +
    '<li>برگرد همین‌جا، متن را توی کادر پایین بچسبان (<b>Ctrl+V</b>) و «ورود» را بزن.</li>' +
    '</ol>' +
    '<label>نام کاربری پومودوروس<input type="text" id="pomo-user" maxlength="40" autocomplete="off" dir="ltr" placeholder="مثلا moein8668"></label>' +
    '<div class="jalali-hint" id="pomo-link-hint"></div>' +
    '<label>دادهٔ کپی‌شده (JSON)<textarea id="pomo-json" rows="7" dir="ltr" spellcheck="false" placeholder=\'{"handle":"…","days":[…]}\'></textarea></label>' +
    '<p class="rule-hint">تسک‌ها با نام خودشان ساخته می‌شوند و ساعت هر روز ثبت می‌شود. روزهایی که خودت قبلاً دستی ثبت کرده‌ای دست‌نخورده می‌مانند. بعداً می‌توانی برای هر تسک، از بخش «تسک‌ها» هدف روزانه و رنگ تعیین کنی. ۹۰ روز آخر وارد می‌شود.</p>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn ghost" data-action="close-modal">انصراف</button>' +
    '<button type="submit" class="btn primary">ورود داده</button>' +
    '</div></form>');
  const userInput = document.getElementById('pomo-user');
  if (userInput instanceof HTMLInputElement) userInput.focus();
}

export function updatePomodorusLink(): void {
  const hint = document.getElementById('pomo-link-hint');
  const input = document.getElementById('pomo-user');
  if (!hint || !(input instanceof HTMLInputElement)) return;
  const name = input.value.trim();
  if (!name) { hint.innerHTML = ''; return; }
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) { hint.innerHTML = '<span style="color:var(--warn)">نام کاربری فقط حروف و اعداد انگلیسی، نقطه، خط تیره.</span>'; return; }
  const url = 'https://pomodorus.yazdan.me/api/profile/' + encodeURIComponent(name) + '?days=90';
  hint.innerHTML = 'لینک داده‌ات: <a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" dir="ltr">' + esc(url) + '</a>';
}
