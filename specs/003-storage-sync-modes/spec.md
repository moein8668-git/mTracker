# Feature Specification: Storage and Sync Modes

**Feature Branch**: `003-storage-sync-modes`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Use either local storage while signed out or automatic account sync
while signed in, never both. Warn and offer CSV backup before clearing local data at sign-in. Also
fix synced time entries that fail to appear after login."

## Clarifications

### Session 2026-09-17

- Q: Must a user actually download the CSV backup before they can confirm account-sync mode? → A: Backup is offered, but confirmation may continue without downloading it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Local-Only Mode While Signed Out (Priority: P1)

As a signed-out user, I can create and manage tasks and time entries only in this browser without
creating an account or sending data to the service.

**Why this priority**: Local-only use remains a supported, private mode and must not become an
accidental partial-sync state.

**Independent Test**: Start signed out, create a task and a time entry, reload the app, and confirm
they remain available locally while no synchronization request is made.

**Acceptance Scenarios**:

1. **Given** a signed-out user, **When** they add or edit a task, entry, or setting, **Then** the
   change remains only in local browser storage.
2. **Given** a signed-out user with local data, **When** they reload or work offline, **Then** their
   local data remains usable and the app does not attempt account synchronization.

---

### User Story 2 - Enter Account-Sync Mode Safely (Priority: P1)

As a user with local work records, I can sign in knowing exactly what happens to those records and
can download a CSV backup before switching to my account’s synchronized dataset.

**Why this priority**: A mode transition that discards the active local dataset without warning
would risk irreversible user data loss.

**Independent Test**: Seed local tasks and entries, start sign-in, choose CSV backup, confirm the
transition, and verify the app displays only the account dataset afterward.

**Acceptance Scenarios**:

1. **Given** local-only data exists, **When** the user successfully verifies sign-in, **Then** the
   app shows a clear warning before clearing the active local dataset.
2. **Given** the warning is visible, **When** the user requests a backup, **Then** a CSV containing
   their local tasks and time entries is downloaded before any local data is removed.
3. **Given** the warning is visible, **When** the user chooses not to download a backup and confirms,
   **Then** the app clearly proceeds with the local-data removal warning acknowledged.
4. **Given** the warning is visible, **When** the user cancels, **Then** local-only mode and every
   local record remain unchanged.
5. **Given** the user confirms the transition, **When** account-sync mode starts, **Then** local
   records are removed from the active dataset and only that account’s synchronized records appear.

---

### User Story 3 - See Complete Account Data on Every Device (Priority: P1)

As a signed-in user, I see all of my account’s tasks and time entries after login and every accepted
change automatically synchronizes to my account for another device signed into the same email.

**Why this priority**: Missing time entries make the account dataset incomplete and undermine the
purpose of synchronization.

**Independent Test**: Sign in on two devices with the same account, add a task and multiple dated
time entries on one, then confirm the second device shows every task and entry after sync.

**Acceptance Scenarios**:

1. **Given** an account has existing tasks and time entries, **When** the user signs in, **Then**
   every record returned for that account is displayed, including entries belonging to loaded tasks.
2. **Given** a signed-in user changes a task, entry, or setting, **When** the change is accepted,
   **Then** synchronization starts automatically without a separate save or mode choice.
3. **Given** two users sign into different accounts, **When** either one synchronizes, **Then**
   neither can view the other account’s tasks or time entries.

### Edge Cases

- A user has no local data: successful sign-in enters account-sync mode without a backup warning.
- CSV backup download fails or is blocked: the app keeps local-only mode and does not clear data.
- Account synchronization fails during sign-in: the app keeps local-only data intact and clearly
  reports that account-sync mode did not begin.
- A task exists in an account but its entries arrive in a later synchronization response: entries
  appear when received and are not discarded because ordering differs.
- A user signs out: account data is removed from the active dataset before local-only mode resumes.
- A CSV is restored while signed in: it is an explicit account import and its resulting changes
  synchronize automatically; it is never silently mixed in at sign-in.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST expose exactly two mutually exclusive data modes: local-only while
  signed out and account-sync while signed in.
- **FR-002**: In local-only mode, task, entry, and settings changes MUST stay in browser storage
  and MUST NOT trigger account synchronization.
- **FR-003**: In account-sync mode, the active dataset MUST contain only the authenticated account’s
  records and every accepted task, entry, and settings change MUST synchronize automatically.
- **FR-004**: When local-only data exists after successful sign-in verification, the app MUST show a
  confirmation that explains the active local dataset will be cleared and offers CSV backup before
  the user can enter account-sync mode.
- **FR-004a**: The user MAY confirm account-sync mode without downloading the offered CSV backup,
  but the confirmation MUST explicitly acknowledge local-data removal.
- **FR-005**: The app MUST not clear local-only data until the user explicitly confirms the
  transition; cancellation, backup failure, or account-sync startup failure MUST retain it.
- **FR-006**: The CSV backup offered during transition MUST include local tasks and time entries in
  a form that the app can explicitly restore into the signed-in account later.
- **FR-007**: After confirmed account-sync entry, the app MUST fetch, retain, and display all
  returned account tasks and entries, even when tasks and entries arrive in separate responses.
- **FR-008**: An entry MUST remain associated with its account task after pull, refresh, reload,
  and rendering; no valid returned time entry may be omitted from the active account dataset.
- **FR-009**: Signing out MUST remove account data from the active dataset before returning to an
  empty local-only dataset.
- **FR-010**: The app MUST explain that a second device must use the same email account to see the
  same synchronized data.

### Key Entities *(include if feature involves data)*

- **Local-only dataset**: Tasks, entries, and settings retained only in one browser while signed out.
- **Account dataset**: Tasks, entries, and settings belonging to one authenticated account.
- **Data mode**: The explicit state selecting either the local-only dataset or the account dataset.
- **Transition backup**: User-requested CSV export of the local-only dataset before confirmed
  removal from the active dataset.
- **Account import**: An explicit restoration of a CSV into the authenticated account dataset.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In automated mode tests, 100% of signed-out changes remain local and make zero sync
  requests.
- **SC-002**: In transition tests with local data, 100% of sign-ins present the backup/confirmation
  step before local data is cleared; cancellation and backup failure retain all local records.
- **SC-003**: In two-device tests using the same account, 100% of created tasks and time entries
  appear on the second device after automatic synchronization.
- **SC-004**: In account-isolation tests, 100% of pulls return no tasks or entries belonging to a
  different account.
- **SC-005**: In rendering regression tests, 100% of returned valid time entries appear under their
  associated task after sign-in and refresh.

## Assumptions

- The existing CSV export and import format can represent every local task and time entry needed by
  the transition backup; any required format extension remains backward compatible.
- An explicit account import is allowed only after sign-in and is subject to the existing account
  synchronization rules.
- Account-sync mode starts only after login verification and a successful initial account pull.
- A user who wants the same data on multiple devices will use the same email account on each device.
