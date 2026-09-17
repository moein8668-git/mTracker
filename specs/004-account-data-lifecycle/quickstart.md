# Validation Guide: Account Data Lifecycle and Login Entry

1. Sign in, load account tasks/entries, sign out, reload, and inspect browser storage: the current
   account cache, cursor, dirty metadata, and auth record must be absent.
2. Start local-only, create a task and entry, verify login, and confirm the dedicated warning says
   local data will be deleted and offers CSV backup. Cancel and verify both records remain.
3. Repeat, take an optional CSV backup, confirm, and verify local records are removed only after
   account data is available.
4. While signed out, verify the header login icon is visible, keyboard-accessible, and opens login
   settings. Sign in and verify it changes to account status.

```powershell
Set-Location K:\mTracker; npm test; npm run build
```
