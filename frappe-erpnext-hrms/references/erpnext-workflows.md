# ERPNext Workflows Complete Reference

Comprehensive reference for ERPNext modules: Accounting, Stock, Selling, Buying, Manufacturing, CRM, Projects, Assets, and workflow patterns. Split by topic; each file is verified against installed ERPNext v16.6.1 source.

## Document Lifecycle (docstatus)

| Value | Status | Description |
|-------|--------|-------------|
| 0 | Draft | Not submitted, fully editable |
| 1 | Submitted | Finalized, creates ledger entries, limited edits |
| 2 | Cancelled | Reversed, entries cancelled, read-only |

## Topics

- [erpnext-architecture.md](erpnext-architecture.md) — Architecture overview, controller inheritance chain (`StatusUpdater` → `TransactionBase` → `AccountsController` → `StockController` → `SellingController`/`BuyingController`), event ordering, GL/SLE posting paths, naming series, source citations
- [erpnext-transaction-modules.md](erpnext-transaction-modules.md) — Accounting (GL Entry, Sales/Purchase Invoice, Payment Entry, Journal Entry, tax templates), Stock (Stock Entry, serial/batch, Delivery Note), Selling (Quotation → Sales Order pipeline), Buying (Purchase Order → Purchase Invoice pipeline)
- [erpnext-other-modules.md](erpnext-other-modules.md) — Manufacturing (BOM, Work Order, Production Plan), CRM (Lead → Customer), Projects, Assets, Quality Inspection, workflow approvals, script/query reports, common API patterns, best practices, and the correct way to extend ERPNext (Custom Fields, `doc_events`, `override_doctype_class`)

See also [hrms-patterns.md](hrms-patterns.md) for Employee, leave, attendance, payroll and recruitment.
