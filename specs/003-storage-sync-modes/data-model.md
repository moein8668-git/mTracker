# Data Model: Storage and Sync Modes

| Entity | Rule |
|---|---|
| Local-only dataset | Current browser data while signed out; contains no sync metadata. |
| Account cache | Browser data scoped to one normalized email, including cursor and dirty IDs. |
| Active mode | Exactly `local` or `account`; chooses the only visible dataset. |
| Transition backup | User-requested CSV snapshot before confirmed local-data removal. |
| Account import | Explicit signed-in CSV import that becomes normal synced changes. |

```text
signed out → local-only
verified login + empty local → account cache → pull
verified login + local data → backup/confirm → clear local → account cache → pull
sign-out → local-only; account cache hidden
```

Every account entry date is `YYYY-MM-DD` and remains linked by `taskId`, including when tasks and
entries arrive in separate pull pages.
