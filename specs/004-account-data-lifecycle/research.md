# Research: Account Data Lifecycle and Login Entry

## Decision: Delete the departing account namespace only after switching to local mode

**Rationale**: Scope switching persists the prior dataset first. Therefore, logout must capture the
normalized email, switch the active repository to local mode, then delete that email's account
cache, dirty metadata, cursor, and auth state. The local-only namespace is never cleared by logout.

**Alternatives considered**: Clearing before switching is rejected because scope switching can
write the departing account cache back. Clearing all browser storage is rejected because it can
remove unrelated application state.

## Decision: Treat cache-deletion errors as incomplete logout

**Rationale**: Browser storage removal may fail. The application must stop displaying account data
and report cleanup failure instead of claiming that privacy cleanup completed.

**Alternatives considered**: Best-effort silent deletion is rejected because it misrepresents the
privacy result.

## Decision: Preserve the pending login transition and strengthen its warning

**Rationale**: The existing transition keeps local records intact until account pull succeeds. Its
copy and layout need to state deletion first, offer backup clearly, and retain the warning after a
backup download failure.

**Alternatives considered**: Clearing at OTP verification or before backup is rejected as data loss.

## Decision: Render the header control in explicit signed-out and signed-in states

**Rationale**: The existing control is hidden while signed out. It will instead render a decorative
login SVG with a login accessible name; signed-in rendering keeps the account initial and status
indicator with stable child markup.

**Alternatives considered**: A separate login button is rejected because it duplicates the existing
header affordance.
