# Data Model: Account Data Lifecycle and Login Entry

| Entity | Rules |
|---|---|
| Account browser cache | Scoped by normalized email; contains account tasks, entries, and preferences; deleted on sign-out. |
| Account sync metadata | Dirty queue and cursor for one normalized email; deleted together with its cache on sign-out. |
| Local-only dataset | Browser-local records; remains unchanged until confirmed account entry and is never deleted by account logout. |
| Pending login transition | Verified account credentials held only until the user cancels or confirms the backup/deletion warning. |
| Login control | Visible header action: login icon and login label while signed out; account status while signed in. |

```text
account mode → switch to local → delete account cache + dirty metadata + cursor + auth → local-only
local-only with data → verify OTP → warning/backup → confirm + account pull → account mode
```
