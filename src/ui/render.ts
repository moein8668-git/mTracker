/* Full-app render — swaps view HTML into #app. */
import type { Repo } from '../storage';
import { state, type TabId } from './state';
import { hideDayPop } from './daypop';
import { viewToday } from './views/today';
import { viewDaily } from './views/daily';
import { viewReport } from './views/report';
import { viewTasks } from './views/tasks';
import { viewData } from './views/data';

const VIEWS: Record<TabId, (repo: Repo) => string> = {
  today: viewToday,
  daily: viewDaily,
  report: viewReport,
  tasks: viewTasks,
  data: viewData
};

let lastTab: TabId | null = null;

/* sliding pill indicator under the active tab (desktop only) */
function slideTabIndicator(): void {
  const nav = document.querySelector<HTMLElement>('.tabs');
  if (!nav || nav.offsetParent === null) return; /* hidden on mobile: bottom nav instead */
  let ind = nav.querySelector<HTMLElement>('.tab-ind');
  if (!ind) {
    ind = document.createElement('i');
    ind.className = 'tab-ind';
    nav.appendChild(ind);
  }
  const btn = nav.querySelector<HTMLElement>('button.active');
  if (!btn) { ind.style.opacity = '0'; return; }
  ind.style.opacity = '1';
  ind.style.width = btn.offsetWidth + 'px';
  ind.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
  if (nav.scrollWidth > nav.clientWidth + 4) {
    btn.scrollIntoView({ block: 'nearest', inline: 'center' });
  }
}
if (typeof window !== 'undefined') window.addEventListener('load', slideTabIndicator);

export function render(repo: Repo): void {
  const app = document.getElementById('app');
  if (app) {
    const isNewTab = state.tab !== lastTab;
    if (isNewTab) {
      app.classList.remove('view-in');
      app.innerHTML = VIEWS[state.tab](repo);
      lastTab = state.tab;
      // Force reflow, then re-add: animation restarts in the same frame as the new
      // content's first paint — no flash of unanimated content, no stale rAF timing.
      void app.offsetWidth;
      app.classList.add('view-in');
    } else {
      app.innerHTML = VIEWS[state.tab](repo);
    }
  }
  document.querySelectorAll('.tabs button, .bottom-nav button').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.tab === state.tab));
  slideTabIndicator();
  hideDayPop();
}