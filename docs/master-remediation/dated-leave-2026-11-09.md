# OS leave dates and notifications

This change belongs exclusively to ENAKO OS. Cash accounts, roles and records are unaffected.

New leave requires an employee ID, category, start date and end date. The CEO can assign approved leave; employees can request their own leave. Only the CEO can approve or reject pending leave. Employees can read only their own linked leave records.

Dates are calendar dates. The end date is inclusive. Completion becomes due at midnight following the end date in Africa/Douala, regardless of the server timezone. A worker checks each minute while the backend is running and catches up on overdue records after downtime. Render free-instance sleep can delay processing until the service wakes; this is not an external always-on scheduler.

Approved assignments and review decisions save an inbox notification and email delivery job in the same transaction. Existing email queue retries handle delivery failures. Completion changes the leave to Completed and creates its notification and email job atomically; a conditional database update prevents duplicate alerts across workers.

Migration `20261109000100_leave_dates` adds nullable employeeId, startDate, endDate and completedAt fields and a date-range constraint. Existing leave rows are preserved. No employee mappings or dates are guessed for historical records, so those records cannot automatically notify an employee until reconciled separately.

Release order: back up the database, apply the reviewed Prisma migration using the migration account (`prisma migrate deploy`), deploy the backend, then deploy the OS frontend. Do not deploy the new Prisma client against an unmigrated database. Do not run a reset or seed. No production migration or deployment has been performed as part of implementation.

Validation includes calendar and leap-day checks, Cameroon timezone boundaries, account-scoped history, assignment notification dates, single-use reviews, durable completion alerts, and concurrent completion workers against disposable local PostgreSQL.
