import { apiFetch, ApiError } from './api.js';
import { Storage, accountScope, syncCursorKey, type Repo } from '../storage.js';
import type { Task, Entry, Settings } from '../types.js';
import { isoOrNull } from './merge.js';

type Auth = { email: string; token: string };
type AuthState = Auth | null;

export interface SyncEngineHooks { onData?: () => void; onStatus?: () => void; }

/** Owns the explicit boundary between local-only data and one account cache. */
export class SyncEngine {
  private auth: AuthState = null;
  private pendingTransition: Auth | null = null;
  private status: 'signed-out' | 'syncing' | 'idle' | 'error' = 'signed-out';
  private lastSyncAt: string | null = null;
  private lastError: string | null = null;
  private syncing = false;
  pendingEmail: string | null = null;

  constructor(private repo: Repo, private hooks: SyncEngineHooks = {}) { this.loadAuth(); }

  private loadAuth(): void {
    try {
      const value = JSON.parse(localStorage.getItem('mtracker.auth') || 'null') as Partial<Auth> | null;
      if (!value?.email || !value.token) return;
      this.auth = { email: value.email, token: value.token };
      if (this.repo.getScope() !== accountScope(value.email)) this.repo.switchScope(accountScope(value.email));
      this.status = 'idle';
    } catch { /* malformed old auth / private mode */ }
  }

  private saveAuth(): void { if (this.auth) localStorage.setItem('mtracker.auth', JSON.stringify(this.auth)); else localStorage.removeItem('mtracker.auth'); }
  private setStatus(s: typeof this.status): void { this.status = s; this.hooks.onStatus?.(); }
  getAuth(): AuthState { return this.auth; }
  hasPendingTransition(): boolean { return this.pendingTransition !== null; }
  hasLocalData(): boolean { return this.repo.tasks.length > 0 || this.repo.entries.length > 0; }

  async requestOtp(email: string): Promise<{ ok: boolean; devCode?: string }> {
    this.pendingEmail = email;
    return apiFetch('/auth/otp', { method: 'POST', body: { email } });
  }

  async verifyOtp(email: string, code: string): Promise<{ token: string; email: string; serverTime: string; transitionRequired: boolean }> {
    const result = await apiFetch<{ token: string; email: string; serverTime: string }>('/auth/verify', { method: 'POST', body: { email, code } });
    const candidate = { email: result.email, token: result.token };
    this.pendingEmail = null;
    if (this.hasLocalData()) { this.pendingTransition = candidate; return { ...result, transitionRequired: true }; }
    if (!await this.enterAccountMode(candidate)) throw new Error(this.lastError || 'شروع همگام‌سازی ناموفق بود');
    return { ...result, transitionRequired: false };
  }

  /** Called only after the user has acknowledged local-data removal. */
  async confirmAccountTransition(): Promise<boolean> {
    if (!this.pendingTransition) return false;
    const entered = await this.enterAccountMode(this.pendingTransition);
    if (entered) this.pendingTransition = null;
    return entered;
  }

  cancelAccountTransition(): void { this.pendingTransition = null; this.pendingEmail = null; this.setStatus('signed-out'); }

  private async enterAccountMode(candidate: Auth): Promise<boolean> {
    const previousScope = this.repo.getScope();
    this.auth = candidate; // in memory only until the initial pull has succeeded
    this.repo.switchScope(accountScope(candidate.email));
    if (!await this.syncNow()) {
      this.auth = null;
      this.saveAuth();
      this.repo.switchScope(previousScope);
      this.setStatus('signed-out');
      return false;
    }
    Storage.clear('local'); // account cache is authoritative only after confirmation + initial pull
    this.saveAuth();
    this.setStatus('idle');
    this.hooks.onData?.();
    return true;
  }

  private leaveAccount(): boolean {
    const departing = this.auth?.email;
    if (this.repo.getScope() !== 'local') this.repo.switchScope('local');
    this.auth = null;
    if (!departing) { this.saveAuth(); return true; }
    return Storage.clearAccount(departing);
  }

  async signOut(): Promise<boolean> {
    try { if (this.auth) await apiFetch('/auth/logout', { method: 'POST', token: this.auth.token }); } catch { /* best-effort */ }
    const cleaned = this.leaveAccount();
    this.pendingTransition = null; this.pendingEmail = null;
    this.lastSyncAt = null; this.lastError = null;
    this.setStatus('signed-out'); this.hooks.onData?.();
    return cleaned;
  }

  start(): void {
    this.repo.onChange(() => { if (this.auth && this.repo.isAccountMode() && !this.syncing) setTimeout(() => void this.syncNow(), 2000); });
    window.addEventListener('online', () => { void this.syncNow(); });
    setInterval(() => { void this.syncNow(); }, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void this.syncNow(); });
    if (this.auth) void this.syncNow();
  }

  async syncNow(): Promise<boolean> {
    if (!this.auth || !this.repo.isAccountMode() || this.repo.getScope() !== accountScope(this.auth.email) || this.syncing) return false;
    this.syncing = true; this.setStatus('syncing');
    try {
      const snapshot = this.repo.peekDirty();
      if (snapshot.ids.t.length || snapshot.ids.e.length || snapshot.ids.s) {
        await apiFetch('/sync/push', { method:'POST', token:this.auth.token, body:{
          tasks:snapshot.tasks.map(t => ({ id:t.id, name:t.name, target_daily_hours:t.targetDailyHours, color:t.color, days_per_week:t.daysPerWeek, created_at:isoOrNull(t.createdAt), archived_at:isoOrNull(t.archivedAt), updated_at:t.updatedAt ?? new Date().toISOString(), deleted_at:isoOrNull(t.deletedAt) })),
          entries:snapshot.entries.map(e => ({ id:e.id, task_id:e.taskId, date:e.date, hours:e.hours, note:e.note, pomo:e.pomo ?? false, created_at:isoOrNull(e.createdAt), updated_at:e.updatedAt ?? new Date().toISOString(), deleted_at:isoOrNull(e.deletedAt) })),
          settings:snapshot.settings ? { data:snapshot.settings, updated_at:snapshot.settings.updatedAt ?? new Date().toISOString() } : undefined,
        }});
        this.repo.clearDirty(snapshot.ids);
      }
      const cursorKey = syncCursorKey(this.auth.email);
      let cursor = Number.parseInt(localStorage.getItem(cursorKey) ?? '0', 10) || 0;
      let serverTime: string | null = null;
      while (true) {
        const result = await apiFetch<{ tasks: Task[]; entries: Entry[]; settings: { data: Settings; updated_at: string | null } | null; cursor: number; serverTime: string }>(`/sync/pull?since=${cursor}`, { token:this.auth.token });
        this.repo.applySync({ tasks:result.tasks, entries:result.entries, settings:result.settings ? { ...result.settings.data, updatedAt:result.settings.updated_at ?? undefined } : undefined });
        cursor = result.cursor; localStorage.setItem(cursorKey, String(cursor)); serverTime = result.serverTime;
        if (result.tasks.length < 5000 && result.entries.length < 5000 && !result.settings) break;
      }
      this.lastSyncAt = serverTime; this.lastError = null; this.setStatus('idle'); this.hooks.onData?.(); return true;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        const cleaned = this.leaveAccount();
        if (!cleaned) this.lastError = 'پاک‌کردن داده‌های حساب از مرورگر ناموفق بود';
        this.setStatus('signed-out');
        this.hooks.onData?.();
      }
      else { this.lastError = err instanceof Error ? err.message : 'خطای همگام‌سازی'; this.setStatus('error'); }
      return false;
    } finally { this.syncing = false; }
  }

  getStatus(): typeof this.status { return this.status; }
  getLastSyncAt(): string | null { return this.lastSyncAt; }
  getLastError(): string | null { return this.lastError; }
}
