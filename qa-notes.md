# Visual Verification Notes

The unauthenticated public landing page was checked in the running preview on 27 August 2026. The page rendered its complete branded hero, sign-in call to action, product preview, and three feature panels. The light technical grid, forest-green primary colour, and lime accent create a practical construction-technology visual direction while retaining strong content contrast.

The authenticated quote workspace requires a user sign-in to verify end-to-end in the preview. Its server procedures, data schema, TypeScript compilation, and calculation unit tests have been validated separately.

The new `/jobs` route was visually reviewed at desktop width. It displays a clear job-workspace header, work-status summary, and the expected empty/loading treatment. Direct unauthenticated navigation to `/price-book` correctly preserves the public sign-in experience. Dedicated authenticated price-book and job routes are available for signed-in workspace users.

The user approved delivery without taking over an authenticated browser session. TypeScript compilation, 14 automated tests, responsive route captures, server-side user scoping, price-book quote snapshots, and quote-to-job total calculation were validated. A signed-in browser walkthrough of creating a price-book item, applying it to a quote, creating a job, and changing its status remains a recommended user acceptance test before production rollout.

For the job-to-cash update, the public approval-link fallback was visually reviewed on mobile and presents a clear unavailable-link state. The responsive jobs route retains the established visual system and job-workspace loading state. The complete signed-in approval, variation and payment actions were covered by typed server boundaries and automated tests; an end-to-end Stripe sandbox checkout and signed-in browser walkthrough should be completed before live rollout.

## CSV import visual verification

The Price Book page was reviewed at desktop and phone-sized widths. The new Bulk Import panel presents the CSV template and Upload CSV actions above the existing manual item form, and the mobile layout keeps both actions visible and tappable. The item table remains horizontally scrollable on narrow screens, preserving the existing manual Add Item flow. The authenticated upload, preview, and confirm interaction still requires a signed-in browser session for end-to-end walkthrough validation.

## CSV batch import test note

The active server workflow tests mock database helpers from `server/db.ts`; the batch import helper is not yet included in that mock. A focused router boundary test should add the `batchImportPriceBookForUser` mock and assert the signed-in user ID is passed with validated import rows.

## Organizations foundation verification — 31 August 2026

Step 1 added the `organizations` table with `ownerUserId`, name, ABN, licence, phone, email, and timestamps. Existing quote business identity was backfilled into one organization per existing user, quotes were linked through `organizationId`, and the duplicated quote-level business columns were removed. The quote persistence layer now resolves organization identity while preserving the existing quote API shape.

Migration counts: before, `users` = 1 and `quotes` = 1; `organizations` did not exist. After, `users` = 1, `quotes` = 1, `organizations` = 1, and quotes missing an organization = 0. The organization is linked to 1 quote. TypeScript compilation passed, all 21 Vitest tests passed, and desktop smoke captures of the existing quote and Price Book routes rendered successfully after migration.

## OrganizationId backfill verification — 31 August 2026

The schema audit found five remaining business-owned tables scoped directly by userId: `jobs`, `priceBookItems`, `variations`, `paymentRequests`, and `quoteAcceptances`. `quotes` already had organizationId from Step 1. `quoteLineItems`, `quotePhotos`, and `variationPhotos` are parent-scoped through quoteId or variationId rather than directly user-scoped, so they were not given redundant organizationId columns.

Before migration counts were: jobs 1, priceBookItems 2, variations 0, paymentRequests 2, and quoteAcceptances 0. After migration counts remained: jobs 1, priceBookItems 2, variations 0, paymentRequests 2, and quoteAcceptances 0. Missing organizationId counts after migration were zero for every affected table. The existing job row links to the current organization owner, confirming no cross-account misattribution. The post-migration verification JSON reported jobs=1/missing=0, priceBookItems=2/missing=0, variations=0/missing=0, paymentRequests=2/missing=0, and quoteAcceptances=0/missing=0.

The migration added nullable columns, backfilled by joining each row’s userId to organizations.ownerUserId, then enforced NOT NULL foreign keys and organization indexes. New persistence writes now carry organizationId from the existing organization, job, or quote parent. Authentication, login, sign-up, permission checks, and existing user-scoped query behavior were not changed. TypeScript passed, all 21 tests passed, including the existing variation and payment router-boundary tests. The quote, jobs, and Price Book routes returned their existing data in the authenticated smoke capture; the dashboard summary returned zero pending approvals and zero sent variations as before.

## Multi-organization runtime isolation verification — 31 August 2026

A real-database Vitest scenario created two temporary users and two separate organizations, then seeded one quote, price-book item, job, variation, payment request, and quote acceptance per organization. The test exercised the organization-scoped persistence helpers rather than mocked router calls.

Organization A could read only its own quotes, price-book items, jobs, variations, payment requests, and dashboard approval count. It could not retrieve Organization B’s quote or job-child records. Cross-organization quote-to-job conversion, variation creation/status updates, payment-request creation/session updates, quote acceptance creation, price-book updates, job status updates, and quote updates returned no record or no-op results, leaving Organization B’s rows unchanged.

The complete verification passed with **8 test files and 25 tests** passing. TypeScript compilation with `tsc --noEmit` also passed. The test cleanup hook removed all temporary rows. A follow-up database query confirmed `0` users with the `runtime-isolation-*` prefix and `0` organizations named with the `Runtime Org A` or `Runtime Org B` test prefixes remaining.

The runtime test uses an extended 30-second timeout because real database connection and cleanup operations can exceed Vitest’s five-second default. The authenticated browser walkthrough remains a separate pending check; this note records runtime server-side isolation only.
