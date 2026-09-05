import { describe, expect, it } from 'vitest';
import { parseTabId } from '../src/ui/state';
import { lineChartHTML } from '../src/ui/charts/line';
import type { AppSettings } from '../src/settings';
import type { DayPoint } from '../src/types';

const s: AppSettings = { chartDir: 'ltr', timeFormat: 'hm' };

function days(n: number): DayPoint[] {
  const out: DayPoint[] = [];
  const d = new Date(2024, 0, 1);
  for (let i = 0; i < n; i++) {
    const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    out.push({ date: iso, hours: 2 });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

describe('parseTabId', () => {
  it('keeps known tabs', () => {
    expect(parseTabId('report')).toBe('report');
    expect(parseTabId('daily')).toBe('daily');
  });
  it('falls back to today for unknown, empty, or missing values', () => {
    expect(parseTabId('nope')).toBe('today');
    expect(parseTabId('')).toBe('today');
    expect(parseTabId(null)).toBe('today');
  });
});

describe('lineChartHTML reference lines', () => {
  const series = [{ name: 't', color: '#fff', values: days(14).map(() => 2) }];

  it('notes mean and target values under the chart', () => {
    const html = lineChartHTML(days(14), series, { mean: 2, target: 3 }, s);
    expect(html).toContain('lg-mean');
    expect(html).toContain('میانگین');
    expect(html).toContain('lg-target');
    expect(html).toContain('هدف');
  });

  it('omits the note when there is nothing to reference', () => {
    const html = lineChartHTML(days(14), series, {}, s);
    expect(html).not.toContain('lg-mean');
    expect(html).not.toContain('lg-target');
  });

  it('labels most days on a two-week chart', () => {
    const html = lineChartHTML(days(14), series, {}, s);
    const xLabels = html.match(/y="182"/g) ?? [];
    expect(xLabels.length).toBeGreaterThanOrEqual(6);
  });
});
