# Parity Checklist (UI redesign)

Every behavior below existed before the redesign and must still work. Check each one after every task.
Items marked **[sign-in]** need a Google sign-in with the account that owns the spreadsheet.

## Shell and auth
- [ ] Routes `#/expenses`, `#/banks`, `#/loans` load; unknown route goes to `#/expenses`
- [ ] Currency toggle switches USD ↔ BDT everywhere and persists after reload
- [ ] Sign in opens Google popup; profile name, email and avatar show
- [ ] Sign out clears the session; expenses fall back to local data
- [ ] Disabled placeholders (Reports, Settings) are not clickable

## Expenses
- [ ] Add expense: amount (formula supported, e.g. `=10+5*2`), date, category (drill-down tree), note
- [ ] Amount must be > 0; invalid formula shows an error
- [ ] Edit expense pre-fills all fields and saves
- [ ] Delete expense asks for confirmation, then removes it
- [ ] Failed save/update/delete reverts the UI and reports the error
- [ ] Search by note (case-insensitive contains)
- [ ] Period month and year filter; "All Months" / "All Years"
- [ ] Specific date overrides the period
- [ ] Category filter includes all sub-categories
- [ ] Reset returns filters to the current month and year
- [ ] Total Spend equals sum of filtered expenses
- [ ] Daily Average = total ÷ days in period (current month counts elapsed days)
- [ ] Doughnut shows category distribution of the filtered set
- [ ] List sorted by date, newest first, by default
- [ ] Empty state when no expenses match
- [ ] Default date is the local calendar day
- [ ] Signed out: categories can be created and used; expenses persist locally
- [ ] Categories: add top-level and sub-category; duplicate under same parent is ignored
- [ ] Categories: rename updates all expenses using the old name
- [ ] Categories: delete blocked when used by expenses or having children, with a message
- [ ] Categories: "Import from Spendings" reports count **[sign-in]**
- [ ] Import from spreadsheet IDs: progress log, summary, duplicates skipped **[sign-in]**

## Banks
- [ ] Add bank: name, code, account name and number required; type, opening balance, branch fields
- [ ] Edit bank; opening balance is locked on edit
- [ ] Close bank asks for confirmation; closed banks are greyed and excluded from the transaction dropdown
- [ ] Copy details copies the six fields to clipboard and reports success
- [ ] Balance = opening + credits − debits
- [ ] Log transaction: bank, type DEBIT/CREDIT, amount > 0, date, details
- [ ] Edit transaction (bank locked); delete asks for confirmation
- [ ] Statement: bank, start/end date, type, details filter
- [ ] Statement opening balance = opening + transactions before start
- [ ] Statement running balance is correct on every row, even when filters are applied
- [ ] Statement closing balance = balance after last transaction in range (unaffected by filters)
- [ ] Statement default range: first of month through today

## Loans
- [ ] Log loan: name required, Giving / Receiving, amount, date, medium (Cash, bank, or custom)
- [ ] Edit loan; delete asks for confirmation
- [ ] Totals: Receivable and Payable cards match per-person lists
- [ ] Receivable tab: people with positive balance owed to you
- [ ] Payable tab: people you owe
- [ ] Custom medium appears in later dropdowns
- [ ] Empty states for each tab
