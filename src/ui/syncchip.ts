import type { SyncEngine } from '../sync/engine.js';

export function updateSyncChip(engine: SyncEngine): void {
  const chip = document.getElementById('sync-chip') as HTMLButtonElement | null;
  if (!chip) return;

  const auth = engine.getAuth();
  if (!auth) {
    chip.hidden = true;
    return;
  }

  chip.hidden = false;
  const status = engine.getStatus();
  const lastSync = engine.getLastSyncAt();
  const error = engine.getLastError();

  chip.classList.remove('chip-run', 'chip-on', 'chip-err');
  const dot = chip.querySelector('i') as HTMLElement | null;
  if (dot) dot.textContent = '';

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

  chip.textContent = auth.email.charAt(0).toUpperCase();
}
