/* Layer 5 — delegated events. Wires the whole UI to Repo. */
import { appSettings, fmtHours } from '../settings';
import { todayIso, isoOf, isoToDate, addDays, monthStartOf, prevMonthStart, nextMonthStart, jLabel } from '../jalali';
import { state } from './state';
import { toast } from './bits';
import { Repo } from '../storage';
import { hideDayPop, showDayPop } from './daypop';
import { closeModal, openEntryModal, openTaskModal, openPomodorusModal, openSettingsModal, updatePomodorusLink, toggleEntryCalendar, refreshEntryCalendar, pickEntryDate } from './modals';
import { exportCsv, exportJson, importCsvRows, validateBackup } from '../transfer';
import { render } from './render';
import { clampHours, toNumber, normalizeDaysPerWeek } from '../utils';
import { fetchViaProxy, importPomodorusProfile, normalizePomodorusProfile } from '../pomodorus';
import { calGridHTML } from './jcal';

function armButton(btn: HTMLElement, armedLabel: string): void {
  btn.dataset.armed = '1';
  btn.dataset.orig = btn.textContent || '';
  btn.textContent = armedLabel;
  btn.classList.add('danger');
  setTimeout(() => {
    if (!document.body.contains(btn)) return;
    btn.dataset.armed = '0';
    btn.textContent = btn.dataset.orig ?? '';
    btn.classList.remove('danger');
  }, 3500);
}

function refreshReportCal(dir?: number): void {
  const wrap = document.getElementById('report-cal');
  const grid = document.getElementById('report-cal-grid');
  const title = document.getElementById('report-cal-title');
  if (!wrap || !grid || !title) return;
  const field: 'from' | 'to' = wrap.dataset.field === 'to' ? 'to' : 'from';
  const sel = state.period[field] || todayIso();
  let ms = monthStartOf(isoToDate(grid.dataset.view || sel));
  if (dir === 1) ms = nextMonthStart(ms);
  if (dir === -1) ms = prevMonthStart(ms);
  const cur = monthStartOf(new Date());
  if (ms > cur) ms = cur;
  grid.dataset.view = isoOf(ms);
  title.textContent = jLabel(ms);
  grid.innerHTML = calGridHTML(ms, sel, todayIso(), 'rcal-pick');
  const nextBtn = document.querySelector<HTMLButtonElement>('[data-action="rcal-next"]');
  if (nextBtn) nextBtn.disabled = ms >= cur;
  const hint = document.getElementById('report-cal-hint');
  if (hint) hint.textContent = field === 'from' ? 'در حال انتخاب: شروع بازه' : 'در حال انتخاب: پایان بازه';
}

export function loadSample(repo: Repo): void {
  const start = addDays(new Date(), -34);
  const t1 = repo.createTask({ name: 'زبان انگلیسی', targetDailyHours: 2, color: '#4f46e5', daysPerWeek: 7 });
  const t2 = repo.createTask({ name: 'برنامه‌نویسی', targetDailyHours: 3, color: '#0e9384', daysPerWeek: 5 });
  const t3 = repo.createTask({ name: 'ورزش', targetDailyHours: 1, color: '#175cd3', daysPerWeek: 7 });
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
  state.calMonth = null;
  toast('داده نمونه بارگذاری شد');
  closeModal();
  render(repo);
}

const POMO_ERRORS: Record<string, string> = {
  invalid_username: 'نام کاربری برای پومودوروس معتبر نیست (فقط حروف و اعداد انگلیسی)',
  invalid_days: 'بازه باید ۳۰ یا ۶۰ یا ۰ روز باشد',
  rate_limited: 'تعداد درخواست‌ها زیاد بود؛ یک دقیقه بعد دوباره امتحان کن',
  user_not_found: 'چنین نام کاربری در پومودوروس پیدا نشد',
  upstream_error: 'سرور پومودوروس خطا برگرداند؛ بعداً امتحان کن',
  upstream_unreachable: 'اتصال به سرور پومودوروس برقرار نشد',
  bad_shape: 'دادهٔ برگشتی قابل خواندن نبود',
  failed: 'دریافت ناموفق بود؛ اتصال اینترنت و آدرس ورکر را چک کن'
};

async function handlePomodorusAutoFetch(repo: Repo): Promise<void> {
  const status = document.getElementById('pomo-fetch-status');
  const userEl = document.getElementById('pomo-user');
  const btn = document.querySelector<HTMLButtonElement>('[data-action="pomo-autofetch"]');
  const set = (msg: string, color?: string) => {
    if (status) { status.textContent = msg; status.style.color = color || ''; }
  };
  const user = userEl instanceof HTMLInputElement ? userEl.value.trim() : '';
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(user)) { set('نام کاربری را درست وارد کن (فقط حروف و اعداد انگلیسی)', 'var(--bad)'); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'در حال دریافت…'; }
  set('در حال دریافت ۹۰ روز اخیر…');
  try {
    const profile = await fetchViaProxy(user);
    const r = importPomodorusProfile(repo, profile);
    set(
      'انجام شد: ' + new Intl.NumberFormat('fa-IR').format(r.entriesAdded) + ' ثبت جدید' +
      (r.entriesUpdated ? '، ' + new Intl.NumberFormat('fa-IR').format(r.entriesUpdated) + ' ثبت به‌روز شد' : '') +
      (r.entriesSkippedExisting ? '، ' + new Intl.NumberFormat('fa-IR').format(r.entriesSkippedExisting) + ' ثبت دستی دست‌نخورده' : '') +
      ' — ' + new Intl.NumberFormat('fa-IR').format(r.tasksCreated) + ' تسک جدید',
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

    /* close report calendar on outside click */
    const rcalEl = document.getElementById('report-cal');
    const el = t.closest<HTMLElement>('[data-action]');
    const a = el ? (el.dataset.action || '') : '';
    if (rcalEl && rcalEl.style.display === 'block' && a !== 'rcal-toggle' && !t.closest('#report-cal')) {
      rcalEl.style.display = 'none';
    }

    /* hover-day targets without an action => day popup */
    const hoverEl = t.closest('[data-hover-day]');
    if (hoverEl && !hoverEl.hasAttribute('data-action')) {
      showDayPop(repo, hoverEl.getAttribute('data-hover-day') || '', e.clientX, e.clientY);
      return;
    }

    if (!el) { hideDayPop(); return; }
    const d = el.dataset;
    if (a === 'overlay-close') { if (e.target === el) closeModal(); return; }
    if (a === 'close-modal') { closeModal(); return; }

    switch (a) {
      case 'tab':
        state.tab = (d.tab || 'today') as typeof state.tab;
        try { localStorage.setItem('mtracker.tab', state.tab); } catch { /* ignore */ }
        render(repo);
        window.scrollTo({ top: 0 });
        break;
      case 'open-day':
      case 'goto-day':
        state.day = d.date || todayIso();
        state.calMonth = isoOf(monthStartOf(isoToDate(state.day)));
        state.tab = 'daily';
        try { localStorage.setItem('mtracker.tab', state.tab); } catch { /* ignore */ }
        render(repo);
        window.scrollTo({ top: 0 });
        break;
      case 'open-pomodorus':
        openPomodorusModal(repo);
        break;
      case 'open-settings':
        openSettingsModal(repo);
        break;
      case 'set-setting':
        if (d.key === 'timeFormat') repo.db.settings.timeFormat = d.val === 'decimal' ? 'decimal' : 'hm';
        else repo.db.settings.chartDir = d.val === 'rtl' ? 'rtl' : 'ltr';
        repo.persist();
        openSettingsModal(repo);
        render(repo);
        break;
      case 'pomo-autofetch':
        void handlePomodorusAutoFetch(repo);
        break;
      case 'pomo-paste': {
        const ta = document.getElementById('pomo-json');
        if (!(ta instanceof HTMLTextAreaElement)) break;
        if (navigator.clipboard && navigator.clipboard.readText) {
          navigator.clipboard.readText()
            .then(txt => { ta.value = txt; toast('از کلیپ‌بورد چسبانده شد'); })
            .catch(() => toast('دسترسی کلیپ‌بورد داده نشد؛ دستی Ctrl+V بزن'));
        } else {
          toast('مرورگر از خواندن کلیپ‌بورد پشتیبانی نمی‌کند؛ دستی Ctrl+V بزن');
        }
        break;
      }
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
        try { localStorage.setItem('mtracker.chart', state.chartType); } catch { /* ignore */ }
        render(repo);
        break;
      case 'set-dpw': {
        const f = el.closest('form');
        if (!f) break;
        const hid = f.querySelector<HTMLInputElement>('input[name="daysPerWeek"]');
        if (hid) hid.value = d.v || '7';
        f.querySelectorAll('[data-action="set-dpw"]').forEach(b => b.classList.toggle('active', b === el));
        const hint = document.getElementById('dpw-hint');
        if (hint) {
          const v = +(d.v || '7');
          hint.textContent = v === 0 ? 'بدون برنامه پایداری — در تب امروز نمایش داده نمی‌شود' : v === 7 ? 'هر روز هفته' : faNumSafe(v) + ' روز در هفته';
        }
        refreshTaskPreview();
        break;
      }
      case 'cal-prev':
        state.calMonth = isoOf(prevMonthStart(isoToDate(state.calMonth || isoOf(monthStartOf(isoToDate(state.day || todayIso()))))));
        render(repo);
        break;
      case 'cal-next': {
        const curView = state.calMonth || isoOf(monthStartOf(isoToDate(state.day || todayIso())));
        if (curView >= isoOf(monthStartOf(new Date()))) break;
        state.calMonth = isoOf(nextMonthStart(isoToDate(curView)));
        render(repo);
        break;
      }
      case 'pick-day':
        if (d.date && d.date <= todayIso()) {
          state.day = d.date;
          state.calMonth = isoOf(monthStartOf(isoToDate(d.date)));
          render(repo);
        }
        break;
      case 'day-prev':
        state.day = isoOf(addDays(isoToDate(state.day || todayIso()), -1));
        state.calMonth = isoOf(monthStartOf(isoToDate(state.day)));
        render(repo);
        break;
      case 'day-next':
        if ((state.day || todayIso()) >= todayIso()) break;
        state.day = isoOf(addDays(isoToDate(state.day!), 1));
        state.calMonth = isoOf(monthStartOf(isoToDate(state.day)));
        render(repo);
        break;
      case 'day-today':
        state.day = todayIso();
        state.calMonth = null;
        render(repo);
        break;
      case 'open-entry':
        openEntryModal(repo, { taskId: d.task || null, date: d.date || null });
        break;
      case 'edit-day':
        openEntryModal(repo, { taskId: d.task, date: d.date });
        break;
      case 'ecal-toggle':
        toggleEntryCalendar();
        break;
      case 'ecal-prev':
        refreshEntryCalendar(-1);
        break;
      case 'ecal-next':
        refreshEntryCalendar(1);
        break;
      case 'ecal-pick':
        if (d.date) pickEntryDate(d.date);
        break;
      case 'eh-add': {
        const inp = document.getElementById('f-hours');
        if (!(inp instanceof HTMLInputElement)) break;
        const cur = toNumber(inp.value) || 0;
        const next = Math.min(24, Math.round((cur + parseFloat(d.amount || '0')) * 100) / 100);
        inp.value = next > 0 ? String(next) : '';
        const hint = document.getElementById('f-hours-hint');
        if (hint) hint.textContent = (next > 0 && next <= 24) ? '= ' + fmtHours(next, appSettings(repo.db)) + ' ساعت' : '';
        break;
      }
      case 'rcal-toggle': {
        const wrap = document.getElementById('report-cal');
        if (!wrap) break;
        const field = d.field === 'to' ? 'to' : 'from';
        const wasOpen = wrap.style.display === 'block' && wrap.dataset.field === field;
        wrap.dataset.field = field;
        wrap.style.display = wasOpen ? 'none' : 'block';
        if (!wasOpen) {
          const grid = document.getElementById('report-cal-grid');
          if (grid) delete grid.dataset.view;
          refreshReportCal();
        }
        break;
      }
      case 'rcal-prev':
        refreshReportCal(-1);
        break;
      case 'rcal-next':
        refreshReportCal(1);
        break;
      case 'rcal-pick': {
        if (!d.date) break;
        const wrap = document.getElementById('report-cal');
        const field: 'from' | 'to' = wrap && wrap.dataset.field === 'to' ? 'to' : 'from';
        state.period[field] = d.date;
        render(repo);
        break;
      }
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
        toast(faNumSafe(count) + ' ثبت خروجی گرفته شد');
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
        state.calMonth = null;
        state.period.kind = 'month';
        toast('همه داده‌ها پاک شد');
        render(repo);
        break;
    }
  });

  function faNumSafe(n: number): string {
    return new Intl.NumberFormat('fa-IR').format(n);
  }

  function refreshTaskPreview(): void {
    const f = document.querySelector<HTMLFormElement>('form[data-form="task"]');
    if (!f) return;
    const pv = document.getElementById('task-preview');
    const nameEl = document.getElementById('tp-name');
    const chipEl = document.getElementById('tp-chip');
    const nameInput = f.querySelector<HTMLInputElement>('input[name="name"]');
    const targetInput = f.querySelector<HTMLInputElement>('input[name="target"]');
    const dpwInput = f.querySelector<HTMLInputElement>('input[name="daysPerWeek"]');
    const checked = f.querySelector<HTMLInputElement>('input[name="color"]:checked');
    const custom = f.querySelector<HTMLInputElement>('input[name="custom-color"]');
    const color = (custom && custom.dataset.chosen === '1' && custom.value) ? custom.value : (checked ? checked.value : '');
    if (pv && color) pv.style.setProperty('--task', color);
    if (nameEl && nameInput) nameEl.textContent = nameInput.value.trim() || 'نام تسک';
    if (chipEl) {
      const tgt = toNumber(targetInput ? targetInput.value : '');
      const dpw = dpwInput ? +dpwInput.value : 7;
      chipEl.textContent = (tgt > 0 ? 'هدف: ' + fmtHours(tgt, appSettings(repo.db)) + ' ساعت در روز' : 'بدون هدف روزانه') +
        ' • ' + (dpw === 0 ? 'بدون پایداری' : dpw === 7 ? 'هر روز' : faNumSafe(dpw) + ' روز/هفته');
    }
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
      if (date > todayIso()) { toast('تاریخ نمی‌تواند در آینده باشد'); return; }
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
      const daysPerWeek = normalizeDaysPerWeek(toNumber((formEl.elements.namedItem('daysPerWeek') as HTMLInputElement).value));
      if (id) {
        repo.updateTask(id, { name, targetDailyHours: target, ...(color ? { color } : {}), daysPerWeek });
        toast('تسک به‌روزرسانی شد');
      } else {
        repo.createTask({ name, targetDailyHours: target, color, daysPerWeek });
        toast('تسک «' + name + '» ساخته شد');
      }
      closeModal();
      render(repo);
    }
  });

  document.addEventListener('change', e => {
    /* task select in entry modal: sync the live color dot */
    const selEl = e.target;
    if (selEl instanceof HTMLSelectElement && selEl.name === 'task') {
      const dot = document.getElementById('em-task-dot');
      const tsk = repo.task(selEl.value);
      if (dot && tsk) dot.style.background = tsk.color;
      return;
    }
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.name === 'custom-color') {
      t.dataset.chosen = '1';
      const sw = t.closest('.swatch');
      if (sw instanceof HTMLElement) sw.style.background = t.value;
      const f = t.closest('form');
      if (f) f.querySelectorAll<HTMLInputElement>('input[name="color"]').forEach(r => { r.checked = false; });
      refreshTaskPreview();
      return;
    }
    if (t.name === 'color') {
      const c = document.getElementById('f-custom-color');
      if (c instanceof HTMLInputElement) {
        c.dataset.chosen = '0';
        const sw = c.closest('.swatch');
        if (sw instanceof HTMLElement) sw.style.background = '';
      }
      refreshTaskPreview();
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
    if (t instanceof HTMLInputElement && (t.id === 'f-task-name' || t.id === 'f-task-target')) {
      refreshTaskPreview();
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
    if (e.key === 'Escape') {
      closeModal();
      hideDayPop();
      const rc = document.getElementById('report-cal');
      if (rc) rc.style.display = 'none';
    }
  });

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener('resize', () => {
    hideDayPop();
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => render(repo), 160);
  });
  window.addEventListener('scroll', hideDayPop, { passive: true });
}