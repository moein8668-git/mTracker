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
  data: (repo: Repo) => viewData(repo.entries.length)
};

export function render(repo: Repo): void {
  const app = document.getElementById('app');
  if (app) app.innerHTML = VIEWS[state.tab](repo);
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.tab === state.tab));
  const tb = document.getElementById('theme-btn');
  if (tb) tb.textContent = document.documentElement.dataset.theme === 'dark' ? '☀' : '☾';
  hideDayPop();
}
