# Implementation Plan: Account Data Lifecycle and Login Entry

**Branch**: `004-account-data-lifecycle` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

## Summary

Sign-out will delete the authenticated account's browser cache, dirty queue, cursor, and auth
state before returning to a clean local-only dataset. The local-data login transition will use a
dedicated, explicit backup/deletion warning. The persistent sync control will become a login button
with an accessible icon while signed out and retain account status while signed in.

## Technical Context

**Language/Version**: TypeScript, Vite browser application

**Primary Dependencies**: browser localStorage and existing sync engine

**Storage**: local-only browser namespace and per-email account browser namespace

**Testing**: Vitest unit tests and browser interaction checks

**Target Platform**: modern desktop and mobile browsers

**Project Type**: offline-capable browser application

**Performance Goals**: logout and login-control state change are immediate to the user

**Constraints**: account cache must not remain after sign-out; local data remains untouched until
confirmed transition; login control must be keyboard and screen-reader accessible

**Scale/Scope**: browser storage lifecycle, login transition UI, and one header control

## Constitution Check

**Pre-design: PASS.** Constitution v3.2.0 requires exclusive modes, a visible CSV-backup option
before destructive local-data removal, and deletion of account browser cache and sync metadata at
sign-out.

**Post-design: PASS.** The design clears only the authenticated email namespace and cursor while
leaving the local-only namespace governed by the confirmed-transition rules. It does not change
Worker, database, or mail responsibilities.

## Project Structure

```text
src/storage.ts           # scoped browser storage and cache deletion API
src/sync/engine.ts       # logout lifecycle and pending login transition
src/ui/modals.ts         # dedicated backup/deletion warning copy
src/ui/events.ts         # warning actions and logout errors
src/ui/syncchip.ts       # signed-out login control and signed-in status rendering
index.html               # stable sync-control element and accessible default markup
src/styles.css           # login-icon and status-dot styling
tests/storage-mode.test.ts
tests/sync-engine.test.ts
tests/syncchip.test.ts
```

**Structure Decision**: storage owns deletion keys, the sync engine coordinates lifecycle and error
handling, and UI modules render/trigger only declared state changes.

## Complexity Tracking

No constitution violations require justification.
