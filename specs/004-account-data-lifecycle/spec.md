# Feature Specification: Account Data Lifecycle and Login Entry

**Feature Branch**: `004-account-data-lifecycle`

**Created**: 2026-09-17

**Status**: Draft

**Input**: User description: "Delete account data from browser storage on sign-out, make the
local-data backup warning unmistakable before login, and show a login icon in the signed-out sync
control."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Remove Account Data on Sign-Out (Priority: P1)

As a signed-in user, I can sign out knowing that my account's tasks, entries, preferences, and
sync state are removed from this browser, not merely hidden.

**Why this priority**: Leaving account data in browser storage after sign-out creates a privacy
risk for a shared device.

**Independent Test**: Sign in, load account records, sign out, inspect browser storage, and reload.
Confirm that no account-specific records or sync metadata remain and the app opens in empty
local-only mode.

**Acceptance Scenarios**:

1. **Given** a signed-in user with account data visible, **When** they sign out, **Then** the app
   removes that account's cached records and synchronization metadata from browser storage.
2. **Given** a user has signed out, **When** they reload the app, **Then** account tasks, entries,
   and preferences are not restored or visible.
3. **Given** a user had separate local-only records before signing in, **When** they sign out after
   entering account mode, **Then** the app opens the empty local-only dataset required by the
   existing destructive-transition policy.

---

### User Story 2 - Understand Local Data Backup Before Login (Priority: P1)

As a local-only user with tasks or time entries, I clearly see that signing in will delete those
local records and can take a CSV backup before choosing whether to continue.

**Why this priority**: The destructive mode change must be understandable before the user accepts
it, so users can preserve work they want to keep.

**Independent Test**: Create local tasks and entries, complete login verification, and confirm a
dedicated warning appears before account entry. Download the offered backup or cancel, then verify
local records remain until explicit confirmation.

**Acceptance Scenarios**:

1. **Given** local-only tasks or entries exist, **When** login verification succeeds, **Then** a
   blocking warning explicitly says local data will be deleted and offers CSV backup.
2. **Given** the warning is visible, **When** the user downloads CSV or cancels, **Then** local
   records remain unchanged.
3. **Given** the warning is visible, **When** the user explicitly acknowledges deletion and
   continues, **Then** account entry begins and local records are removed only after account data
   is successfully available.

---

### User Story 3 - Recognize the Login Entry Point (Priority: P2)

As a signed-out user, I see a recognizable login icon in the synchronization control and can use
it to open the login settings.

**Why this priority**: A hidden synchronization control makes account login difficult to discover.

**Independent Test**: Open the app signed out and confirm the control is visible, has an accessible
login label, contains a login icon, and opens the login settings when activated.

**Acceptance Scenarios**:

1. **Given** the user is signed out, **When** the app is displayed, **Then** the synchronization
   control is visible with a login icon and an accessible label describing login.
2. **Given** the signed-out login control is activated, **When** the user selects it, **Then** the
   login/settings dialog opens.
3. **Given** the user is signed in, **When** the account state is shown, **Then** the control shows
   account sync status rather than the signed-out login icon.

### Edge Cases

- If storage deletion fails, the app reports the failure and does not report a successful sign-out.
- If backup download is blocked, the warning remains open and local records remain unchanged.
- If account initialization fails after confirmation, local records remain available and the user
  receives a clear error.
- If the signed-out control is viewed with assistive technology, its label identifies it as login,
  not as account synchronization status.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: On sign-out, the app MUST delete the active account's cached tasks, entries,
  preferences, sync cursor, dirty-state metadata, and authentication state from browser storage.
- **FR-002**: After sign-out and reload, the app MUST display only the empty local-only dataset and
  MUST NOT reveal account data previously visible in that browser.
- **FR-003**: When verified login follows local-only use containing one or more tasks or entries,
  the app MUST present a blocking warning before account entry.
- **FR-004**: The warning MUST explicitly state that local records will be deleted and MUST offer a
  CSV backup action before confirmation.
- **FR-005**: Backup download, cancellation, or account-startup failure MUST retain local records.
- **FR-006**: The signed-out synchronization control MUST remain visible, show a recognizable login
  icon, and expose an accessible label identifying it as the login action.
- **FR-007**: The signed-in synchronization control MUST continue to show account status and MUST
  not present the signed-out login icon.

### Key Entities *(include if feature involves data)*

- **Account browser cache**: Account-only records and synchronization state stored in one browser.
- **Local-only dataset**: Records available while signed out and separate from account data.
- **Login transition warning**: The blocking decision point that offers backup before destructive
  local-data removal.
- **Login control**: The visible signed-out action that opens account login.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In sign-out tests, 100% of account cache and synchronization keys are absent after
  logout and reload.
- **SC-002**: In local-data login tests, 100% of users see the backup/deletion warning before any
  local record is removed.
- **SC-003**: In signed-out UI tests, the login control is visible, accessible, and opens login in
  100% of tested desktop and mobile viewports.
- **SC-004**: In backup-blocked and account-startup-failure tests, 100% of local tasks and entries
  remain available.

## Assumptions

- Account data is removed only from this browser; it remains in the user's synchronized account.
- The existing CSV format is the offered backup and explicit restoration format.
- The signed-out login control reuses the existing settings/login entry flow.
