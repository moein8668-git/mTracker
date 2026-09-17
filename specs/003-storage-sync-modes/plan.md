# Implementation Plan: Storage and Sync Modes

**Branch**: `003-storage-sync-modes` | **Date**: 2026-09-17 | **Spec**: [spec.md](spec.md)

## Summary

The application will operate in exactly one mode at a time: signed-out local-only storage or
signed-in account-sync storage. A backup/confirmation transition prevents implicit local-data
upload. Worker pull responses will normalize entry dates to `YYYY-MM-DD`, fixing time entries that
are received but fail browser date matching and rendering.

## Technical Context

**Language/Version**: TypeScript, Vite browser app, Cloudflare Worker

**Primary Dependencies**: localStorage, existing CSV transfer functions, postgres.js

**Storage**: local-only browser namespace, per-email account cache namespace, PostgreSQL account
source of truth

**Testing**: Vitest browser mode tests and Worker sync contract tests

**Target Platform**: modern browsers and Cloudflare Worker

**Project Type**: offline-first browser application with synchronized account API

**Constraints**: local/account datasets must not mix; confirmation is required before clearing local
data; CSV backup is offered but optional; account cache is hidden on sign-out; entry dates are
date-only strings

## Constitution Check

**Pre-design: PASS.** Constitution v3.1.0 requires exclusive local-only/account-sync modes,
automatic account synchronization, backup consent before local-data removal, and account isolation.

**Post-design: PASS.** Separate namespaces enforce the data boundary, while date normalization
preserves the browser model. No mail-worker responsibility changes.

## Project Structure

```text
src/storage.ts              # mode-scoped browser persistence
src/sync/engine.ts          # account lifecycle and automatic sync
src/transfer.ts             # transition CSV backup/import
src/main.ts                 # initial active-mode repository
src/ui/events.ts            # sign-in transition actions
src/ui/modals.ts            # backup/confirmation UI
src/ui/syncchip.ts          # account-only status indicator
api/src/sync.ts             # date-only pull contract
tests/storage-mode.test.ts
tests/sync-engine.test.ts
api/test/sync.contract.test.ts
```

**Structure Decision**: Storage and sync own mode state; UI only presents consent and status; the
Worker owns date wire-format normalization.

## Complexity Tracking

No constitution violations require justification.
