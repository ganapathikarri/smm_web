# SMM Phase 2 — frontend & backend integration

This frontend has been aligned against the `SMM_Phase2_MyEclipse_Complete_Project.zip` Spring Boot code reviewed on 16 Nov 2026. **The original backend remains unchanged**. All platform/category/service/input/price/policy admin operations use live API calls, not client-side mock mutations.

## Run locally

1. Restore and run the **existing Spring Boot** application in MyEclipse on `http://localhost:8081` with the correct DB and private environment variables for JWT and MFA. Never commit those keys to source control. Run with Java 17 (backend target). Verify successful startup, then log in with Super Admin password + authenticator OTP (or a valid unused recovery code).
2. Extract this zip; in the folder containing `package.json`, run `npm ci` then `npm run dev`.
3. `.env.development` has `VITE_DEMO_MODE=false`, `VITE_API_BASE_URL=` (empty), and `VITE_DEV_PROXY_TARGET=http://localhost:8081`. In development, Vite forwards `/api` requests to Spring Boot. Do **not** set an absolute `http://localhost:8081` API base in the browser when using the Vite proxy.
4. Open **`http://localhost:5173/admin`** for Super Admin (password → MFA → access JWT); open **`http://localhost:5173/`** for a separately authenticated CUSTOMER. Admin and customer are different roles/sessions.
5. For hosted/Vercel builds, use `VITE_API_BASE_URL=https://your-approved-api-origin` and configure CORS/cookies appropriately in the backend. Do not include admin bootstrap secrets anywhere in the frontend build.

## Exact Phase 2 admin APIs

| Screen | GET | POST | PUT | PATCH |
|---|---|---|---|---|
| Platforms | `/api/v1/admin/catalog/platforms` | same path | `/{id}` | `/{id}/status` |
| Categories | `/api/v1/admin/catalog/categories` | same path | `/{id}` | `/{id}/status` |
| Services | `/api/v1/admin/catalog/services` | same path | `/{id}` | `/{id}/status`, `/{id}/policy` |
| Inputs | `/api/v1/admin/catalog/services/{serviceId}/inputs` | same path | `/{inputId}` | `/{inputId}/status` |
| Prices | `/api/v1/admin/catalog/services/{serviceId}/prices` | same path | none (immutable versions) | none |
| Approval | uses services API | none | none | `/api/v1/admin/catalog/services/{id}/policy` |

Responses are wrapped in `{success, message, data, timestamp}`. Lists in the current backend return a **plain array inside `data`**, not a paginated `items` array. The frontend does not fabricate writes in live mode. All actions require a logged-in MFA-authenticated SUPER_ADMIN JWT.

## Exact Phase 2 customer APIs

- `GET /api/v1/catalog/platforms` → active platform list
- `GET /api/v1/catalog/categories` → active category list
- `GET /api/v1/catalog/services?platformId=&categoryId=&search=` → published service list (array)
- `GET /api/v1/catalog/services/{publicId}` → published service details
- `GET /api/v1/catalog/services/{publicId}/inputs` → active input definitions
- `GET /api/v1/catalog/services/{publicId}/price` → current price version
- `GET /api/v1/catalog/services/{publicId}/price-preview?quantity=N` → server-calculated INR estimate

Customer routes require a CUSTOMER JWT. **Published ServiceResponse currently has no price or input arrays**, so `src/api/customerApi.ts` composes the separate backend endpoints when showing the catalogue. A performance improvement for a large catalogue is a dedicated bulk catalogue projection API in a future iteration (without changing prices on the client).

Customer catalogue now shows approved services and their current price, accepts quantity for a **read-only price preview**, and shows configured input definitions. **It does not submit or debit orders:** quote/order APIs are deferred to Phase 4. Wallet top-up remains disabled pending Phase 3 bank/legal verification.

## Platform icons and images (no backend migration)

- `src/components/PlatformIcon.tsx` maps the backend `platform.code` to locally rendered **SVG-based recognizable icons** for Instagram, YouTube, Facebook, LinkedIn, X, Twitter, TikTok, WhatsApp, Telegram, Pinterest, Reddit and others.
- Icons are visible on admin platform cards, customer home platform cards, customer platform filters, and published service cards.
- Unknown codes display a branded fallback tile with the first two letters. This means a platform is **never rendered with a broken image**, even when the admin adds a new code.
- These are lightweight illustrative channel icons, not uploaded official branding assets; no third-party image CDN or image-upload endpoint is needed. If you later need official platform logos or admin-uploaded images, first add a reviewed `icon_url` or asset mapping under your own approved hosted assets, with access/security controls and brand usage review.

## Phase 2 test order

1. Log in to `/admin` with MFA. Add Platform **INSTAGRAM**, verify icon and database row, edit name, disable and re-enable.
2. Add an ACTIVE Category for Instagram (e.g. Profile Consulting); test nested parent and status.
3. Create Service with MANUAL fulfilment (status DRAFT, policy REVIEW_REQUIRED).
4. Configure inputs, such as `public_profile_url` type URL; confirm passwords/OTPs are rejected.
5. Create a price version: `FIXED`, fixed qty=1, minQty=1, maxQty=1, minimumCharge=0, and appropriate tax settings ONLY after CA review. `NOT_CONFIGURED` cannot be published.
6. Review service policy and explicitly approve only if compliant; then activate separately. Re-editing the service/input must trigger re-approval.
7. Log in as CUSTOMER at `/`, verify that the platform SVG icon and service are visible, and test `/price-preview`. A disabled platform or unapproved/paused service should not be offered.
8. Check responses/DB audit records. Do not mark integration tests passed until verified on your local MySQL/Spring Boot instance.

## What is NOT yet complete

Phase 3 wallet/UPI/bank verification, Phase 4 order/fulfilment/refunds, and Phase 5 support/reports are not implemented in the paired backend. Admin operation pages outside Catalogue are retained as placeholders or demo views; never interpret them as real transaction data. Production rollout additionally needs full integration tests, security review, CORS/cookie configuration, legal/payment validation and monitoring.

## Build verification notes

`src/` TypeScript and TSX syntax is machine-parsed. Complete `npm run build` and real-browser API tests must still run in an environment with npm dependencies installed and live MySQL/backend; do not assume passing syntax is a full build or end-to-end test.
