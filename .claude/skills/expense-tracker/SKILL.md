---
name: expense-tracker
description: Current-state reference for the Lumina expense tracker (Angular 17 SPA; expenses, bank accounts, loans, categories; persisted to one Google Sheet). Use before any enhancement, redesign, refactor or bug fix in this repo.
---

# Lumina Expense Tracker — Current State

## 1. Overview
- Frontend-only Angular 17.3 SPA. Standalone components, no NgModules. RxJS BehaviorSubjects for state. chart.js for the doughnut.
- Persistence: one hardcoded Google Spreadsheet via Sheets API v4 (`gapi.client`). Auth via Google Identity Services (OAuth access token, scope `spreadsheets`).
- No backend. No state library. No tests (no `*.spec.ts` exists).
- Hash routing (`withHashLocation`). Deployed to GitHub Pages under `/expense-tracker/`.

## 2. Commands and build
- `npm start` (ng serve). `npm run build`. `npm run deploy` (angular-cli-ghpages).
- CI `.github/workflows/deploy.yaml`: on push to `main` → `npm ci` → `npm run build -- --configuration production --base-href /expense-tracker/` → publish `dist/lumina-tracker/browser`.
- tsconfig: `strict`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature`, `strictTemplates`.
- Budgets: component styles warn 6kb / error 10kb. Initial bundle warn 500kb / error 1mb.

## 3. Config — `src/app/config.ts`
- `environment.google.clientId`, `environment.google.spreadsheetId` (single sheet owned by one user), `scope` = `https://www.googleapis.com/auth/spreadsheets`.
- Only one environment object; `production: false` for every build.

## 4. Source map
| Path | Responsibility |
|---|---|
| `main.ts`, `app.config.ts`, `app.routes.ts` | Bootstrap. `provideRouter(routes, withHashLocation())`. Routes: `/expenses` → DashboardComponent; `/banks` → BankDashboardComponent; `/loans` → lazy LoanDashboardComponent; `''` and `**` → `/expenses`. |
| `app.component.ts` (inline template) | Shell. Sidebar nav (Expenses, Banks, Loans; Reports and Settings are disabled placeholders), sidebar user block, sign-out. Header: greeting, currency toggle, date, sign-in button. |
| `services/google-api.service.ts` | Injects gapi + GIS `<script>`s at runtime. Holds `tokenClient`. `user$` emits a gapi-like shim object (`getBasicProfile().getName()` etc.). `signIn()`, `signOut()`. |
| `services/sheets.service.ts` | **Only** class that calls the Sheets API. Per-module CRUD, `ensure*Tab` bootstrap, expense import, category ops. |
| `services/expense.service.ts` | Expense state. Signed in → Sheets. Signed out → localStorage `lumina_expenses`. |
| `services/category.service.ts` | Category tree (flat rows → nested). Add, rename, delete, import, auto-sync. |
| `services/analytics.service.ts` | Filter state + derived `result$` (total, filteredExpenses, categoryDistribution, dailyTrend). |
| `services/bank.service.ts` | Bank and bank-transaction state, balances, statement. |
| `services/loan.service.ts` | Loan transaction state, receivables, payables. |
| `services/settings.service.ts` | Currency `USD` \| `BDT`. Persisted in localStorage key `currency`. |
| `models/bank.model.ts`, `models/loan.model.ts` | `Bank`, `BankTransaction`, `LoanTransaction`, `LoanSummary`. `Expense` is declared in `expense.service.ts`. |
| `components/dashboard` | Expenses page. search-filter, Total Spend and Daily Average cards, Categories toggle, Import Sheets button, chart, transaction-list, FAB, add-expense modal, import modal. |
| `components/add-expense-modal` | Add or edit expense. Formula amount input. Category drill-down picker. |
| `components/transaction-list` | Activity list (sorted by date desc). Edit emits to dashboard. Delete uses `confirm`. |
| `components/search-filter` | Note text search, month and year selects, specific date, category tree select. |
| `components/chart` | Doughnut of `categoryDistribution`. |
| `components/summary-card` | KPI card (title, amount, icon, trend text). |
| `components/category-manager` | Tree UI. New (root or sub), rename (`prompt`), delete (`confirm`), import from Spending. |
| `components/import-modal` | Import expenses from other spreadsheets. |
| `components/currency-selector` | Currency toggle. Only component with `templateUrl`. |
| `components/bank-dashboard` | Tabs: Accounts, Transactions, Statement. Hosts bank-form and bank-transaction-form. |
| `components/bank-form`, `components/bank-transaction-form` | Bank and transaction modals. |
| `components/loan-dashboard`, `components/loan-transaction-modal` | Loans page and modal. |

Dead scaffold files (not referenced; components use inline templates): `app.component.html`, `dashboard.component.html`, `add-expense-modal.component.html`, `transaction-list.component.html`. Each contains "works!" or placeholder markup. Empty 0-byte CSS files: `app.component.css`, `dashboard`, `add-expense-modal`, `transaction-list`, `search-filter`, `summary-card`, `chart`, `category-manager`, `import-modal`. Untracked empty folder `temp_gh_pages_check/`. `build_output.txt` is a tracked log.

Styling: global `src/styles.css` defines CSS variables on `:root`: `--accent-primary` (#f72585 pink), `--accent-secondary` (#4cc9f0 blue), `--glass-bg`, `--glass-border`, `--text-secondary`, `--font-main` (Outfit). Font Awesome 6.4 via CSS `@import`. Component styles are inline `styles: []`. `.app-container` caps width at 480px (mobile-first, applies to all pages).

## 5. Google Sheet schema (tab names are exact)
| Tab | Read / write range | Columns |
|---|---|---|
| `Spending` (main) | `A:F` | `ID(number) \| Date(YYYY-MM-DD) \| Category(NAME) \| Amount \| Note \| BankId` |
| `Categories` | `A:C` | `CategoryID \| CategoryName \| ParentCategoryID` (top-level = `NULL`) |
| `Banks` | `A:M` | `ID(B001) \| Bank Name \| Bank Code \| Account Name \| Account Number \| Account Type \| Home Branch \| Branch Zone \| Branch District \| Opening Balance \| IsClosed(TRUE/FALSE) \| CreatedAt \| UpdatedAt` |
| `Bank Transactions` | `A:H` | `Bank ID \| Transaction Type(DEBIT\|CREDIT) \| Amount \| Date \| Details \| Transaction ID(TX…) \| CreatedAt \| UpdatedAt` |
| `Loan Transactions` | `A:H` | `ID(LTX-…) \| Name \| User Received \| User Gave \| Date \| Medium \| CreatedAt \| UpdatedAt` |

- `Spending` is discovered at runtime: the first tab whose title is not `Categories`. Default name until first read is `Spending`. The tab is never auto-created.
- `ensureCategoriesTab`, `ensureBanksTab`, `ensureBankTransactionsTab`, `ensureLoanTransactionsTab` run on sign-in. They create the tab and header row only if the tab is missing.
- All writes use `valueInputOption: USER_ENTERED`.
- Update and delete address rows by `sheetRow = indexInFetchedArray + 2`, which assumes the header is row 1. Delete uses `batchUpdate.deleteDimension` with `sheetId` looked up by title on each call.

## 6. Persistence and auth modes
- **Signed out:** only Expenses work, backed by localStorage `lumina_expenses`. Categories, Banks and Loans are not loaded and cannot be written (no token). The category tree is empty, so an expense cannot be saved.
- **Signed in** (`user$` non-null): Expenses come from `Spending`. Category, Bank and Loan services run `init()` once (ensure tab → load). ExpenseService reloads on every `user$` emission. No migration from localStorage to the sheet.
- Sign-in: GIS `requestAccessToken()` popup. Profile fetched from `googleapis.com/oauth2/v3/userinfo`. No token persistence and no refresh.
- Sign-out: revokes token, sets `user$` to null. Expenses fall back to localStorage.
- SheetsService reads catch errors and return `[]` or `-1` (console only). Writes log and rethrow.

## 7. Module behavior
### Expenses
- **Add:** `id = max(in-memory ids) + 1`. Optimistic insert, then Sheets `append` (or localStorage). On failure: revert and `alert`.
- **Edit:** optimistic replace, then Sheets update (row found by `findRowIndexById`). Revert and `alert` on failure.
- **Delete:** `confirm()` in transaction-list, optimistic remove, then Sheets `deleteDimension`. Revert and `alert` on failure.
- **Amount:** `=`-prefixed formula evaluator supporting `+ - * /` and parentheses. Division by zero is an error. Result must be > 0.
- **Category picker:** drill-down tree. Only leaf nodes are selectable. Edit mode does not restore the breadcrumb path.
- **Date default:** `new Date().toISOString().split('T')[0]`.
- **Import (Dashboard → Import Sheets):** input is spreadsheet IDs, one per line. For each source spreadsheet and each tab, reads `A:D`. Columns: Date, Purpose → Category (default `Uncategorized`), Expense → amount (non-numeric chars stripped), Description → Note. Skips rows missing date or amount. Dedupes by signature `date-amount-note` against existing rows and within the batch. Appends to `Spending!A:E` with `id = Date.now() + Math.random()`. Closing the modal calls `window.location.reload()`.

### Filters and analytics (AnalyticsService)
- Defaults: current month and year. `specificDate`, when set, overrides month and year.
- Month and year apply only when `startDate` and `endDate` are unset. The search-filter always leaves those null, so they are effectively unused.
- Note search: case-insensitive `includes` on `note`.
- Category filter: selected node plus all descendants, matched by category **name**.
- Outputs: `total`, `filteredExpenses`, `categoryDistribution` (feeds the chart), `dailyTrend` (not rendered).
- Dashboard cards: Total Spend = `total`. Daily Average = `total / 30` (hardcoded).

### Categories (CategoryService + sheet)
- Flat rows → tree. Orphaned parents become roots.
- Add: case-insensitive duplicate check under the same parent. A duplicate is a silent no-op. ID = base36 timestamp + random.
- Rename: updates the `Categories` cell, then calls `expenseService.updateExpense` once per expense with the old name, sequentially.
- Delete: blocked with `alert` if any expense uses the name or the node has children.
- Auto-sync: on the first non-empty expense load after category init, any expense category name missing from the tree is added as top-level.
- "Import from Spendings": adds Spending category names not already present, as top-level.

### Banks
- Bank ID `B001`-style = max + 1 from the in-memory list.
- Form fields: bankName, bankCode, accountName, accountNumber required. Account type is one of Savings, Current, Salary, Credit Card. `openingBalance` is locked on edit.
- Close = `isClosed = true` (no delete). Closed banks are hidden from the transaction bank dropdown and stay listed (greyed). They remain in the statement dropdown.
- Transaction ID = `TX` + base36 uppercase timestamp. Fields: type DEBIT or CREDIT, amount > 0, date, details. Bank is locked on edit. Delete uses `confirm`.
- Balance (all time) = `openingBalance + Σ CREDIT − Σ DEBIT`.
- Statement (bank, start, end, type, details):
  - Opening = `openingBalance` + transactions dated before `start`.
  - Rows = dates in `[start, end]` inclusive, sorted by date string.
  - Type and details filters applied first, then running balance computed.
- Default statement range: first of current month through today (UTC `toISOString`).
- Copy details button → `navigator.clipboard`.

### Loans
- Transaction: `name`, type `GAVE` → `userGave = amount`, or `RECEIVED` → `userReceived = amount`, `date`, `medium`. Medium is `Cash`, a bank ID, or custom text. ID = `LTX-<last 6 of ms>-<0–999>`.
- Per-person net, grouped by exact `name`:
  - Receivable = gave − received, shown when > 0.
  - Payable = received − gave, shown when > 0.
  - Totals shown on the top cards.
- Medium dropdown: Cash, all banks, and previously used custom mediums. A custom medium is any value that is not `Cash` and does not start with `B`.

### Shell and settings
- Currency USD (`$`) or BDT (`৳`). Display only, no conversion. Persisted in localStorage `currency`. Applied through the `currency` pipe on every page.

## 8. Conventions (follow these)
- State: one BehaviorSubject per service, exposed as `xxx$`. Components subscribe directly. Most subscriptions have no teardown.
- Service init: subscribe to `googleApi.user$` with `filter(truthy)`, guarded by an `isInitialized` flag. ExpenseService is the exception.
- Every SheetsService method starts with `await googleApiService.ensureInitialized()`.
- Write strategy differs by module:
  - Expenses: optimistic update with revert.
  - Banks, Loans, Categories: await the sheet write, then update the local subject.
- Row operations: find the index in the cached list, then `sheetRow = index + 2`.
- Components: inline `template` and `styles`. Modals use a fixed `.modal-overlay` with `[class.active]`. Modal API: `open(item?)`, `closeModal()`, emits `closeEvent` or `saved`.
- Native dialogs: `confirm`, `alert`, `prompt`.
- Icons: Font Awesome `fa-solid fa-…`.
- Currency rendering: `| currency: (currency$ | async) || 'USD'`.
- IDs are strings everywhere except `Expense.id` (number).
- Category import has `console.log('DEBUG…')` lines. Remove them when touching that code.

## 9. Known defects and risks (highest impact first)
1. **Signed-out mode cannot add an expense.** Categories load only after sign-in, and the save button needs a category.
2. **Statement running balance is wrong when filtered.** Type and details filters run before the running balance is computed.
3. **Local-date bug.** `toISOString().split('T')[0]` gives the UTC date. In UTC+ zones (for example BDT, UTC+6), before local-offset hours it returns the previous day. Used for expense date, bank tx date, loan date and statement dates. Analytics parses `YYYY-MM-DD` with `new Date()` (UTC) and reads month with local getters, which shifts month boundaries in UTC− zones.
4. **Daily Average = total / 30** regardless of selected period.
5. **Silent read failures.** Reads return `[]`, so an expired token or missing permission shows an empty UI with no message.
6. **Reads always skip row 1** for Categories, Banks, Bank Transactions and Loan Transactions. If the header is missing, the first record is lost. Only Spending checks for an `ID` header.
7. **Row-index addressing.** Updates and deletes use positional indexes. Manual sorting or inserting in the sheet makes them hit the wrong row. Delete is fetch-then-delete with no atomicity.
8. **Expense ID collisions.** IDs are max + 1 from the in-memory list, so two devices or tabs can collide. Import IDs are `Date.now() + Math.random()`, which are non-integers mixed with integers. `findRowIndexById` uses loose `==`.
9. **Wrong tab risk.** Spending = first tab not named `Categories`. Reordering tabs changes the target. `addExpense` before `getExpenses` writes to the default `Spending` name.
10. **Category rename is N sequential writes.** Each expense update does an extra read and a write. Expenses bind categories by **name**, so same-name categories under different parents merge in analytics.
11. **Loan validation gaps.** Zero or negative amounts are accepted. Medium shows the raw bank ID (for example `B001`). A custom medium starting with `B` is hidden from the dropdown. Submit is not awaited, and there is no error UI.
12. **Bank transaction errors are unhandled.** The service throws on invalid amount or closed bank. The form does not catch it, so the modal stays open with no message. `updateTransaction` has no validation.
13. **Auth.** No token refresh. Tokens expire (about 1h), after which operations fail. No migration of localStorage expenses into the sheet.
14. **Sheet value formats.** Writes use `USER_ENTERED`, so a note starting with `=` becomes a formula. Reads use formatted values. `Number()` and the ISO date assumption break if the sheet's number or date format changes.
15. **Subscription leaks.** Most components and services never unsubscribe (dashboard, transaction-list, loan modal, currency-selector, summary-card, and others).
16. **Inconsistent error UX.** Expense and category writes alert. Bank and loan failures are console-only.
17. **Category add duplicate** is a silent return. `getParentName()` always displays "Parent".
18. **Hardcoded config.** One spreadsheet ID and one client ID, with `production: false` in every build.
19. **Import.** Dedupe is by exact string signature, so a date format mismatch creates duplicates. Closing the modal reloads the whole page.

## 10. Dead or unused code (verify before removing)
- ExpenseService: `getDailyTotal()`, `getMonthlyTotal()`, `getCategoryTotals()`. No callers.
- GoogleApiService: `isInitialized` getter. No callers.
- `Expense.bankId` / Spending column F: never set by any UI path.
- SearchFilter `startDate` / `endDate`: always null.
- `AnalyticsResult.dailyTrend`: computed, never rendered.
- LoanDashboard `refresh()`: empty body.
- SummaryCard `showProgress` / `progress` inputs: never bound.
- Scaffold HTML and empty CSS files listed in section 4.
- Unused package dependencies (no imports in `src`): `@angular/animations`, `@angular/platform-browser-dynamic`.

## 11. Change recipes
- **New Sheet-backed module:** add tab name and `ensure*Tab` → `get/add/update/delete` in SheetsService (row = index + 2) → model in `models/` → service with `user$` init and BehaviorSubject → component with inline template.
- **Change a column:** SheetsService only. Update the range, the read mapping, the write array, and the header in `ensure*Tab`. Existing sheets need a manual migration because there is no migration code.
- **New route or nav item:** `app.routes.ts` plus the inline template in `app.component.ts`.
- **Shared data changes:** keep the gapi-shaped `user$` shim intact, because templates call `getBasicProfile()` methods.
