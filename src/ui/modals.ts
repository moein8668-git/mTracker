/* Modal layer — open/close, entry form, task form, settings. */
import type { Repo } from '../storage';
import { FA_DATE_FULL, appSettings, fmtHours, faNum, type AppSettings } from '../settings';
import { todayIso, isoToDate, isoOf, addDays, toJ, monthMeta, monthStartOf, prevMonthStart, nextMonthStart, jLabel } from '../jalali';
import { PALETTE, esc, normalizeDaysPerWeek } from '../utils';
import { WEEK_HEAD } from './wall';

export function openModal(html: string): void {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '<div class="overlay" data-action="overlay-close"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>';
}
export function closeModal(): void {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
}

/* ---------- entry modal ---------- */
export function openEntryModal(repo: Repo, opts: { taskId?: string | null; date?: string | null; entryId?: string | null } = {}): void {
  const tasks = repo.activeTasks();
  if (!tasks.length) return;
  let entry = opts.entryId ? repo.entryById(opts.entryId) : undefined;
  if (!entry && opts.taskId && opts.date) entry = repo.findEntry(opts.taskId, opts.date);
  const selTask = entry ? entry.taskId : (opts.taskId || tasks[0]!.id);
  const date = entry ? entry.date : (opts.date || todayIso());
  const selColor = (repo.task(selTask) || tasks[0]!).color;
  openModal('<form data-form="entry"' + (entry ? ' data-entry-id="' + entry.id + '"' : '') + '>' +
    '<div class="em-top"><h3>' + (entry ? 'ویرایش ثبت' : 'ثبت ساعت') + '</h3>' +
    (entry ? '<span class="badge warn">ویرایش</span>' : '') + '</div>' +
    '<label class="em-lbl">تسک</label>' +
    '<div class="em-select"><span class="em-dot" id="em-task-dot" style="background:' + selColor + '"></span>' +
    '<select name="task" class="em-ctl"' + (entry ? ' disabled' : '') + '>' +
    tasks.map(x => '<option value="' + x.id + '"' + (x.id === selTask ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('') +
    '</select></div>' +
    '<div class="em-row">' +
    '<div><label class="em-lbl">تاریخ</label>' +
    '<button type="button" class="em-ctl em-date" id="f-date-btn" data-action="ecal-toggle">' +
    '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="10"/><line x1="3" y1="10" x2="21" y2="10"/></svg>' +
    '<span>' + FA_DATE_FULL.format(isoToDate(date)) + '</span></button></div>' +
    '<div><label class="em-lbl">ساعت</label>' +
    '<input type="number" name="hours" id="f-hours" class="em-ctl em-num" step="any" min="0.05" max="24" placeholder="۰:۰۰" value="' + (entry ? entry.hours : '') + '" required autofocus></div>' +
    '</div>' +
    '<input type="hidden" name="date" value="' + date + '">' +
    '<div class="ecal" id="entry-cal" style="display:none">' +
    '<div class="ecal-head-row">' +
    '<button type="button" class="btn small ghost" data-action="ecal-prev">ماه قبل</button>' +
    '<div class="ecal-title" id="entry-cal-title"></div>' +
    '<button type="button" class="btn small ghost" data-action="ecal-next">ماه بعد</button>' +
    '</div>' +
    '<div class="ecal-grid" id="entry-cal-grid"></div>' +
    '</div>' +
    /* استپرهای زمانی سریع با چینش افقی لمسی */
    '<div class="time-stepper">' +
    '<button type="button" class="stepper-chip" data-action="eh-add" data-amount="0.25">+۱۵ د</button>' +
    '<button type="button" class="stepper-chip" data-action="eh-add" data-amount="0.5">+۳۰ د</button>' +
    '<button type="button" class="stepper-chip" data-action="eh-add" data-amount="1">+۱ س</button>' +
    '<button type="button" class="stepper-chip" data-action="eh-add" data-amount="2">+۲ س</button>' +
    '<button type="button" class="stepper-chip" data-action="eh-add" data-amount="-0.5">−۳۰ د</button>' +
    '</div>' +
    '<div class="em-hint" id="f-hours-hint"></div>' +
    '<label class="em-lbl">یادداشت (اختیاری)</label>' +
    '<input type="text" name="note" class="em-ctl" maxlength="200" placeholder="مثلا: تمرین عمیق، مطالعه مبحث" value="' + (entry ? esc(entry.note || '') : '') + '">' +
    '<div class="modal-actions">' +
    (entry ? '<button type="button" class="btn ghost" data-action="delete-entry" data-entry="' + entry.id + '">حذف</button>' : '') +
    '<button type="button" class="btn ghost" data-action="close-modal">انصراف</button>' +
    '<button type="submit" class="btn primary">ذخیره</button>' +
    '</div></form>');
}

/* ---------- compact Jalali calendar inside the entry modal ---------- */
export function toggleEntryCalendar(): void {
  const wrap = document.getElementById('entry-cal');
  if (!wrap) return;
  const show = wrap.style.display !== 'block';
  wrap.style.display = show ? 'block' : 'none';
  if (show) refreshEntryCalendar();
}

export function refreshEntryCalendar(dir?: number): void {
  const grid = document.getElementById('entry-cal-grid');
  const title = document.getElementById('entry-cal-title');
  const nextBtn = document.querySelector<HTMLButtonElement>('[data-action="ecal-next"]');
  const dateInput = document.querySelector<HTMLInputElement>('form[data-form="entry"] input[name="date"]');
  if (!grid || !title || !dateInput) return;
  let ms = monthStartOf(isoToDate(grid.dataset.view || dateInput.value || todayIso()));
  if (dir === 1) ms = nextMonthStart(ms);
  if (dir === -1) ms = prevMonthStart(ms);
  const cur = monthStartOf(new Date());
  if (ms > cur) ms = cur;
  grid.dataset.view = isoOf(ms);
  title.textContent = jLabel(ms);
  if (nextBtn) nextBtn.disabled = ms >= cur;
  const sel = dateInput.value;
  const meta = monthMeta(ms);
  const tIso = todayIso();
  const lead = (isoToDate(meta.startIso).getDay() - 6 + 7) % 7;
  let cells = '';
  for (let i = 0; i < lead; i++) cells += '<span class="ecal-cell blank"></span>';
  for (let d = isoToDate(meta.startIso); isoOf(d) <= meta.endIso; d = addDays(d, 1)) {
    const iso = isoOf(d);
    cells += '<button type="button" class="ecal-cell' + (iso === sel ? ' selected' : '') + (iso === tIso ? ' today' : '') + '" data-action="ecal-pick" data-date="' + iso + '"' + (iso > tIso ? ' disabled' : '') + '>' + faNum(toJ(d).jd) + '</button>';
  }
  grid.innerHTML = WEEK_HEAD.map(w => '<span class="ecal-head">' + w + '</span>').join('') + cells;
}

export function pickEntryDate(iso: string): void {
  const f = document.querySelector<HTMLFormElement>('form[data-form="entry"]');
  if (!f) return;
  const dateInput = f.querySelector<HTMLInputElement>('input[name="date"]');
  if (!dateInput) return;
  dateInput.value = iso;
  const btn = document.getElementById('f-date-btn');
  if (btn) btn.textContent = FA_DATE_FULL.format(isoToDate(iso));
  const wrap = document.getElementById('entry-cal');
  if (wrap) wrap.style.display = 'none';
}

/* ---------- task modal ---------- */
function dpwHint(v: number): string {
  if (v === 0) return 'بدون برنامه پایداری — در تب امروز نمایش داده نمی‌شود';
  if (v === 7) return 'هر روز هفته';
  return faNum(v) + ' روز در هفته';
}

function previewChip(target: number, dpw: number, s: AppSettings): string {
  const tgt = target > 0 ? 'هدف: ' + fmtHours(target, s) + ' ساعت در روز' : 'بدون هدف روزانه';
  const sch = dpw === 0 ? 'بدون پایداری' : dpw === 7 ? 'هر روز' : faNum(dpw) + ' روز/هفته';
  return tgt + ' • ' + sch;
}

export function openTaskModal(repo: Repo, taskId: string | null = null): void {
  const t = taskId ? repo.task(taskId) : undefined;
  const s = appSettings(repo.db);
  const isCustom = !!t && !PALETTE.includes(t.color);
  const used = new Set(repo.activeTasks().filter(x => !t || x.id !== t.id).map(x => x.color));
  const suggested = PALETTE.find(c => !used.has(c)) || PALETTE[0]!;
  const selColor = t ? t.color : suggested;
  const daysPerWeek = t ? normalizeDaysPerWeek(t.daysPerWeek) : 7;
  const targetVal = t && t.targetDailyHours > 0 ? String(t.targetDailyHours) : '';
  openModal('<form data-form="task" data-task-id="' + (taskId || '') + '">' +
    '<h3>' + (t ? 'ویرایش تسک' : 'تسک جدید') + '</h3>' +
    '<div class="task-preview" id="task-preview" style="--task:' + selColor + '">' +
    '<span class="dot"></span>' +
    '<span class="tp-name" id="tp-name">' + (t ? esc(t.name) : 'نام تسک') + '</span>' +
    '<span class="tp-chip" id="tp-chip">' + previewChip(t ? t.targetDailyHours : 0, daysPerWeek, s) + '</span></div>' +
    '<label>نام تسک<input type="text" name="name" id="f-task-name" required maxlength="60" placeholder="مثلا: زبان انگلیسی" value="' + (t ? esc(t.name) : '') + '"></label>' +
    '<div class="set-label" style="margin:2px 0 8px">رنگ تسک</div>' +
    '<div class="swatches">' +
    PALETTE.map(c => '<label class="swatch" style="--c:' + c + '" title=""><input type="radio" name="color" value="' + c + '"' +
      ((t ? !isCustom && t.color === c : !isCustom && c === suggested) ? ' checked' : '') + '></label>').join('') +
    '<label class="swatch custom" title="رنگ دلخواه"' + (isCustom ? ' style="background:' + t!.color + '"' : '') + '>' +
    '<input type="color" name="custom-color" id="f-custom-color" value="' + (isCustom ? t!.color : '#4f46e5') + '"' + (isCustom ? ' data-chosen="1"' : '') + '></label>' +
    '</div>' +
    '<div class="set-label" style="margin:6px 0 8px">اهداف</div>' +
    '<div class="task-goals">' +
    '<label style="margin-bottom:0">هدف روزانه (ساعت)<input type="number" name="target" id="f-task-target" step="any" min="0" max="24" placeholder="مثلا ۲" value="' + targetVal + '"></label>' +
    '<div class="dpw-block">' +
    '<div class="dpw-label">روزهای هدف در هفته</div>' +
    '<div class="dpw-seg">' +
    [0, 1, 2, 3, 4, 5, 6, 7].map(v => '<button type="button" data-action="set-dpw" data-v="' + v + '"' + (v === daysPerWeek ? ' class="active"' : '') + '>' + faNum(v) + '</button>').join('') +
    '</div>' +
    '<div class="jalali-hint" id="dpw-hint" style="margin:6px 0 0">' + dpwHint(daysPerWeek) + '</div>' +
    '<input type="hidden" name="daysPerWeek" value="' + daysPerWeek + '">' +
    '</div></div>' +
    '<div class="modal-actions">' +
    '<button type="button" class="btn ghost" data-action="close-modal">انصراف</button>' +
    '<button type="submit" class="btn primary">' + (t ? 'ذخیره' : 'ساخت تسک') + '</button>' +
    '</div></form>');
  const nameInput = document.querySelector('form[data-form="task"] input[name="name"]');
  if (nameInput instanceof HTMLInputElement) nameInput.focus();
}

/* ---------- settings ---------- */
export function openSettingsModal(repo: Repo): void {
  const s = appSettings(repo.db);
  openModal('<div class="settings">' +
    '<h3>تنظیمات</h3>' +
    '<div class="set-row"><div class="set-label">جهت نمودارها <span class="set-sub">— پیش‌فرض: چپ‌به‌راست</span></div>' +
    '<div class="seg">' +
    '<button data-action="set-setting" data-key="chartDir" data-val="ltr"' + (s.chartDir === 'ltr' ? ' class="active"' : '') + '>چپ‌به‌راست</button>' +
    '<button data-action="set-setting" data-key="chartDir" data-val="rtl"' + (s.chartDir === 'rtl' ? ' class="active"' : '') + '>راست‌به‌چپ</button>' +
    '</div></div>' +
    '<div class="set-row"><div class="set-label">قالب نمایش ساعت <span class="set-sub">— پیش‌فرض: ساعت:دقیقه</span></div>' +
    '<div class="seg">' +
    '<button data-action="set-setting" data-key="timeFormat" data-val="hm"' + (s.timeFormat === 'hm' ? ' class="active"' : '') + '>ساعت:دقیقه</button>' +
    '<button data-action="set-setting" data-key="timeFormat" data-val="decimal"' + (s.timeFormat === 'decimal' ? ' class="active"' : '') + '>اعشاری</button>' +
    '</div></div>' +
    '<div class="modal-actions"><button type="button" class="btn primary" data-action="close-modal">بستن</button></div>' +
    '</div>');
}

/* ---------- pomodorus ---------- */
export function openPomodorusModal(repo: Repo): void {
  openModal('<form data-form="pomodorus">' +
    '<h3>ورود از پومودوروس</h3>' +
    '<p class="rule-hint" style="margin:-10px 0 14px">ساعت‌های فوکوس ۹۰ روز اخیرت را از اپ پومودوروس به mTracker بیاور. ثبت‌های دستی تو هرگز دست‌نخورده می‌مانند.</p>' +
    '<label>نام کاربری پومودوروس<input type="text" id="pomo-user" maxlength="40" autocomplete="off" dir="ltr" placeholder="مثلا moein8668"></label>' +
    '<div class="pomo-auto">' +
    '<div class="pa-head"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>دریافت خودکار<span class="set-sub">— فقط یک کلیک؛ داده‌ها تا ۱۵ دقیقه به‌روز</span></div>' +
    '<button type="button" class="btn primary" data-action="pomo-autofetch" style="width:100%">دریافت خودکار</button>' +
    '<div class="pomo-status" id="pomo-fetch-status"></div>' +
    '</div>' +
    '<details class="pomo-manual">' +
    '<summary>روش دستی (بدون پراکسی)</summary>' +
    '<ol class="pomo-guide">' +
    '<li>روی لینک داده‌ات بزن (از نام کاربری بالا ساخته می‌شود)؛ صفحه‌ای پر از متن باز می‌شود.' +
    '<span class="jalali-hint" id="pomo-link-hint" style="display:block;margin:4px 0 0"></span></li>' +
    '<li>همهٔ متن آن صفحه را کپی کن: <b>Ctrl+A</b> بعد <b>Ctrl+C</b> (در موبایل: لمس طولانی → انتخاب همه → کپی).</li>' +
    '<li>برگرد همین‌جا، متن را داخل کادر پایین بچسبان (<b>Ctrl+V</b>) و «ورود داده» را بزن.</li>' +
    '</ol>' +
    '<label>دادهٔ کپی‌شده (JSON)<textarea id="pomo-json" rows="6" dir="ltr" spellcheck="false" placeholder=\'{"handle":"…","days":[…]}\'></textarea></label>' +
    '</details>' +
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
  if (!/^[A-Za-z0-9_.-]+$/.test(name)) { hint.innerHTML = '<span style="color:var(--bad)">نام کاربری فقط حروف و اعداد انگلیسی، نقطه، خط تیره.</span>'; return; }
  const url = 'https://pomodorus.yazdan.me/api/profile/' + encodeURIComponent(name) + '?days=90';
  hint.innerHTML = 'لینک داده‌ات: <a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" dir="ltr">' + esc(url) + '</a>';
}