# Storage and Sync Mode Contract

| State | Active dataset | Network behavior |
|---|---|---|
| Signed out | Local-only browser data | No synchronization. |
| Signed in | Authenticated account cache | Automatic push/pull after mutation, startup, reconnect, and foreground. |

After verification, existing local data requires a blocking confirmation. CSV backup is offered but
not required; explicit confirmation acknowledges local-data removal. Cancellation or failed initial
account pull retains local mode. Sign-out hides account cache.

Every Worker pull entry returns `date` as exactly `YYYY-MM-DD`, never a timestamp.
