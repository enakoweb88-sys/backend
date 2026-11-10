# Meal providers and payroll breakdowns

ENAKO OS update only. Cash Dashboard identities, permissions, records and workflows are unchanged.

GET `/meals/providers` returns only deduplicated names from saved meal records, behind the existing OS authentication guard. New providers are saved through the existing `vendor` field when a meal is submitted. No separate supplier directory, dependency installation or schema migration is required. Existing employee-scoped meal listing and role restrictions are preserved.

The backend trims and normalizes food/provider names and validates non-empty custom names. Consumed meals continue to enforce 1,000 FCFA total, 500 company and 500 employee, ignoring prices supplied by the client. Skipped meals have zero charges and no provider bill. Historical meal amounts are not rewritten.

The OS frontend groups the authorized meal list by month or export date range, provider, employee, and employee/provider pair. The manager pays the full supplier bill; payroll recovers each employee's share, including the manager's own share. Totals are calculated amounts, not posted payment or payroll confirmations. Disputed records are excluded from payable totals until resolved. Case and whitespace variations of provider names group together. Missing historical service times are explicit; timestamps display in Africa/Douala.

PDF and Excel contain four sections/sheets: Provider Bills, Employee Payroll, Payroll By Provider, and Meal Records. Shared frontend calculation code powers both the dashboard and exports. Employee reports use only the employee-scoped response; manager and CEO reports use their existing authorized company-wide response.

Validation: 75 backend unit tests; 17 disposable database checks; 12 full HTTP groups including provider reuse, fixed costs and employee isolation; existing security suite; frontend report tests covering five suppliers, historical amounts, statuses, calendar boundaries, real PDF generation and XLSX round-trip numeric cells; headless browser checks with synthetic responses verified custom entry, provider reuse, manager/employee screens and actual PDF/XLSX downloads. TypeScript, backend lint/build and OS build/access/UI checks also passed. A stale staff-redaction test fixture was updated to provide the leave counter used by the earlier leave release. No production customer records were accessed or changed during these checks.

The owner requested GitHub publication. Push backend before OS frontend to update the provider-list endpoint first. Automatic deployment can follow the existing Render/Vercel configuration; GitHub branch verification and HTTP health do not establish exact deployed commits. Unfinished local Sentry work and credentials are excluded.
