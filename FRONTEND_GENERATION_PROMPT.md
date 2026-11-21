# Reusable prompt — SMM Platform Super Admin frontend

Build a production-quality responsive **two-sided SMM Platform web application** with distinct **Super Admin** and **Customer** panels using React, TypeScript and Vite. In demo mode, make both panels visible through a clear `Preview: Admin / Customer` switch in the top bar. The demo should open in a signed-in Super Admin workspace so the presenter can immediately demonstrate creating categories, then switch to the Customer Portal and show those same active categories. Use a modern premium SaaS admin design: dark left sidebar, soft light workspace, restrained violet accent, clean typography, compact data tables, clear status chips, accessible modal forms, responsive mobile layouts, thoughtful empty/loading/error states and subtle interactions. The product is called **SMM Platform** (temporary UI wordmark: socialSuite).

## Product rules — do not violate

1. Release 1 offers compliant social media marketing services only: content calendars, creative/design, video editing, profile optimization, strategy, moderation, campaign planning/management and reporting.
2. Never create or promote fake followers, artificial likes/views/comments/watch time, bots, spam, engagement manipulation, platform-policy evasion or credential-based account access.
3. Never ask for or store customer social-media passwords, OTPs, recovery codes, session cookies or account credentials.
4. Fulfilment is manual in release one. No provider API integration or fake completion automation.
5. Wallet is prepaid for the platform's own services only. No wallet transfers, withdrawals or third-party settlement.
6. Wallet credits may only be posted after authoritative bank/acquirer verification, exact amount/currency/reference matching and idempotent double-entry ledger processing. A screenshot or frontend redirect is not payment proof.
7. Only one designated Super Admin exists. Do not add generic staff/admin roles.
8. Financial actions and sensitive administrative changes must be audited.

## Required pages

- **Admin sign-in:** phone + password + mandatory TOTP authenticator code; optional single-use recovery code path; secure session UX; never put tokens in localStorage.
- **Overview dashboard:** revenue/order/customer/service KPIs, 30-day trend chart, recent orders, pending work, catalog health and quick actions.
- **Platforms:** list/create/edit/enable/disable social platforms; platform code, name, official policy URL, status.
- **Categories:** hierarchical categories, platform association, slug, sort order, active/disabled status, search/filter.
- **Services:** create/edit service, description, platform/category, fulfilment mode (MANUAL only), status, policy review state, and service preview. New records start DRAFT and REVIEW_REQUIRED.
- **Service inputs:** define customer input fields using URL/TEXT/NUMBER/SELECT only, required flag, help text, max length and allowed values. Reject any label/key that asks for a password, OTP, token, cookie, recovery code, session or other account secret.
- **Pricing:** immutable price version history; INR; PER_1000/PER_UNIT/FIXED units as suitable; minimum/maximum quantity, minimum charge, effective dates, version comparison. Never overwrite a prior price version.
- **Orders:** order queue, filters, order details, timeline, customer inputs, payment verification state, manual fulfilment statuses, evidence/notes and audit history.
- **Customers:** searchable directory, account state, verified contacts, order history, wallet summary; never display passwords or secrets.
- **Wallet & payments:** read-only wallet summary and ledger, payment intent status, bank/acquirer reference and reconciliation status. No manual wallet balance editor.
- **Policy review:** approve/reject/suspend service with platform-policy checklist, reason and evidence.
- **Reports:** revenue, orders, fulfilment turnaround, repeat customers, refund/cancellation and catalog performance.
- **Audit log:** actor, action, target, timestamp, source/IP and correlation ID; redact secrets.
- **Settings & security:** MFA status, recovery-code reissue flow, sessions, re-authentication, workspace settings, CORS/API health guidance.

## Required Customer panel

- Customer sign-in / registration screens for the future live integration; demo mode can preview a named sample customer without calling the backend.
- Customer overview dashboard with welcome panel, wallet sample balance clearly marked illustrative, order count, available service count and category shortcuts.
- Browse Categories: show categories created in the Admin panel; only ACTIVE categories are visible. Category click filters the service catalog.
- Browse Services: show only services with `status=ACTIVE` and `policyStatus=APPROVED`; show description, platform, clear INR price and manual-fulfilment expectation.
- Service request / order preview: collect only the safe input definitions (URL/TEXT/NUMBER/SELECT) and create a local demo order; never request social-media credentials, OTPs, cookies, access tokens or recovery codes.
- My Orders: order list, details and status timeline scoped to the signed-in customer.
- Wallet: read-only balance and ledger view. Never offer transfers or withdrawals. Do not make real top-ups until authorised bank/acquirer verification and legal/accounting sign-off are complete.
- Profile: name, verified contact indicators and account status; no secret values.
- In demo mode, a customer order created in the Customer panel should appear in the Admin order queue, and an Admin category change should immediately update the Customer catalog. Clearly identify all demo state as sample data.

## API and deployment requirements

Use a centralized typed API client with configurable `VITE_API_BASE_URL`, exact route constants, typed DTOs, consistent errors, pagination and query filters. Use Bearer access tokens held in memory, `credentials: 'include'` for HttpOnly refresh cookies, logout revocation and automatic refresh. Do not store JWTs, passwords, MFA keys or bootstrap secrets in localStorage or frontend build variables.

Backend is Java Spring Boot 3.5.x, MySQL, and may be accessed via an HTTPS Cloudflare Tunnel. Frontend is deployed to Vercel. Make CORS credentials-compatible with the exact Vercel origin and HTTPS-only secure cross-site cookies. Keep CSRF protection for cookie-authenticated endpoints. Local-only bootstrap endpoints must never be exposed through Cloudflare Tunnel or production.

Current known platform endpoints:
- GET `/api/v1/admin/catalog/platforms`
- GET `/api/v1/admin/catalog/platforms/{id}`
- POST `/api/v1/admin/catalog/platforms`
- PUT `/api/v1/admin/catalog/platforms/{id}`
- PATCH `/api/v1/admin/catalog/platforms/{id}/status`

For all other areas, document proposed endpoint contracts and clearly mark them as planned until the backend team implements them. Do not silently invent a live API or fake live data. Include demo mode with realistic sample data and an obvious DEMO MODE indicator; sample activity must be clearly identified as illustrative.

## Deliverables

Return a complete runnable ZIP containing both Admin and Customer panels, shared demo state, source code, `package.json`, Vite/TypeScript config, `.env.example`, README, API contract document and deployment steps. Include accessible responsive UI, form validation, working demo interactions, loading/error/empty states, CSV exports where relevant, and no real secrets. Verify `npm install` and `npm run build` before delivery.
