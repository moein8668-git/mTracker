# Research: Storage and Sync Modes

## Decision: Normalize entry dates at the Worker boundary

**Rationale**: PostgreSQL DATE values are serialized as timestamps, while the browser repository,
analytics, and views require `YYYY-MM-DD`. Tasks lack this field, which explains why tasks load
while time entries do not render.

**Alternatives considered**: UI-only normalization is rejected because it leaves the API contract
invalid for every other browser consumer.

## Decision: Separate local and account browser namespaces

**Rationale**: The current shared local dataset is marked dirty and uploaded on first login.
Per-mode/per-email namespaces prevent implicit import and cross-account data leakage.

**Alternatives considered**: A single dataset with sync disabled while signed out is rejected
because it cannot reliably enforce ownership boundaries.

## Decision: Offer CSV backup before explicit transition

**Rationale**: Users may download an export before local active data is removed, but may also
explicitly continue without a backup as clarified in the specification.

**Alternatives considered**: Automatically upload local data or clear it after OTP request are
rejected as unsafe and contrary to the constitution.
