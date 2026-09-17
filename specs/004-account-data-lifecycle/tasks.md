---

description: "Actionable task list for Account Data Lifecycle and Login Entry"
---

# Tasks: Account Data Lifecycle and Login Entry

**Input**: Design documents from `specs/004-account-data-lifecycle/`

**Tests**: Required by the feature specification and constitution for account cleanup, destructive
transition, and accessible login entry behavior.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Establish auditable account-key cleanup and UI test helpers.

- [ ] T001 Add normalized account cursor-key and account-lifecycle cleanup helpers in `src/storage.ts`.
- [ ] T002 [P] Add deterministic account-cache, dirty-metadata, cursor, and auth fixtures in `tests/sync-engine.test.ts`.
- [ ] T003 [P] Add a lightweight header-control DOM fixture in `tests/syncchip.test.ts`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Ensure storage removal reports failure instead of silently claiming privacy cleanup.

- [ ] T004 Make account cache/metadata removal report success or failure without touching the local-only namespace in `src/storage.ts`.
- [ ] T005 Add storage tests for account-only cleanup and browser-removal failure in `tests/storage-mode.test.ts`.

**Checkpoint**: Account lifecycle code can delete all account keys or accurately report failure.

---

## Phase 3: User Story 1 - Remove Account Data on Sign-Out (Priority: P1) 🎯 MVP

**Goal**: Logout removes current-account browser data instead of merely hiding it.

**Independent Test**: Seed account cache/metadata and local data, sign out, reload a repository, and
verify account keys are absent while local-only behavior remains correct.

### Tests for User Story 1

- [ ] T006 [P] [US1] Add sign-out tests asserting account DB, dirty metadata, cursor, and auth are absent after reload in `tests/sync-engine.test.ts`.
- [ ] T007 [P] [US1] Add 401 forced-sign-out and cleanup-failure tests that prevent a false success state in `tests/sync-engine.test.ts`.

### Implementation for User Story 1

- [ ] T008 [US1] Capture departing account identity, switch to local mode, then delete that account's cache, dirty state, cursor, and auth in `src/sync/engine.ts`.
- [ ] T009 [US1] Reuse the same cleanup path for unauthorized-session handling in `src/sync/engine.ts`.
- [ ] T010 [US1] Surface logout cleanup failure rather than a success toast in `src/ui/events.ts`.

**Checkpoint**: Account records are absent from browser storage after successful logout and never remain visible in local mode.

---

## Phase 4: User Story 2 - Understand Local Data Backup Before Login (Priority: P1)

**Goal**: A user sees an unmistakable backup/deletion decision before leaving local-only mode.

**Independent Test**: Create local records, verify login, inspect the blocking warning, download CSV or
cancel, and confirm local records remain until confirmed account pull succeeds.

### Tests for User Story 2

- [ ] T011 [P] [US2] Add pending-transition tests for cancellation and failed account startup retaining local data in `tests/sync-engine.test.ts`.
- [ ] T012 [P] [US2] Add CSV export coverage proving local tasks and entries are included before transition confirmation in `tests/csv.test.ts`.
- [ ] T013 [P] [US2] Add warning copy/action DOM coverage for backup, cancel, and destructive confirmation in `tests/login-transition.test.ts`.

### Implementation for User Story 2

- [ ] T014 [US2] Rewrite the pending-transition warning to lead with local-data deletion and clearly state CSV backup/cancel preservation in `src/ui/modals.ts`.
- [ ] T015 [US2] Keep the warning open on backup failure and account-startup failure, with an actionable error message, in `src/ui/events.ts`.
- [ ] T016 [US2] Preserve the existing rule that local data is removed only after successful account initialization in `src/sync/engine.ts`.

**Checkpoint**: The destructive transition is understandable and recoverable without data loss.

---

## Phase 5: User Story 3 - Recognize the Login Entry Point (Priority: P2)

**Goal**: Signed-out users can find and access login directly from the header control.

**Independent Test**: Render the control signed out and signed in, checking visibility, icon, accessible
name, activation, and status rendering.

### Tests for User Story 3

- [ ] T017 [P] [US3] Add signed-out/signed-in rendering and accessible-name tests in `tests/syncchip.test.ts`.
- [ ] T018 [P] [US3] Add header-control activation coverage that opens login settings in `tests/login-transition.test.ts`.

### Implementation for User Story 3

- [ ] T019 [US3] Provide stable label and status-indicator markup for `#sync-chip` in `index.html`.
- [ ] T020 [US3] Render a visible login icon and login accessible label while signed out; preserve account status while signed in in `src/ui/syncchip.ts`.
- [ ] T021 [US3] Add login-icon and signed-in status styles without breaking the header control layout in `src/styles.css`.

**Checkpoint**: The signed-out login control is visible and accessible; account status remains clear after login.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T022 [P] Update lifecycle validation scenarios in `specs/004-account-data-lifecycle/quickstart.md`.
- [ ] T023 Run frontend tests, production build, and the manual browser storage/accessibility walkthrough from `specs/004-account-data-lifecycle/quickstart.md`.

---

## Dependencies & Execution Order

- **Setup → Foundational → US1**: Cleanup API must exist before lifecycle behavior.
- **US2** depends on the lifecycle boundary but can proceed after Phase 2.
- **US3** depends only on setup and can proceed after Phase 2, but follows US1 for one coherent header state.
- **Polish** follows all selected stories.

### Parallel Opportunities

- T002 and T003 can run together.
- T006 and T007 can run together.
- T011–T013 can run together.
- T017 and T018 can run together.

## Parallel Example: User Story 1

```text
Task: "Add sign-out key-removal coverage in tests/sync-engine.test.ts"
Task: "Add forced-session-expiry and cleanup-failure coverage in tests/sync-engine.test.ts"
```

## Implementation Strategy

1. Complete cleanup primitives and prove sign-out privacy first (US1).
2. Make the backup warning unambiguous (US2).
3. Add the discoverable login icon without changing signed-in status (US3).
4. Validate storage keys, transition recovery, and keyboard/screen-reader behavior before release.

## Format Validation

All 23 tasks use the required checkbox, sequential ID, optional `[P]`, story labels for story
tasks, and exact file paths.
