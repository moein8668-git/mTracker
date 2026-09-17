# Account Lifecycle UI Contract

| State | Header control | Storage result |
|---|---|---|
| Signed out | Visible login icon; accessible login label; opens login settings. | Only local-only dataset is available. |
| Pending transition | Login settings shows a blocking deletion warning and CSV-backup action. | Local-only data remains intact. |
| Signed in | Account initial and status indicator. | Only current account cache is active. |
| Signed out after logout | Login icon is restored. | Current account cache, dirty metadata, cursor, and auth are absent. |

If cache deletion fails, logout reports failure and does not present a completed signed-out state.
