import type { SyncEngine } from '../sync/engine.js';

export function updateSyncChip(engine: SyncEngine): void {
  const chip = document.getElementById('sync-chip') as HTMLButtonElement | null;
  if (!chip) return;

  const auth = engine.getAuth();
  const label = chip.querySelector('.sync-chip-label') as HTMLElement | null;
  const dot = chip.querySelector('i') as HTMLElement | null;
  chip.hidden = false;
  chip.classList.remove('chip-run', 'chip-on', 'chip-err', 'chip-login');
  if (!auth) {
    chip.classList.add('chip-login');
    chip.setAttribute('aria-label', 'ورود به حساب');
    chip.title = 'ورود به حساب';
    if (label) label.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5"/><path d="M15 12H3"/></svg>';
    if (dot) dot.hidden = true;
    return;
  }
  const status = engine.getStatus();
  const lastSync = engine.getLastSyncAt();
  const error = engine.getLastError();

  chip.setAttribute('aria-label', 'وضعیت همگام‌سازی برای ' + auth.email);
  if (label) label.textContent = auth.email.charAt(0).toUpperCase();
  if (dot) dot.hidden = false;

  if (status === 'error') {
    chip.classList.add('chip-err');
    chip.title = 'خطا: ' + (error ?? 'معلوم نیست');
  } else if (status === 'syncing') {
    chip.classList.add('chip-run');
    chip.title = 'در حال همگام‌سازی...';
  } else {
    chip.classList.add('chip-on');
    chip.title = lastSync ? 'آخرین همگام‌سازی: ' + lastSync : 'هنوز همگام‌سازی نشده';
  }

}
