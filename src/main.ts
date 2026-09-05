/* Bootstrap: theme pre-applied inline in index.html; here we wire repo + events. */

import './styles.css';
import { Storage, Repo } from './storage';
import { state, parseTabId } from './ui/state';
import { render } from './ui/render';
import { attachEvents } from './ui/events';
import { toast } from './ui/bits';

const repo = new Repo(Storage.load(), msg => toast(msg));
try {
  state.tab = parseTabId(localStorage.getItem('mtracker.tab'));
} catch { /* private mode: stay on today */ }
attachEvents(repo);
render(repo);

/* first-visit welcome */
try {
  if (!repo.tasks.length && !repo.entries.length && !localStorage.getItem('mtracker.welcomed')) {
    localStorage.setItem('mtracker.welcomed', '1');
    const root = document.getElementById('modal-root');
    if (root) {
      root.innerHTML = '<div class="overlay" data-action="overlay-close"><div class="modal" role="dialog" aria-modal="true"><div class="welcome">' +
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
        '</div></div></div></div>';
    }
  }
} catch { /* private mode etc. */ }

export { state };
