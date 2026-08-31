# Project TODO

- [x] Establish an elegant visual system for the TradieQuote AI platform, including responsive layouts and accessible interaction states.
- [x] Add secure, user-owned persistence for quotes and quote line items.
- [x] Build quote creation fields for customer, job, trade, and site information.
- [x] Securely upload job-site photos and include them in AI-assisted quote draft generation.
- [x] Generate an Australian-oriented draft scope with labour, materials, call-out or equipment costs, GST, assumptions, and exclusions.
- [x] Build an editable quote editor for quantities, rates, mark-up, terms, and all totals.
- [x] Build a saved quote history workspace with drafting, revision, preview, and duplication actions.
- [x] Create a polished customer-ready quote preview with print and PDF-ready styling.
- [x] Capture and display optional tradie business identity details on the customer-facing quote.
- [x] Add automated tests for quote calculations and core server behaviour.
- [x] Verify desktop and mobile quote workflows, then create a delivery checkpoint.
- [x] Add a quote duplication workflow that clones editable customer, job, cost, and photo-reference details into a new draft.
- [x] Expand automated coverage for quote workflow validation and access protection.
- [x] Add authenticated quote-router tests that verify per-user ownership scoping for saved quote actions.
- [x] Produce a detailed PRD and user-flow specification for e-signature, price book, and variation-management features.
- [x] Add a user-owned price book for repeatable labour, material, call-out, equipment, and other cost items.
- [x] Let tradies apply price-book items to an editable quote and preserve quote-specific values.
- [x] Add a quote-to-job workspace so tradies can track planned, active, and completed work from a saved quote.
- [x] Add automated coverage and visual verification for the new price book and job workflows.
- [x] Add direct visual review routes for the Price Book and Jobs workspaces at desktop and mobile widths.
- [x] Test price-book item snapshot application and quote-to-job total calculation independently.
- [x] Document that authenticated browser-session verification was deferred at the user’s request, while automated validation and responsive route checks were completed.
- [x] Add customer-ready quote acceptance with explicit agreement, signer details, timestamp, and tamper-evident approval record.
- [x] Add direct customer quote sharing through secure public acceptance links.
- [x] Add user-owned on-site variation requests with detailed scope, price, photo uploads, and approval status tracking.
- [x] Add job-level deposit requests and invoices with GST totals, payment status, and payment-link generation.
- [x] Configure the payment provider capability and connect secure payment collection to deposit and invoice requests.
- [x] Add automated tests and public-route responsive visual verification for acceptance, variations, and payment workflows.
- [ ] Claim the connected Stripe test sandbox and complete a live sandbox checkout before production payment collection.
- [ ] Complete a signed-in browser walkthrough for approval-link creation, valid customer approval, variation photo upload, variation status changes, and deposit/invoice link creation before production rollout.
- [ ] Provide a user-visible Stripe sandbox activation link after the previous browser prompt did not appear.
- [x] Define the notification trigger matrix, recipient preferences, message priority, and SMS/email delivery rules for key quote-to-cash events.
- [x] Design a mobile-first tradie dashboard with actionable daily work, money, approvals, variations, and job-status information.
- [x] Document implementation-ready information architecture, mobile interaction flows, and notification delivery choices.
- [x] Add explicit mobile dashboard cards for quote approvals and onsite variations, with direct user actions and real-data counts.
- [x] Re-verify the enhanced mobile dashboard at a phone viewport.
- [ ] Connect or confirm the Stripe sandbox through the project Settings → Payment panel before running payment smoke tests.
- [ ] Verify sandbox deposit and invoice Checkout Sessions and inspect webhook outcomes.
- [ ] Complete a signed-in browser walkthrough of approval, variation, and payment flows when browser access is available.
- [ ] Document final Stripe readiness and remaining launch safeguards.
- [x] Confirm the Stripe integration code, secure webhook verification, and Checkout Session flow are implemented.
- [ ] Open Project Settings → Payment and connect or confirm the Stripe sandbox account.
- [ ] Confirm the project is using Stripe test mode and that the sandbox is claimed.
- [ ] Run a test deposit Checkout using card 4242 4242 4242 4242 and confirm the success redirect.
- [ ] Run a test invoice Checkout and confirm the verified webhook/payment status outcome.
- [ ] Switch to live keys only after business verification, webhook configuration, and successful sandbox checks.
- [x] Add a separate Price Book Upload CSV action and downloadable template with the required import columns.
- [x] Parse and validate every CSV row before persistence, showing row-level errors and preventing invalid confirmation.
- [x] Detect active-item duplicates by name and trade and provide per-row Create new, Update existing, or Skip choices.
- [x] Batch-apply valid import choices in one authenticated action and show created, updated, and skipped counts.
- [x] Preserve the existing manual Add Item flow and test the CSV import helpers, server procedure, and responsive preview UI.
- [x] Block CSV confirmation whenever any preview row has validation errors, requiring invalid rows to be fixed or removed first.
- [ ] Complete a signed-in browser walkthrough of CSV preview, invalid-row handling, duplicate decisions, and final import summary when authenticated access is available.

## Step 1 — Organizations foundation

- [x] Inspect existing quote and user business-identity fields and map them to the new organization entity.
- [x] Add the organizations table with core identity fields and a safe migration/backfill plan.
- [x] Add the minimal organization persistence helper without implementing memberships, switching, or broader tenant scoping.
- [x] Verify before/after row counts for every affected table and run TypeScript/tests/app smoke checks.

## Step 2 — Organization links on business-owned tables

- [x] Audit all tables with userId ownership and identify the remaining business-owned tables requiring organizationId.
- [x] Add organizationId foreign keys and indexes to jobs, priceBookItems, variations, paymentRequests, quoteAcceptances, and any additional missed business-owned table.
- [x] Backfill every existing row from its userId to the current account organization without changing authentication or permissions.
- [x] Verify before/after counts and zero missing organizationId rows for each affected table.
- [x] Run the full test suite and smoke-check unchanged quote, job, price book, variation, and payment behavior.

## Step 3 — Organization-scoped query and permission logic

- [x] Audit every business-owned read, create, update, delete, and parent-child lookup for userId-only scoping.
- [x] Resolve the signed-in user’s organization context without changing authentication, sign-up, or membership behavior.
- [x] Re-scope quote, job, price book, variation, payment request, and quote acceptance access checks to organizationId.
- [x] Preserve current API/UI behavior for the existing account while enforcing organization ownership on cross-entity operations.
- [x] Add organization-isolation regression tests and run TypeScript plus the full test suite; authenticated app smoke checks remain pending.
- [x] Document the migration and save a delivery checkpoint.

## Step 3 — Organization-scoped server access

- [x] Complete the interrupted migration of every quote, job, price-book, variation, payment-request, and quote-acceptance query and mutation from userId predicates to organizationId predicates.
- [x] Centralize current-user organization resolution without changing authentication, sign-up, or membership behavior.
- [x] Ensure parent-child ownership checks use the same organization boundary for cross-entity operations.
- [x] Add organization-isolation regression coverage; authenticated existing-account walkthrough remains pending.
- [x] Run TypeScript and the full test suite; authenticated app smoke checks remain pending.

## Multi-organization runtime isolation verification

- [x] Add a behavioral test with a second organization and isolated business records across quotes, jobs, price book, variations, payment requests, and quote acceptances.
- [x] Verify cross-organization reads return no records and cross-organization writes/updates cannot mutate records.
- [x] Run the runtime isolation test and full TypeScript/Vitest regression suite.
- [x] Remove or roll back all test seed data and document the verification result.

## Multi-tenant Phase 1 — Membership data model

- [x] Add the organizationMembers table with organization/user foreign keys, role and status enums, timestamps, and one-membership-per-user-per-organization protection.
- [x] Add nullable jobs.assignedUserId referencing users.id, leaving all existing jobs unassigned.
- [x] Migrate every organization owner to exactly one active manager membership without changing organizations.ownerUserId.
- [x] Verify before/after counts, duplicate membership count, missing owner memberships, and null assignedUserId count.
- [x] Keep UI, permission/query logic, authentication, invitations, and assignment behavior unchanged; run tests and save a checkpoint.
