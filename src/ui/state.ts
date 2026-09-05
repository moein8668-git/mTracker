/* App state — single source of truth for active tab / period / chart. */

export interface PeriodState {
  kind: 'month' | 'rolling' | 'custom';
  monthStart: string | null;
  rollingDays: number;
  from: string | null;
  to: string | null;
}

export type TabId = 'today' | 'daily' | 'report' | 'tasks' | 'data';

export const state = {
  tab: 'today' as TabId,
  period: {
    kind: 'month',
    monthStart: null,
    rollingDays: 30,
    from: null,
    to: null
  } as PeriodState,
  chartType: 'bar' as 'bar' | 'line',
  day: null as string | null
};
export const TABS: readonly TabId[] = ['today', 'daily', 'report', 'tasks', 'data'];
export function parseTabId(v: string | null): TabId {
  return TABS.includes(v as TabId) ? (v as TabId) : 'today';
}
