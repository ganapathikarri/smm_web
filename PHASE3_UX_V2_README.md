# SMM Platform — Customer discovery + guided admin setup (UX v2)

## What changed

**Customer**
- Removed the old “Make your next good idea happen” promotional hero. Replaced with a compact service-discovery introduction.
- Added prominent **Services, Wallet, Orders** navigation cards.
- Added horizontally scrolling **Explore by platform** cards. Clicking a platform opens `/services?platform=<code>` and applies the corresponding filter.
- Added **Services to explore** previews with server-sourced prices. Clicking opens that service's details in `/services?service=<publicId>`.
- Added step-by-step service filters, responsive layout, keyboard focus styles and smooth hover transitions (honors reduced motion).
- Shows UPI apps / netbanking / card as payment method **examples**, not a custom payment form. Actual eligible options are shown by **Razorpay Standard Checkout** after the backend has created a real Order ID.
- Distinguishes **Razorpay order not ready** from **payment verification pending**. A missing Razorpay Order ID never launches Checkout. Added top-up reference copy for support.

**Admin**
- Added a guided, clickable workflow across **Platforms → Categories → Services → Inputs → Pricing → Policy Review → Activate from Services**.
- Each step displays what to enter, why it matters, an example and a Next button.
- Service form includes a description explanation and an editable starter example with deliverables, turnaround and exclusions.
- Input, pricing and policy dialogs include practical field guidance and compliance reminders.
- Added a 'Start guided setup' shortcut to the admin overview page.
- Guide works in live catalogue and also appears above the demo administration pages.

## Run locally

```bash
cd smm-admin-frontend
npm ci
npm run dev
```

Default Vite local URL: `http://localhost:5173` (or the URL printed by Vite).

- Customer overview: `/`
- Services: `/services`
- Filtered platform: `/services?platform=INSTAGRAM`
- Wallet: `/wallet`
- Add Funds on load: `/wallet?addFunds=1`
- Admin console: `/admin` (live mode; admin login and MFA required)

The backend proxy target is controlled by `VITE_DEV_PROXY_TARGET` in `.env.development`. Keep all API secrets on the **backend only**. Vercel uses `VITE_API_BASE_URL` at build time.

## Payment behavior and security

1. `POST /api/v1/customer/wallet/topups` returns a valid provider order ID (`order_...`) and a publishable Razorpay key ID (`rzp_test_...` / `rzp_live_...`) when ready.
2. Clicking **Continue to Razorpay** opens the standard Razorpay payment popup (not a site-owned banking login page). UPI, Netbanking and cards are shown by Razorpay **only if the merchant account/payment is eligible**.
3. The browser receives payment confirmation fields and sends them to `POST /api/v1/customer/wallet/topups/verify`.
4. **Never credit wallet from the browser response alone**. The backend must verify the signature and captured payment details against Razorpay, then perform a single atomic ledger credit.
5. If the provider order ID is missing, the UI displays **Order not ready** with a reference to copy. Do not blindly generate another attempt with the same idempotency key.
6. A failed/missing verification endpoint results in a pending status, **not** a successful wallet credit.

**Known server-side blocker:** The user's database record showed `payment_intents.status = CREATED` and `provider_request_id = NULL`. This frontend deliberately cannot open Checkout for such a record. The backend needs order creation recovery/reconciliation (see `BACKEND_NEXT_STEPS_STANDARD_CHECKOUT.md`).

## Validation

- All 14 TS/TSX source files passed global TypeScript parser/transpilation syntax checks.
- A full production build depends on fetching npm packages; `node_modules` in the available container contained empty package stubs, so `npm run build` could not finish here. Run `npm ci && npm run build` on your machine before deployment.
- No Razorpay secrets are added to frontend code.
