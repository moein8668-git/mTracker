# main-mail deployment configuration

Deploy only `worker.js` as the direct main-mail Worker entry point. Do not add a database binding.

Create a KV namespace and bind it as `MAIL_REPLAY_KV`.

Set as secrets: `RESEND_API_KEY`, `API_SECRET`, `MAIL_SIGNING_PUBLIC_KEY`, and optionally
`MAIL_PREVIOUS_PUBLIC_KEY`. Set variables: `MAIL_FROM`, `MAIL_SIGNING_KEY_ID`, and, only during
key rotation, `MAIL_PREVIOUS_KEY_ID` plus epoch-millisecond `MAIL_PREVIOUS_KEY_EXPIRES_AT`.

The mTracker Worker must use the same `API_SECRET`, its matching private signing key, and matching
key ID. Apply `server/migrations/002_otp_delivery_attempts.sql` before deploying mTracker. Configure
an edge WAF/rate-limit rule for `POST /send`; it is additive and never replaces Worker validation.

Never put secrets, signatures, OTPs, full recipient addresses, or Resend response bodies in source,
logs, analytics, or screenshots.

Generate the key material outside the repository. `MAIL_SIGNING_PRIVATE_KEY` is base64 DER PKCS#8;
`MAIL_SIGNING_PUBLIC_KEY` is base64 DER SPKI. Both standard forms are supported by Web Crypto.
