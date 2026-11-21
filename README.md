> **Phase 3 wallet and Razorpay Standard Checkout:** see [PHASE3_RAZORPAY_FRONTEND_README.md](PHASE3_RAZORPAY_FRONTEND_README.md) for setup, direct wallet links, backend API requirements, and payment safety.

# Phase 2 integration update (16 Nov 2026)

**New:** live Admin catalogue CRUD, input/pricing/policy screens, customer published catalogue + live price preview, and inline platform SVG icons. Start with [PHASE2_INTEGRATION.md](PHASE2_INTEGRATION.md) for precise endpoints, setup and limitations.

---

# SMM Platform — Frontend (live customer app + Super Admin console)

> **Live mode (default in `.env.example`)**: the customer app is served at `/` and is wired to your Spring Boot auth/profile/platform APIs. The Super Admin console is at `/admin`. Set `VITE_DEMO_MODE=true` to get the original offline demo.

## 0. Quick start with your backend (dev)

```bash
npm install
cp .env.example .env        # VITE_DEMO_MODE=false, VITE_API_BASE_URL empty
# start Spring Boot on :8081, then
npm run dev                 # http://localhost:5173
```

Vite proxies `/api` to `http://localhost:8081` (change `VITE_DEV_PROXY_TARGET` if needed), so the browser stays same-origin: no CORS config and the `SameSite=Strict` `smm_refresh` cookie works. With `app.otp.delivery=mock`, read the OTP from the backend log.

| Screen | Status |
|---|---|
| Register, phone OTP verify (send/resend/verify), login, silent refresh on reload, logout, logout-all, forgot/reset password, Google sign-in and Google create-account (set `VITE_GOOGLE_CLIENT_ID`) | **Live** — `/api/v1/auth/**` |
| Profile, platforms (customer) | **Live** — `/customer/profile`, `/catalog/platforms` |
| Services, order quote + place order, orders, wallet, add funds (UPI QR), support, announcements | **Built to the contract in API_CONTRACT.md §"Customer app contract"**. Until the backend implements them each screen shows a clear "not available yet" state with the endpoint. |
| Super Admin console (`/admin`) | Dedicated password + MFA login, admin refresh-cookie session and logout are wired to `/api/v1/admin/auth/**`. Platforms are live; other admin modules remain demo UI until their APIs are connected. |

## Super Admin sign-in

The `/admin` route uses a separate two-step administrator flow; it never sends Super Admin credentials to the customer login endpoint.

1. `POST /api/v1/admin/auth/login` with `{ phoneE164, password }`. The response returns `mfaRequired`, a short-lived `challengeToken` and `expiresInSeconds`. This challenge token is not an API access token.
2. `POST /api/v1/admin/auth/mfa/verify` with `{ challengeToken, code }`. Enter a six-digit authenticator code or one unused recovery code.
3. On successful verification, the response contains the Super Admin `accessToken` and profile; the backend sets the HttpOnly `smm_admin_refresh` cookie. The frontend keeps the access token in memory and includes credentials for refresh/logout requests.

The customer application continues to use its own `/api/v1/auth/**` endpoints and session cookie. Do not store access tokens, challenge tokens, passwords, recovery codes or MFA secrets in local storage or Vite environment variables.

## Google sign-in and Google create-account

The customer **Sign in** and **Create account** screens both include a Google sign-in area. When `VITE_GOOGLE_CLIENT_ID` is configured, Google Identity Services renders the official **Continue with Google** / **Sign up with Google** button. When the ID is empty, the page still displays a Google-branded setup button and an inline explanation; clicking it tells you which variable to configure instead of silently hiding the Google option. After configuration and a Vite restart, the real Google button is rendered.

Both real buttons obtain a Google ID token in the browser and send only that ID token to the existing backend endpoint:

```http
POST /api/v1/auth/google
Content-Type: application/json

{ "idToken": "<Google ID token>" }
```

The frontend does not trust or submit a browser-supplied email/name as proof of identity. The Spring Boot `GoogleTokenVerificationService` must verify the token signature, issuer, expiry, audience and verified-email claims; `GoogleLoginService` then creates or finds the Google identity, assigns the `CUSTOMER` role to a new customer, and issues the same customer session/cookie response used by password login. Keep the existing account-linking rule: do not automatically merge a Google identity into an existing phone/password account just because the email strings match. If the backend rejects such a collision, the UI shows that API error and the user must use the supported account-linking flow.

### Configure Google OAuth for local development

1. In Google Cloud Console, create or select an OAuth 2.0 Client ID of type **Web application**.
2. Add this Authorized JavaScript origin: `http://localhost:5173`.
3. Set the same client ID in the Spring Boot environment variable `GOOGLE_CLIENT_ID` and in the frontend environment variable below. The value is a public client ID, not a client secret.
4. Add the following to `.env.development` (or your active Vite development environment file), then restart Vite:

```env
VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

### Configure Vercel

In Google Cloud Console, also add your exact Vercel frontend origin, for example `https://your-project.vercel.app`, to **Authorized JavaScript origins**. In Vercel → Project → Settings → Environment Variables, set `VITE_GOOGLE_CLIENT_ID` to the same Web client ID, and set `VITE_API_BASE_URL` to the HTTPS backend origin/tunnel URL. Redeploy after changing Vite environment variables because they are embedded at build time. The Spring Boot backend must allow the exact Vercel origin through CORS and accept `POST /api/v1/auth/google`. For production cross-origin refresh cookies, review `SameSite`, `Secure`, credentialed CORS and CSRF settings together; do not loosen these settings without implementing the corresponding protections.

Never put a Google client secret, backend JWT secret, database password, refresh token or MFA secret in a `VITE_*` variable. Anything prefixed with `VITE_` is visible to browser users.

---

# SMM Platform — Super Admin Frontend

A responsive React + TypeScript + Vite admin console for the SMM Platform backend. The ZIP includes a fully interactive demo workspace, sample data, configurable API client, and deployment notes for Vercel + a Spring Boot backend exposed through Cloudflare Tunnel.

## 1. Run the demo locally

Requirements: Node.js 18+ and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Open `http://localhost:5173`.

To run the offline demo, set `VITE_DEMO_MODE=true` in `.env` and restart Vite. The demo starts directly in the signed-in Super Admin workspace with sample records. The header has a **Preview: Admin / Customer** switch. Use it to move between both panels without signing in again. The Customer Portal preview uses the sample customer “Meera Reddy”; categories created or disabled in the Admin panel immediately update the customer catalog. Only ACTIVE categories and ACTIVE + APPROVED services appear to customers. The Customer panel includes Overview, Browse Categories, Services, My Orders, Wallet and Profile. You can place a sample order and then see it reflected in the Admin Orders screen.

Use the profile menu → Sign out to preview the admin login screen. In demo mode, any non-empty phone and password will sign in; MFA is intentionally skipped in demo mode. In live mode, Super Admin sign-in uses the separate password and MFA steps described above. The admin and customer previews are not separate authenticated backend sessions: they are role-preview modes for demonstrating the planned two-sided product. Demo changes are stored in browser local storage and are not sent to your backend.

To create a production build:

```bash
npm run build
npm run preview
```

The output is `dist/`.

## 2. Main screens included

- Overview dashboard: sample KPIs, performance chart, quick actions, recent orders and catalog health.
- Platforms: create, enable and disable platforms. This screen is wired to the currently implemented backend platform-management API when demo mode is off.
- Categories: category creation, platform association, filtering and enable/disable UI.
- Services: service draft creation, category/platform association and status controls. New demo services start as `DRAFT` + `REVIEW_REQUIRED`.
- Pricing & versions: create immutable INR price versions with rate units, quantity bounds, minimum charge and effective date; tax remains `NOT_CONFIGURED` pending CA confirmation.
- Service inputs: define safe URL/TEXT/NUMBER/SELECT customer fields; block credential, OTP, token, cookie and recovery-code collection.
- Orders: manual fulfilment queue, status review and CSV export.
- Customers: customer directory and account summary.
- Wallet & payments: read-only ledger and payment-intent views; no wallet balance editing, customer transfers or withdrawals.
- Policy review: approve/reject flow with responsible-growth checklist.
- Reports: sample performance and operational focus metrics.
- Audit log: sample admin activity.
- Settings & security: MFA, session, API connection and workspace guidance.

The dashboard and seeded records are explicitly marked **DEMO MODE**. Financial values and analytics are illustrative.

## 3. Connect to Spring Boot through Cloudflare Tunnel

### Vercel environment variables

From your laptop, run the tunnel against the Spring Boot port (8081):

```bash
cloudflared tunnel --url http://localhost:8081
```

Copy the generated HTTPS hostname from the terminal. After the backend is exposed by your Cloudflare Tunnel, open Vercel → Project → Settings → Environment Variables and add:

```text
VITE_DEMO_MODE=false
VITE_API_BASE_URL=https://YOUR-CLOUDFLARE-TUNNEL.trycloudflare.com
VITE_ADMIN_LOGIN_PATH=/api/v1/admin/auth/login
VITE_ADMIN_REFRESH_PATH=/api/v1/admin/auth/refresh
VITE_ADMIN_LOGOUT_PATH=/api/v1/admin/auth/logout
VITE_ADMIN_PLATFORMS_PATH=/api/v1/admin/catalog/platforms
```

Replace the tunnel URL with the current HTTPS URL shown by `cloudflared`. Vite environment variables are embedded at build time, so redeploy the Vercel app after changing them. Do not put database passwords, JWT signing keys, MFA encryption keys, bootstrap secrets, or any other server secret into Vercel frontend variables. Only the public API origin and public path configuration belong here.

### Spring Boot CORS and cookies

The browser will send API requests with `credentials: include`. For a Vercel site calling a different HTTPS tunnel hostname, configure Spring Boot to:

- Allow the exact Vercel frontend origin (for example `https://your-project.vercel.app`), not `*`.
- Set `allowCredentials(true)` and allow `Authorization`, `Content-Type`, and required headers/methods.
- Use HTTPS end-to-end.
- For a cross-site HttpOnly refresh cookie, use `Secure=true` and `SameSite=None`; keep the cookie HttpOnly and narrowly scoped to the admin-auth path. Validate the precise browser/cookie behavior with your deployed Vercel domain.
- Keep CSRF protection enabled or use a documented CSRF strategy for cookie-authenticated endpoints. CORS is not a CSRF defense.
- Never expose the local-only MFA bootstrap endpoints through a public tunnel. Remove/disable bootstrap routes after enrollment or constrain them to a development-only local profile that cannot be activated in production.

A Cloudflare quick tunnel URL may change when the tunnel restarts. Update `VITE_API_BASE_URL`, then rebuild/redeploy Vercel when it changes. A stable named tunnel and custom hostname are preferable for ongoing use.

## 4. Backend API integration status

### Implemented and wired

The platform management paths below are based on the backend work completed in this project:

| Method | Path | Frontend use |
|---|---|---|
| GET | `/api/v1/admin/catalog/platforms` | Load platform list |
| GET | `/api/v1/admin/catalog/platforms/{id}` | Platform details (available for later detail view) |
| POST | `/api/v1/admin/catalog/platforms` | Create platform |
| PUT | `/api/v1/admin/catalog/platforms/{id}` | Update platform (not yet exposed as an edit form) |
| PATCH | `/api/v1/admin/catalog/platforms/{id}/status` | Enable/disable platform |

Expected response envelope is compatible with `ApiResponse<T>` (`{ success, message, data, timestamp }`) and can also unwrap a bare response.

### Planned contracts — implement these on the backend before switching the matching screens to live mode

The routes below are proposed API contracts for the next backend phases. They are included centrally in `src/api/config.ts`; they are **not claims that these endpoints currently exist**. The Customer Portal preview currently uses shared demo state, so category updates and demo orders appear across both panels without a backend.

| Area | Proposed methods and paths |
|---|---|
| Admin authentication | `POST /api/v1/admin/auth/login`, `POST /api/v1/admin/auth/refresh`, `POST /api/v1/admin/auth/logout` |
| Categories | `GET/POST /api/v1/admin/catalog/categories`, `GET/PUT /api/v1/admin/catalog/categories/{id}`, `PATCH /api/v1/admin/catalog/categories/{id}/status` |
| Services | `GET/POST /api/v1/admin/catalog/services`, `GET/PUT /api/v1/admin/catalog/services/{id}`, `PATCH /api/v1/admin/catalog/services/{id}/status`, `POST /api/v1/admin/catalog/services/{id}/submit-review` |
| Pricing | `GET/POST /api/v1/admin/catalog/services/{id}/price-versions`; new versions should be immutable |
| Orders | `GET /api/v1/admin/orders`, `GET /api/v1/admin/orders/{id}`, `PATCH /api/v1/admin/orders/{id}/status`, `POST /api/v1/admin/orders/{id}/notes` |
| Customers | `GET /api/v1/admin/customers`, `GET /api/v1/admin/customers/{id}` |
| Wallet | `GET /api/v1/admin/wallet/summary`, `GET /api/v1/admin/wallet/ledger` |
| Payments | `GET /api/v1/admin/payments`, `GET /api/v1/admin/payments/{id}`, `POST /api/v1/admin/payments/{id}/reconcile` (must verify through bank/acquirer source; never accept screenshots as proof) |
| Policy review | `GET /api/v1/admin/policy-reviews`, `POST /api/v1/admin/policy-reviews/{id}/approve`, `POST /api/v1/admin/policy-reviews/{id}/reject` |
| Reports | `GET /api/v1/admin/reports/summary`, `GET /api/v1/admin/reports/revenue`, `GET /api/v1/admin/reports/fulfilment` |
| Audit | `GET /api/v1/admin/audit-logs` |
| Admin MFA/security | Admin login must require password + TOTP (or single-use recovery code); routes must enforce `SUPER_ADMIN` plus an MFA-authenticated claim. Shorter admin sessions and immediate logout revocation are required. |
| Customer catalog | Proposed: `GET /api/v1/catalog/categories`, `GET /api/v1/catalog/services`, `GET /api/v1/catalog/services/{publicId}`. Return only ACTIVE categories and ACTIVE + APPROVED services with current effective prices. |
| Customer orders | Proposed: `POST /api/v1/customer/orders`, `GET /api/v1/customer/orders`, `GET /api/v1/customer/orders/{publicId}`. Enforce ownership from the JWT subject; never accept an arbitrary customer ID for the caller’s own orders. |
| Customer wallet | Proposed: `GET /api/v1/customer/wallet/summary`, `GET /api/v1/customer/wallet/ledger`; top-up intent/status APIs only after bank/acquirer, legal and CA approval. Wallet credits must be posted only after server-side authoritative payment verification. |
| Customer profile | Proposed: `GET /api/v1/customer/profile`, `PUT /api/v1/customer/profile`; contact changes must use the backend verification flow. |

For live API mode, the UI starts with empty state for not-yet-loaded records rather than presenting demo sample records as production data. Platform list loading is wired. The other listed APIs require backend implementation and subsequent screen wiring before production use.

## 5. Important product and security rules reflected in the UI

- Release 1 supports compliant services such as content planning, creative production, video editing, strategy, community moderation and campaign support.
- Do not list or fulfil fake followers, artificial likes/views/comments/watch time, bots, spam, credential collection or platform-policy evasion.
- Never request or store customer social-media passwords, OTPs, session cookies or recovery codes.
- Manual fulfilment only in release 1; no provider API automation.
- Wallet is prepaid for the platform's own services only. Do not add transfers, withdrawals or third-party settlement.
- Wallet credit must happen only after authoritative bank/acquirer confirmation, exact amount/reference matching and idempotent double-entry ledger posting. Do not credit based on a screenshot or frontend redirect.
- Financial controls and admin decisions must create immutable audit entries.
- Only one designated `SUPER_ADMIN`; do not add generic staff/admin roles in release 1.

## 6. Notes

- The access token is held in JavaScript memory only; it is not stored in localStorage. Refresh is expected to use an HttpOnly cookie.
- `VITE_DEMO_MODE=true` persists sample UI edits in localStorage. Clear `smm-demo-*` keys in browser storage to reset the demo data.
- This is a frontend demo/integration starter, not a security certification or a substitute for backend authorization. Never expose admin APIs to the public until MFA, session controls, CSRF, rate limiting, audit logging and exact-origin CORS are complete.


### Google button does not appear or does not open

- Check `.env.development` contains `VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com` (use the actual Web OAuth Client ID; do not include quotes).
- Set the identical public Web OAuth Client ID in the backend's `GOOGLE_CLIENT_ID` environment variable.
- In Google Cloud Console, add `http://localhost:5173` under Authorized JavaScript origins. For Vercel, add the exact deployed origin too.
- Stop and restart `npm run dev` after editing `.env.development`; Vite environment variables are read at startup.
- Confirm the browser can load `https://accounts.google.com/gsi/client` and that no browser extension is blocking it.
- If the browser's OAuth popup reports `origin_mismatch`, correct the Authorized JavaScript origins in Google Cloud Console.

The Google Client ID is public and may be exposed in the frontend. Never put a Google Client Secret, JWT secret, MSG91 Authkey, database password or other server secret in a `VITE_*` variable.
