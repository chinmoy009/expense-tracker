# Feature Backlog

Status key: **Parked** = agreed to exist, not started. **Approved** = decided, waiting for its phase.

## A. New features (Parked)

These add behavior that does not exist today, so each needs sign-off before it is built.

| # | Feature | Area | Notes |
|---|---|---|---|
| A1 | Multi-select rows with bulk delete | Expenses grid | Confirm dialog with count. Sheets deletes run one by one unless batched. |
| A2 | Export filtered view to CSV | Expenses grid | Exports the rows currently shown after filters and sort. |
| A3 | Column visibility toggle | Expenses grid | Stored per user in localStorage. |
| A4 | Keyboard shortcuts | Global | `N` = add expense, `/` = focus search, arrow keys and Enter in grid. |
| A5 | Global command palette (Ctrl/Cmd+K) | Global | Optional. Only if the page search is not enough. |
| A6 | Click a doughnut slice to filter by category | Chart | Reuses the existing category filter. |
| A7 | Bank and loan CSV export | Banks, Loans | Same pattern as A2. |

## B. UI/UX redesign decisions (Approved, implemented)

Source: redesign proposal, decisions recorded by the product owner.

| Decision | Choice |
|---|---|
| UI library | Angular Material (v17-compatible), custom brand theme |
| Layout | Top bar, collapsible left rail on desktop, bottom tab bar on mobile |
| Account | Google sign-in in the top bar, avatar menu with name, email and sign-out |
| Search | Search field and filter chips above the grid (no separate top-bar search) |
| Results | Shared data grid with sort, pagination, row actions. Cards on mobile |
| Chart | Keep the doughnut, in a sticky right-hand panel |
| Theme | Dark and light, with a user-facing toggle |
| Dialogs | In-app dialogs replace native `confirm`, `alert`, `prompt` |
| Scope rule | Phases 0–5 are presentation-only. Services and Sheets schema are unchanged |

### Phases (status)
0. Parity checklist and baseline capture — done (`docs/PARITY_CHECKLIST.md`)
1. Theme tokens (dark and light), Material setup, app shell — done
2. Expenses page (filter bar, grid, chart panel, KPI row, category side sheet, dialogs) — done
3. Banks page — done
4. Loans page — done
5. Responsive QA (390 and 1366px checked), empty and error states — done; 768px and full a11y audit still open
6. Parked features from section A, each approved individually — not started

## C. Open items

- Banks and Loans tables scroll horizontally on phones; they do not switch to cards yet.
- Expenses filter block is tall on phones (stacked fields).
- Sign-in-only flows (sheet CRUD, statement, import, bank and loan saves) are not verified end-to-end, because the sandbox has no Google access.

## D. Known issues not in scope of the bug-fix pass

- Import reloads the whole page on close.
- Sign-out keeps Banks and Loans data in memory until reload.
- Category import from Spending requires sign-in.
