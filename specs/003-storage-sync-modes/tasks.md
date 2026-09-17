---

description: "Actionable task list for Storage and Sync Modes"
---

# Tasks: Storage and Sync Modes

**Input**: Design documents from `specs/003-storage-sync-modes/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/storage-sync.md, quickstart.md

**Tests**: Required. The specification and constitution require automated mode-transition,
account-isolation, sync, and rendering regression coverage.

**Organization**: Tasks are grouped by user story so each increment can be independently tested.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish the mode-scoped persistence contract used by all stories.

- [X] T001 Add mode and account-namespace constants plus storage-key helpers in `src/storage.ts`.
- [X] T002 [P] Add deterministic local/account namespace fixtures and repository reset helpers in `tests/storage-mode.test.ts`.
- [X] T003 [P] Add a Worker pull-date contract fixture in `api/test/sync.contract.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Make data ownership explicit before modifying sign-in UI or automatic synchronization.

**⚠️ CRITICAL**: Complete this phase before user-story work.

- [X] T004 Implement active-mode resolution and separate local-only/per-normalized-email account repositories in `src/storage.ts`.
- [X] T005 Add repository APIs that atomically clear only the active local dataset and hide account caches from local mode in `src/storage.ts`.
- [X] T006 Refactor application startup to select the local-only repository while signed out and the authenticated account repository while signed in in `src/main.ts`.
- [X] T007 Update the sync engine repository binding and auth lifecycle interface for an explicit, successful account-mode transition in `src/sync/engine.ts`.
- [X] T008 Add foundational unit coverage for namespace separation, active-mode selection, and account-cache isolation in `tests/storage-mode.test.ts`.

**Checkpoint**: A repository can be selected without mixing browser-local and account data.

---

## Phase 3: User Story 1 - Use Local-Only Mode While Signed Out (Priority: P1) 🎯 MVP

**Goal**: A signed-out browser retains only local data and never starts account synchronization.

**Independent Test**: Start signed out, mutate a task/entry/setting, reload, and assert local persistence and zero sync API calls.

### Tests for User Story 1

- [X] T009 [P] [US1] Add signed-out mutation/reload tests asserting task, entry, and settings persistence with zero sync requests in `tests/storage-mode.test.ts`.
- [X] T010 [P] [US1] Add sync-engine tests that reject push, pull, timers, and reconnect/foreground sync while no account mode is active in `tests/sync-engine.test.ts`.

### Implementation for User Story 1

- [X] T011 [US1] Guard automatic sync scheduling and `syncNow` so signed-out local-only mode cannot issue account requests in `src/sync/engine.ts`.
- [X] T012 [US1] Make signed-out mutations persist only through the local-only repository and preserve offline/reload behavior in `src/main.ts`.
- [X] T013 [US1] Keep sync status controls account-only and remove any signed-out manual-sync path in `src/ui/syncchip.ts` and `src/ui/modals.ts`.

**Checkpoint**: Signed-out local-only operation is private, offline-capable, and independently testable.

---

## Phase 4: User Story 2 - Enter Account-Sync Mode Safely (Priority: P1)

**Goal**: Sign-in never implicitly uploads local data; it offers an optional CSV export and requires explicit acknowledgement before clearing local data.

**Independent Test**: Seed local tasks/entries, verify OTP, cancel and confirm unchanged data; repeat with optional CSV export and explicit confirmation, then verify only account data is active.

### Tests for User Story 2

- [ ] T014 [P] [US2] Add transition tests for cancel, CSV-export success, blocked/export failure, and confirmed-without-download paths in `tests/sync-engine.test.ts`.
- [ ] T015 [P] [US2] Add CSV regression tests verifying transition exports include every local task and entry and remain explicitly importable in `tests/transfer.test.ts`.
- [ ] T016 [P] [US2] Add UI event tests for the OTP verification warning, acknowledgement, backup request, confirmation, and cancellation in `tests/ui-events.test.ts`.

### Implementation for User Story 2

- [X] T017 [US2] Change OTP verification to produce a pending transition when local-only records exist, rather than marking them dirty or starting sync, in `src/sync/engine.ts`.
- [X] T018 [US2] Add a blocking local-data warning with optional CSV backup, explicit removal acknowledgement, confirm, and cancel actions in `src/ui/modals.ts`.
- [X] T019 [US2] Wire transition-modal actions to `exportCsv`, preserve local mode on cancellation/export failure, and enter account mode only after confirmation in `src/ui/events.ts`.
- [X] T020 [US2] Clear only the local-only namespace after confirmed transition, initialize the normalized-email account cache, and retain local data if the initial pull fails in `src/storage.ts` and `src/sync/engine.ts`.
- [X] T021 [US2] Ensure CSV restore is visible only after sign-in and imports explicitly into the active account repository in `src/transfer.ts` and `src/ui/events.ts`.
- [X] T022 [US2] Explain in the sign-in/settings UI that cross-device data requires the same email account in `src/ui/modals.ts`.

**Checkpoint**: Local data is neither silently uploaded nor cleared before acknowledged confirmation; users can optionally back it up first.

---

## Phase 5: User Story 3 - See Complete Account Data on Every Device (Priority: P1)

**Goal**: Account mode automatically synchronizes account-only changes and renders every pulled task and date-only time entry.

**Independent Test**: Use one account on two clients, create a task and dated entries on one, then verify all records render on the other after automatic sync; confirm a second account receives none of them.

### Tests for User Story 3

- [X] T023 [P] [US3] Add Worker contract tests requiring every pulled entry `date` to be exactly `YYYY-MM-DD` for PostgreSQL `DATE` inputs in `api/test/sync.contract.test.ts`.
- [ ] T024 [P] [US3] Add account-mode tests for automatic push/pull after accepted task, entry, and settings mutations in `tests/sync-engine.test.ts`.
- [ ] T025 [P] [US3] Add pull/render tests for entries arriving separately from their tasks, date-only matching, and cross-account isolation in `tests/sync-engine.test.ts`.

### Implementation for User Story 3

- [X] T026 [US3] Normalize every pulled PostgreSQL entry date to the exact `YYYY-MM-DD` wire format in `api/src/sync.ts`.
- [X] T027 [US3] On a successful account-mode entry, pull into only that email's cache before exposing it as the active dataset in `src/sync/engine.ts`.
- [X] T028 [US3] Schedule automatic account push/pull after accepted task, entry, and settings mutations and on startup, reconnect, and foreground in `src/sync/engine.ts` and `src/main.ts`.
- [ ] T029 [US3] Preserve pulled entries keyed by `taskId` even when pull ordering separates tasks and entries in `src/storage.ts` and `src/sync/engine.ts`.
- [X] T030 [US3] On sign-out, remove the account dataset from the active view, stop account sync, and resume a separate local-only dataset in `src/sync/engine.ts`, `src/main.ts`, and `src/ui/events.ts`.

**Checkpoint**: Same-account devices receive complete, rendered task/entry data automatically; different accounts remain isolated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Verify the full contract and release confidence.

- [X] T031 [P] Update mode-transition and same-email cross-device manual validation steps in `specs/003-storage-sync-modes/quickstart.md`.
- [X] T032 Run browser unit tests, Worker typecheck/tests, and production build; resolve failures in `tests/`, `api/test/`, and affected source files.
- [ ] T033 Perform the quickstart browser validation, including optional CSV backup, cancel, confirmed transition, sign-out, and two-device entry rendering, following `specs/003-storage-sync-modes/quickstart.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependency.
- **Foundational (Phase 2)**: Depends on T001–T003 and blocks all stories.
- **US1 (Phase 3)**: Depends on Phase 2.
- **US2 (Phase 4)**: Depends on Phase 2; it may follow US1 because both alter `src/sync/engine.ts`.
- **US3 (Phase 5)**: Depends on Phase 2; it should follow US2 to exercise the final account-mode lifecycle.
- **Polish (Phase 6)**: Depends on the selected user stories.

### User Story Dependencies

- **US1**: Independently validates signed-out behavior after the foundation.
- **US2**: Independently validates safe entry from local mode to account mode.
- **US3**: Independently validates the complete signed-in data contract after account entry exists.

### Parallel Opportunities

- T002 and T003 can run in parallel.
- Within US1, T009 and T010 can run in parallel.
- Within US2, T014–T016 can run in parallel.
- Within US3, T023–T025 can run in parallel.
- T031 may run alongside final code review, while T032 and T033 stay sequential validation gates.

## Parallel Example: User Story 3

```text
Task: "Add Worker date-only contract coverage in api/test/sync.contract.test.ts"
Task: "Add automatic-sync lifecycle coverage in tests/sync-engine.test.ts"
Task: "Add account isolation and delayed-entry rendering coverage in tests/sync-engine.test.ts"
```

## Implementation Strategy

### MVP First

1. Complete Setup and Foundational work.
2. Complete US1 and prove signed-out local-only behavior.
3. Complete US2 and prove safe, non-destructive account entry.
4. Complete US3, then deploy only after the Worker date contract and cross-device data are verified.

### Incremental Delivery

Each phase ends with an independently testable behavior: private local use, safe transition, then complete account synchronization. Avoid mixing local records into an account cache at every stage.

## Format Validation

All 33 tasks use the required checkbox, sequential ID, optional `[P]`, story label for story tasks, and exact file path format.
