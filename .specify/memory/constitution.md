<!--
Sync Impact Report
- Version change: 3.1.0 to 3.2.0
- Modified principles: I. Two-Worker Boundaries and Deployment; V. Narrow, Testable, Observable
  Delivery and Storage Modes; Local-Only and Account-Sync Data Modes
- Added sections: none
- Removed sections: none
- Follow-up TODOs: TODO(RATIFICATION_DATE) requires the original adoption date.
-->

# mTracker Constitution

## Core Principles

### I. Two-Worker Boundaries and Deployment

The `mtracker` Worker and `main-mail` Worker MUST remain separate services with
explicit responsibilities. `mtracker` owns application behavior, including transactional
delivery-rate enforcement, while `main-mail` only validates trusted delivery requests and
sends approved messages through Resend.
`main-mail` MUST NOT gain an mTracker database connection or contain mTracker-specific
authentication, OTP, or business logic. This boundary keeps authentication authority
in one place and makes delivery independently replaceable.

The main `mtracker` Worker source MUST be maintained in GitHub and deployed through
its Cloudflare Worker integration with that repository. The mail/proxy Worker MUST be
deployed from the single self-contained entry file `email-worker/worker.js`. Changes
to one deployment path MUST NOT silently alter the other path's source of truth or
release process.

`mtracker` MUST provide two mutually exclusive data modes: signed-out local-only use and
signed-in account-sync use. A browser MUST NOT silently combine local-only records with an
account’s cloud records. This makes ownership, recovery, and cross-device behavior unambiguous.

### II. Ownership of Authentication and Email Content

`mtracker` MUST own authentication flows, OTP generation, OTP storage, recipient
selection, email content construction, and OTP verification. It MUST send only an
approved login-code delivery request to `main-mail`. `main-mail` MUST NOT generate,
retrieve, confirm, or verify OTPs, nor expose an endpoint that could serve as an OTP
verification oracle. This preserves a single source of truth for authentication.

### III. Signed, Short-Lived Delivery Contracts

Every delivery request MUST travel over HTTPS and carry an Ed25519 signature produced
by an `mtracker` private signing key. `main-mail` MUST verify the corresponding public
key before contacting Resend; a valid `API_SECRET` alone MUST NOT authorize delivery.
`API_SECRET` MAY be retained as an additional deployment secret and early-rejection
control. The signature MUST cover a canonical serialization of the protocol version,
key ID, request ID, issue and expiry timestamps, account ID, signed source ID,
recipient, approved sender, message type or template ID, and a canonical hash of the
complete rendered message payload. Missing, malformed, modified, or unsupported
fields MUST cause rejection.

Signing keys MUST support rotation through a key ID: `main-mail` MAY accept the active
key and the immediately previous key only during a bounded rotation window. Private
keys MUST exist only in Worker secrets; public verification keys may be configured in
`main-mail`. This prevents outsiders from creating or altering authorized requests.

### IV. Replay, Abuse, and Secret Discipline

`mtracker` MUST create a distinct request ID with at least 128 bits of unpredictable
randomness for every attempted delivery; time-derived IDs alone are forbidden. The
relay MUST accept requests that expire no more than two minutes after issuance,
allowing only a small clock-skew tolerance, and MUST reject expired or implausibly
future-dated requests.

`main-mail` MUST record accepted request IDs in Cloudflare KV for five minutes and
reject a replay when that ID is visible before provider delivery. KV's eventual
consistency creates an explicitly accepted risk: a rare, simultaneous cross-location
replay may deliver another copy of the same signed message to the same signed
recipient. This exception MUST NOT enable OTP validation, content alteration,
recipient changes, database access, or arbitrary mail sending.

`mtracker` MUST enforce 3 emails per recipient per 15 minutes, 10 per signed source per
hour, and 20 per account per day using its Hyperdrive-backed database transaction before it
creates an OTP or requests delivery. `main-mail` MUST remain database-free and MUST NOT
duplicate that application rate-limit logic. Cloudflare edge WAF or rate-limit protection
MUST also protect the public relay route, but it MUST NOT replace the mTracker transaction
or relay-side authorization validation. Secrets, signatures, OTPs, message bodies, full
recipient addresses, provider credentials, and private keys MUST NOT be committed, returned,
or intentionally logged.

### V. Narrow, Testable, Observable Delivery and Storage Modes

`main-mail` MUST support only approved login-code message types, sender identities,
recipients, and rendered payloads defined by the signed request contract. It MUST
reject arbitrary sender addresses, content, subjects, recipients, and message types.
Responses MUST be minimal and generic: they MAY include a non-sensitive correlation
ID and delivery outcome, but MUST NOT disclose OTPs, verification state, credentials,
signature material, or whether rejection resulted from malformed authorization versus
replay protection.

Tests MUST exercise the externally observable `main-mail` delivery boundary using a
controlled Resend substitute where practical. They MUST cover valid signatures;
invalid, unknown-key, altered, expired, and unsupported requests; post-visibility
replays; redacted responses and logs; and the absence of relay OTP verification.
mTracker authentication-boundary tests MUST cover all delivery limits. Tests MUST document
the accepted concurrent KV race and MUST NOT
claim an atomic global exactly-once delivery guarantee. Structured security events
MUST distinguish acceptance, rejection, replay, rate limit, and provider failure
without retaining sensitive payload data.

While signed out, mTracker MUST store and operate on the browser's local-only dataset and MUST
not synchronize it. While signed in, mTracker MUST use only the authenticated account dataset,
automatically synchronizing every accepted change with that account. At the transition from
local-only to account-sync mode, the application MUST present a blocking, explicit warning that
local-only records will be deleted and MUST visibly offer CSV backup before the user can confirm
the transition. A CSV backup MAY later be restored into the signed-in account through an explicit
user action; it MUST NOT be imported implicitly.

## Architecture Constraints

The authoritative email flow is:

```text
User → mtracker transactionally applies delivery limits, creates OTP and message
     → signed HTTPS request → main-mail validates signature and replay → Resend → user's email
```

The signed source ID represents the originating mTracker login or request context and
MUST NOT be accepted from an unsigned client header. It supports per-source limits and
privacy-conscious investigations. HTTPS supplies transport confidentiality; whole
payload public-key encryption is out of scope unless a concrete requirement arises to
protect content from application-layer logging or intermediary inspection beyond TLS.

The deployment topology is also authoritative:

```text
GitHub repository → Cloudflare deployment integration → mtracker Worker
email-worker/worker.js → direct Cloudflare Worker deployment → main-mail proxy Worker
```

The direct mail/proxy deployment MUST use `email-worker/worker.js` as its complete
runtime entry point. It MUST remain independent of the GitHub-connected deployment
path for the main `mtracker` Worker.

### Local-Only and Account-Sync Data Modes

The local-only dataset belongs solely to the current browser storage. The account-sync dataset
belongs solely to the authenticated account and is the only dataset visible after sign-in. Signing
out MUST delete the authenticated account's browser cache and its sync metadata before returning
to local-only mode; it MUST NOT expose or retain account records in browser storage. The sign-in
transition is destructive for the active local-only dataset only after an explicit confirmation
that includes a visible CSV-backup option. Empty local storage may enter account-sync mode without
a backup warning, but the mode boundary remains explicit.

## Development Workflow

Email changes MUST identify the affected Worker, signed-request contract, secrets,
and deployment path. Reviews MUST verify that the correct key ownership, canonical
payload coverage, two-minute expiry, request-ID randomness, KV five-minute retention,
Hyperdrive-backed delivery limits, and log-redaction rules are preserved. Release notes MUST identify
which Worker changed and which deployment path was used.

Data-mode changes MUST test signed-out local-only behavior, signed-in automatic sync, local-data
backup warning and confirmation, local-data removal after confirmed sign-in, explicit CSV restore
to an account, sign-out isolation, and cross-device synchronization using the same account.

Before release, contract and end-to-end tests MUST demonstrate that a current OTP is
verified only by `mtracker` after a user submits it through the normal authentication
flow. Implementations MUST not introduce marketing, bulk, arbitrary third-party
email, browser-facing relay access, OTP redesign, a Resend replacement, whole-payload
encryption, or an atomic exactly-once storage system without first amending this
constitution.

## Governance

This constitution governs mTracker email architecture and overrides conflicting
informal practices. Amendments MUST state their motivation, affected principles,
compatibility impact, security trade-offs, and required contract, test, or migration
updates. An amendment affecting key authority, request signing, replay behavior, or
Worker responsibility MUST be reviewed with both Worker contracts before adoption.

Versioning follows semantic rules: MAJOR denotes a backward-incompatible removal or
redefinition of governance; MINOR denotes a new principle or materially expanded
governance; PATCH denotes clarifications and non-semantic corrections. Every
amendment MUST update the version and last-amended date. Compliance MUST be reviewed
during design, implementation review, and release review for email-related changes.

**Version**: 3.2.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date is unknown | **Last Amended**: 2026-09-17
