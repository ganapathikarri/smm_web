# Phase 4.1 — Frontend integration and UI/UX audit

## What's in this ZIP
- Complete React 18 / TypeScript / Vite frontend (source, `package.json`, `package-lock.json`, Vite and Vercel config).
- Customer `/` page: removed large "Customer overview" hero. Compact discovery header, three rotating editorial banners with controls/pause, animated/keyboard-pausing "Our services" rail loaded from live published catalogue, platform shortcuts, wallet/order quick actions.
- Customer service order modal: Phase 4 server quote (`quoteId`, `subtotal`, `taxAmount`, `total`), safe dynamic input fields, price confirmation, fixed idempotency key for retries, authenticated `POST /customer/orders` then automatic order-history navigation. Order listing/response adjusted to real backend Spring Page response and nested order detail.
- Admin `/admin`: real order queue, details, fulfilment actions and progress notes; dashboard top-up metrics and latest orders; wallet top-up ledger; reports; masked customer directory and read-only audit history. Existing live catalog setup/policy/price management is retained.
- No fabricated financial totals. Admin top-up total is **SUM of CREDITED top-ups** only, not Razorpay settlement or profit. Failed API calls show actionable errors rather than fake zeros.

## IMPORTANT companion backend
The previous Phase 4 backend DOES NOT provide the four new admin reporting endpoints. Use the supplied `SMM_Phase4_1_Admin_Reporting_Backend_Updated.zip` backend package to see those panels. It adds 2 controllers and one nonbreaking WalletTopup getter; existing Phase 3/4 wallet/payment/order logic kept.

## Local dev
1. Node 20+ recommended; in `smm-admin-frontend` run `npm ci` and `npm run dev`.
2. Set `.env.development`: `VITE_DEMO_MODE=false`, `VITE_API_BASE_URL=`, `VITE_DEV_PROXY_TARGET=http://localhost:8081` (change port if needed).
3. Start the updated Spring Boot Phase 4 backend in MyEclipse/JDK 17 and configure allowed CORS/refresh cookie for your deployment origin.
4. Customer page `/` and admin page `/admin`. Login separately as CUSTOMER and SUPER_ADMIN. Existing MFA login required.
5. Verify `npm run build` locally, then deploy Vercel (set `VITE_API_BASE_URL` to your HTTPS backend origin, not localhost).

## Backend routes used
- GET `/api/v1/admin/payments/topups/summary` (NEW)
- GET `/api/v1/admin/payments/topups` (NEW)
- GET `/api/v1/admin/customers` (NEW)
- GET `/api/v1/admin/audit-logs` (NEW)
- GET `/api/v1/admin/orders?status=...&page=0&size=20` (Phase 4)
- GET `/api/v1/admin/orders/{orderNumber}` (Phase 4)
- POST `/api/v1/admin/orders/{orderNumber}/actions` (Phase 4)
- POST `/api/v1/customer/orders/quotes` (Phase 4)
- POST `/api/v1/customer/orders`, header `Idempotency-Key` (Phase 4)
- GET `/api/v1/customer/orders` and `/{orderNumber}` (Phase 4)
- Other existing Phase 2 admin catalogue and Phase 3 Razorpay wallet flows retained.

## UI/UX DESIGN AUDIT — source/static review, NOT a browser screenshot test
- [x] Replaced big customer overview/hero with compact heading and content hierarchy.
- [x] Moving service cards are real published catalogue entries, not static fake services. Hover/focus pauses movement. `prefers-reduced-motion` disables auto-scrolling and enables horizontal scrolling.
- [x] Promo banners rotate with manual previous/next/dots, pause on hover/focus, and never claim an unconfigured price discount/offer.
- [x] Responsive CSS breakpoints at 1050/800/600/520px; cards wrap/stack on mobile. Min 40-44px interactive controls for most new CTAs; strong keyboard focus outlines and sticky order action footer.
- [x] Admin order changes prompt for confirmation and require reason/customer-visible note when necessary; backend enforces lifecycle transitions.
- [x] Admin totals do not include pending payments; ledger/bank settlement distinction clearly labelled.
- [x] Customer input fields are escaped by React; input keys come from backend; no account passwords/OTP fields encouraged.
- [x] Console refresh button re-queries live data instead of presenting a false "up to date" toast.
- [x] Verified TSX/TS source syntax using local TypeScript compiler; Java 17 compiled new backend classes; JAR/ZIP integrity checked.
- [ ] Full `npm ci && npm run build` not completed: npm registry packages inaccessible from this environment. Run this locally before deployment.
- [ ] Actual browser screenshots, responsive click-target measurement, focus-trap, keyboard screen reader and cross-browser QA require running app in Chrome/Firefox/mobile; not performed here.
- [ ] Real MySQL integration, JWT role-negative tests, concurrent order/ledger and Razorpay reconciliation require staging backend tests; NOT performed here.

## Other known scope gaps
- Offer banners are carefully worded, configurable-in-source messages, **not** an offer-management/CMS backend. Do not market unapproved offers.
- Customer support/announcements APIs and advanced analytics remain backend-planned; original frontend surfaces their missing state instead of fictitious data.
- Customer order history status tabs filter the fetched page; backend currently offers unfiltered customer pagination. For large histories add server-side customer filtering/search.
- Original-source Razorpay refunds/chargebacks, automated fulfilment, admin campaign composer and bank settlement reporting remain separate future work.

Production check: confirm Razorpay approved the exact prepaid wallet/SMM use case, compliance of listed services, real domain routing, MFA, cookies, webhook, DB migrations, audit logs, and test concurrency/refund scenarios before enabling money movement at scale.
