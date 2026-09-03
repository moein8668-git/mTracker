/* Layer 5 — delegated events. Wires the whole UI to Repo. */

import { appSettings, fmtHours } from '../settings';
import { todayIso, isoOf, isoToDate, addDays, monthStartOf, prevMonthStart, nextMonthStart } from '../jalali';
import { state } from './state';
import { toast } from './bits';
import { Repo } from '../storage';
import { hideDayPop, showDayPop } from './daypop';
import { closeModal, openEntryModal, openTaskModal, openSettingsModal, openPomodorusModal, updatePomodorusLink } from './modals';
import { exportCsv, exportJson, importCsvRows, validateBackup } from '../transfer';
import { render } from './render';
import { clampHours, toNumber } from '../utils';
import { DEFAULT_POMO_PROXY, fetchViaProxy, importPomodorusProfile, normalizePomodorusProfile, setProxyBase } from '../pomodorus';

function armButton(btn: HTMLElement, armedLabel: string): void {
  btn.dataset.armed = '1';
  btn.dataset.orig = btn.textContent || '';
  btn.textContent = armedLabel;
  btn.classList.add('danger');
  setTimeout(() => {
    if (!document.body.contains(btn)) return;
    btn.dataset.armed = '0';
    btn.classList.remove('danger');
  }, 3500);
}

export function loadSample(repo: Repo): void {
  const start = addDays(new Date(), -34);
  const startIso = isoOf(start);
  const t1 = repo.createTask({ name: 'زبان انگلیسی', targetDailyHours: 2, color: '#4f46e5' });
  const t2 = repo.createTask({ name: 'برنامه‌نویسی', targetDailyHours: 3, color: '#0e9384' });
  const t3 = repo.createTask({ name: 'ورزش', targetDailyHours: 1, color: '#175cd3' });
  for (const t of [t1, t2, t3]) t.createdAt = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12).toISOString();
  let seed = 42;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const end = new Date();
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    const iso = isoOf(d);
    if (rnd() > 0.12) repo.upsertEntry({ taskId: t1.id, date: iso, hours: clampHours(2 + (rnd() - 0.5) * 0.8) });
    if (rnd() > 0.55) repo.upsertEntry({ taskId: t2.id, date: iso, hours: clampHours(4.5 + rnd() * 2.5) });
    if (rnd() > 0.2) repo.upsertEntry({ taskId: t3.id, date: iso, hours: clampHours(0.9 + (rnd() - 0.5) * 0.3) });
  }
  repo.persist();
  state.period.monthStart = null;
  state.day = null;
  toast('داده نمونه بارگذاری شد');
  closeModal();
  render(repo);
}

const POMO_ERRORS: Record<string, string> = {
  no_proxy: 'اول آدرس ورکر پراکسی را وارد کن',
  invalid_username: 'نام کاربری برای پومودوروس معتبر نیست (فقط حروف و اعداد انگلیسی)',
  invalid_days: 'بازه باید ۳۰ یا ۶۰ یا ۹۰ روز باشد',
  rate_limited: 'تعداد درخواست‌ها زیاد بود؛ یک دقیقه بعد دوباره امتحان کن',
  user_not_found: 'چنین نام کاربری در پومودوروس پیدا نشد',
  upstream_error: 'سرور پومودوروس خطا برگرداند؛ بعداً امتحان کن',
  upstream_unreachable: 'دسترسی به سرور پومودوروس ممکن نشد',
  bad_shape: 'دادهٔ برگشتی قابل خواندن نبود',
  failed: 'دریافت ناموفق بود؛ اتصال اینترنت و آدرس ورکر را چک کن'
};

async function handlePomodorusAutoFetch(repo: Repo): Promise<void> {
  const status = document.getElementById('pomo-fetch-status');
  const userEl = document.getElementById('pomo-user-auto');
  const daysEl = document.getElementById('pomo-days');
  const proxyEl = document.getElementById('pomo-proxy');
  const btn = document.querySelector<HTMLButtonElement>('[data-action="pomo-autofetch"]');
  const set = (msg: string, color?: string) => {
    if (status) { status.textContent = msg; status.style.color = color || ''; }
  };
  /* proxy field lives in the advanced section; blank → shared default */
  const rawUrl = proxyEl instanceof HTMLInputElement ? proxyEl.value.trim() : '';
  const url = rawUrl || DEFAULT_POMO_PROXY;
  if (!setProxyBase(repo, url)) { set('آدرس سرور دریافت معتبر نیست', 'var(--bad)'); return; }

  const user = userEl instanceof HTMLInputElement ? userEl.value.trim() : '';
  const days = Math.max(30, Math.min(90, Number(daysEl instanceof HTMLInputElement ? daysEl.value : 90) || 90));
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(user)) { set('نام کاربری را درست وارد کن', 'var(--bad)'); return; }

  if (btn) { btn.disabled = true; btn.textContent = 'در حال دریافت…'; }
  set('در حال دریافت از پراکسی…');
  try {
    const profile = await fetchViaProxy(repo, user, days as 30 | 60 | 90);
    const r = importPomodorusProfile(repo, profile);
    set(
      'انجام شد: ' + new Intl.NumberFormat('fa-IR').format(r.entriesAdded) + ' ثبت، ' +
      new Intl.NumberFormat('fa-IR').format(r.tasksCreated) + ' تسک جدید' +
      (r.entriesSkippedExisting ? '، ' + new Intl.NumberFormat('fa-IR').format(r.entriesSkippedExisting) + ' ثبت قبلی دست نخورد' : ''),
      'var(--ok)'
    );
    render(repo);
  } catch (e) {
    const code = e instanceof Error ? e.message : 'failed';
    set(POMO_ERRORS[code] ?? POMO_ERRORS['failed'] ?? 'دریافت ناموفق بود', 'var(--bad)');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'دریافت خودکار'; }
  }
}

export function attachEvents(repo: Repo): void {
  document.addEventListener('click', e => {
    const t = e.target;
    if (!(t instanceof Element)) return;

    const hoverEl = t.closest('[data-hover-day]');
    if (hoverEl) {
      const dd = hoverEl.getAttribute('data-hover-day') || '';
      const pop = document.getElementById('day-pop');
      if (pop && pop.style.display === 'block' && pop.dataset.day === dd) hideDayPop();
      else showDayPop(repo, dd, e.clientX, e.clientY);
    }

    const el = t.closest<HTMLElement>('[data-action]');
    if (!el) { hideDayPop(); return; }
    const a = el.dataset.action || '';
    const d = el.dataset;

    if (a === 'overlay-close') { if (e.target === el) closeModal(); return; }
    if (a === 'close-modal') { closeModal(); return; }

    switch (a) {
      case 'tab':
        state.tab = (d.tab || 'today') as typeof state.tab;
        render(repo);
        window.scrollTo({ top: 0 });
        break;

      case 'open-pomodorus':
        openPomodorusModal(repo);
        break;
      case 'pomo-autofetch':
        void handlePomodorusAutoFetch(repo);
        break;


      case 'month-prev':
        state.period.monthStart = isoOf(prevMonthStart(isoToDate(state.period.monthStart || isoOf(monthStartOf(new Date())))));
        render(repo);
        break;
      case 'month-next':
        state.period.monthStart = isoOf(nextMonthStart(isoToDate(state.period.monthStart || isoOf(monthStartOf(new Date())))));
        render(repo);
        break;

      case 'set-period':
        state.period.kind = (d.kind || 'month') as typeof state.period.kind;
        if (d.kind === 'custom' && !state.period.from) {
          state.period.from = isoOf(addDays(new Date(), -13));
          state.period.to = todayIso();
        }
        render(repo);
        break;
      case 'set-rolling':
        state.period.rollingDays = +d.days! || 30;
        render(repo);
        break;
      case 'set-chart':
        state.chartType = d.chart === 'line' ? 'line' : 'bar';
        render(repo);
        break;

      case 'day-prev':
        state.day = isoOf(addDays(isoToDate(state.day || todayIso()), -1));
        render(repo);
        break;
      case 'day-next':
        if ((state.day || todayIso()) >= todayIso()) break;
        state.day = isoOf(addDays(isoToDate(state.day!), 1));
        render(repo);
        break;
      case 'day-today':
        state.day = todayIso();
        render(repo);
        break;

      case 'open-settings':
        openSettingsModal(repo);
        break;
      case 'toggle-theme': {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        const fl = document.getElementById('favicon-light');
        const fd = document.getElementById('favicon-dark');
        if (fl instanceof HTMLLinkElement && fd instanceof HTMLLinkElement) {
          fl.disabled = next === 'dark';
          fd.disabled = next !== 'dark';
        }
        try { localStorage.setItem('mtracker.theme', next); } catch { /* ignore */ }
        const tb = document.getElementById('theme-btn');
        if (tb) tb.textContent = next === 'dark' ? '☀' : '☾';
        break;
      }

      case 'open-entry':
        openEntryModal(repo, { taskId: d.task || null, date: d.date || null });
        break;
      case 'edit-day':
        openEntryModal(repo, { taskId: d.task, date: d.date });
        break;
      case 'quick-add': {
        const task = repo.task(d.task!);
        if (!task) break;
        const date = d.date || todayIso();
        if (date > todayIso()) break;
        const cur = repo.findEntry(task.id, date);
        const next = clampHours((cur ? cur.hours : 0) + parseFloat(d.amount || '0'));
        if (next <= 0) break;
        repo.upsertEntry({ taskId: task.id, date, hours: next, note: cur ? cur.note : '' });
        render(repo);
        break;
      }
      case 'delete-entry': {
        const entry = d.entry ? repo.entryById(d.entry) : undefined;
        if (!entry) break;
        repo.removeEntry(entry.id);
        toast('ثبت حذف شد');
        closeModal();
        render(repo);
        break;
      }

      case 'open-task':
        openTaskModal(repo, d.task || null);
        break;
      case 'delete-task': {
        const task = d.task ? repo.task(d.task) : undefined;
        if (!task) break;
        if (el.dataset.armed !== '1') { armButton(el, 'مطمئنی؟ حذف'); break; }
        repo.removeTask(task.id);
        toast('تسک «' + task.name + '» و همه ثبت‌هایش حذف شد');
        render(repo);
        break;
      }

      case 'export-csv': {
        const { count } = exportCsv(repo);
        toast(fmtHours(0, appSettings(repo.db)) === '۰:۰۰' ? faNumSafe(count) + ' ثبت خروجی گرفته شد' : faNumSafe(count) + ' ثبت خروجی گرفته شد');
        break;
      }
      case 'export-json':
        exportJson(repo);
        toast('بکاپ کامل دانلود شد');
        break;
      case 'import-click': {
        const input = document.getElementById('import-file');
        if (input instanceof HTMLInputElement) input.click();
        break;
      }

      case 'load-sample': {
        if (repo.tasks.length > 0 && el.dataset.armed !== '1') { armButton(el, 'داده فعلی ترکیب می‌شود، ادامه؟'); break; }
        loadSample(repo);
        break;
      }
      case 'reset-all':
        if (el.dataset.armed !== '1') { armButton(el, 'مطمئنی؟ همه پاک شود'); break; }
        repo.reset();
        state.period.monthStart = null;
        state.day = null;
        state.period.kind = 'month';
        toast('همه داده‌ها پاک شد');
        render(repo);
        break;
    }
  });

  function faNumSafe(n: number): string {
    return new Intl.NumberFormat('fa-IR').format(n);
  }

  document.addEventListener('submit', e => {
    const formEl = e.target;
    if (!(formEl instanceof HTMLFormElement)) return;
    if (!formEl.dataset.form) return;
    e.preventDefault();

    if (formEl.dataset.form === 'entry') {
      const entryId = formEl.dataset.entryId || null;
      const entry = entryId ? repo.entryById(entryId) : undefined;
      const taskId = entry ? entry.taskId : (formEl.elements.namedItem('task') as HTMLSelectElement).value;
      const date = (formEl.elements.namedItem('date') as HTMLInputElement).value;
      const hours = toNumber((formEl.elements.namedItem('hours') as HTMLInputElement).value);
      const note = (formEl.elements.namedItem('note') as HTMLInputElement).value.trim();
      if (!date) { toast('تاریخ را انتخاب کن'); return; }
      if (!(hours > 0 && hours <= 24)) { toast('ساعت باید بیشتر از صفر و حداکثر ۲۴ باشد'); return; }
      const task = repo.task(taskId);
      if (!task) { toast('تسک پیدا نشد'); return; }
      const existing = repo.findEntry(taskId, date);
      repo.upsertEntry({ taskId, date, hours: clampHours(hours), note });
      toast(existing ? 'ثبت به‌روزرسانی شد' : 'ثبت شد');
      closeModal();
      render(repo);
      return;
    }

    if (formEl.dataset.form === 'pomodorus') {
      const raw = (formEl.elements.namedItem('pomo-json') as HTMLTextAreaElement).value;
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        toast('متن کپی‌شده JSON معتبر نیست؛ دوباره کل صفحه را کپی کن (Ctrl+A و Ctrl+C)');
        return;
      }
      const profile = normalizePomodorusProfile(parsed);
      if (!profile || !profile.days.length) {
        toast('ساختار داده پومودوروس قابل خواندن نیست');
        return;
      }
      const focusDays = profile.days.filter(d => d.totalMs > 0).length;
      if (!focusDays) { toast('در این ۹۰ روز هیچ فوکوسی ثبت نشده'); return; }
      const r = importPomodorusProfile(repo, profile);
      toast(
        new Intl.NumberFormat('fa-IR').format(r.entriesAdded) + ' ثبت اضافه شد، ' +
        new Intl.NumberFormat('fa-IR').format(r.tasksCreated) + ' تسک جدید' +
        (r.entriesSkippedExisting ? '، ' + new Intl.NumberFormat('fa-IR').format(r.entriesSkippedExisting) + ' روزِ قبلاً-ثبت‌شده دست نخورد' : '') +
        ' (' + new Intl.NumberFormat('fa-IR').format(focusDays) + ' روز فوکوس)'
      );
      closeModal();
      render(repo);
      return;
    }

    if (formEl.dataset.form === 'task') {
      const id = formEl.dataset.taskId || null;
      const name = (formEl.elements.namedItem('name') as HTMLInputElement).value.trim();
      if (!name) { toast('نام تسک را بنویس'); return; }
      const target = Math.max(0, Math.min(24, toNumber((formEl.elements.namedItem('target') as HTMLInputElement).value) || 0));
      const customEl = formEl.querySelector<HTMLInputElement>('input[name="custom-color"]');
      const checkedEl = formEl.querySelector<HTMLInputElement>('input[name="color"]:checked');
      const color = (customEl && customEl.dataset.chosen === '1' && customEl.value)
        ? customEl.value
        : (checkedEl ? checkedEl.value : undefined);
      if (id) {
        repo.updateTask(id, { name, targetDailyHours: target, ...(color ? { color } : {}) });
        toast('تسک به‌روزرسانی شد');
      } else {
        repo.createTask({ name, targetDailyHours: target, color });
        toast('تسک «' + name + '» ساخته شد');
      }
      closeModal();
      render(repo);
    }
  });

  document.addEventListener('change', e => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.name === 'custom-color') {
      t.dataset.chosen = '1';
      const sw = t.closest('.swatch');
      if (sw instanceof HTMLElement) sw.style.background = t.value;
      const f = t.closest('form');
      if (f) f.querySelectorAll<HTMLInputElement>('input[name="color"]').forEach(r => { r.checked = false; });
      return;
    }
    if (t.name === 'color') {
      const c = document.getElementById('f-custom-color');
      if (c instanceof HTMLInputElement) {
        c.dataset.chosen = '0';
        const sw = c.closest('.swatch');
        if (sw instanceof HTMLElement) sw.style.background = '';
      }
      return;
    }
    if (t.id === 'p-from' || t.id === 'p-to') {
      state.period[t.id === 'p-from' ? 'from' : 'to'] = t.value || null;
      render(repo);
      return;
    }
    if (t.id === 'day-picker') {
      if (t.value) state.day = t.value;
      render(repo);
      return;
    }
    if (t.id === 'import-file') {
      const f = t.files && t.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = () => {
        const txt = String(reader.result || '');
        if (f.name.toLowerCase().endsWith('.json')) {
          const backup = validateBackup(txt);
          if (!backup) { toast('فایل بکاپ معتبر نیست'); return; }
          const fresh = new Repo(backup, msg => toast(msg));
          repo.adopt(fresh.db);
          toast('بازیابی شد: ' + new Intl.NumberFormat('fa-IR').format(repo.tasks.length) + ' تسک، ' + new Intl.NumberFormat('fa-IR').format(repo.entries.length) + ' ثبت');
          closeModal();
          render(repo);
        } else {
          const { added, created, skipped } = importCsvRows(repo, txt);
          toast(new Intl.NumberFormat('fa-IR').format(added) + ' ثبت اضافه شد، ' + new Intl.NumberFormat('fa-IR').format(created) + ' تسک جدید، ' + new Intl.NumberFormat('fa-IR').format(skipped) + ' رد نامعتبر');
          closeModal();
          render(repo);
        }
      };
      reader.readAsText(f, 'utf-8');
      t.value = '';
    }
  });

  document.addEventListener('input', e => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.id === 'f-hours') {
      const hint = document.getElementById('f-hours-hint');
      if (!hint) return;
      const v = toNumber(t.value);
      hint.textContent = (v > 0 && v <= 24) ? '= ' + fmtHours(v, appSettings(repo.db)) + ' ساعت' : '';
      return;
    }
    if (t instanceof HTMLInputElement && t.id === 'pomo-user') {
      updatePomodorusLink();
    }
  });

  document.addEventListener('mouseover', e => {
    const t = e.target;
    if (t instanceof Element) {
      const h = t.closest('[data-hover-day]');
      if (h) showDayPop(repo, h.getAttribute('data-hover-day') || '', e.clientX, e.clientY);
    }
  });
  document.addEventListener('mouseout', e => {
    const t = e.target;
    if (t instanceof Element && t.closest('[data-hover-day]')) hideDayPop();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeModal(); hideDayPop(); }
  });

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    hideDayPop();
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(repo), 160);
  });
}
