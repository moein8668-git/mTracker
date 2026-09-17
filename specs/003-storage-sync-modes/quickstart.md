# Validation Guide: Storage and Sync Modes

1. Signed out: add task/entry, reload, and confirm local persistence with zero sync requests.
2. With local data: verify sign-in, cancel the confirmation, and confirm records remain.
3. Repeat, optionally download CSV, confirm, and verify account data replaces active local data.
4. Use the same account on two devices; add a dated entry on one and verify it renders on the other.
5. Sign out and verify account data is hidden; explicitly import CSV while signed in and confirm it syncs.

```powershell
Set-Location K:\mTracker; npm test
Set-Location K:\mTracker\api; npm run typecheck; npm test
```
