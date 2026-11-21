# SocialSuite — Phase 3 Wallet & Razorpay Standard Checkout Frontend

## What changed

This ZIP extends the uploaded **SMM_Phase2_Frontend_Integrated.zip** (React 18 + Vite 5 + TypeScript). It does **not** overwrite the existing Spring Boot backend or the Phase 2 admin interface.

- Premium customer wallet with larger typography, live balance, reserved funds, trustworthy copy, and verified-credit guidance.
- Direct customer URLs: `/wallet` and `/services`, plus `/wallet?addFunds=1` to open the top-up dialog automatically.
- **Add funds** links on customer header, sidebar, overview hero, overview promo card, wallet, services page, and service estimate modal.
- Razorpay Standard Checkout popup, preset amounts (₹200/₹500/₹1,000/₹2,000), input validation, payment reference, reopen checkout.
- Accessible toast messages: success, information, warning, failure; responsive desktop/mobile styles.
- Existing `/api/v1/customer/wallet/balance` used for balance. One-click `/initialize` for new wallets.
- No balance credit based on browser-only payment success. The page only claims credit when the backend explicitly responds `CREDITED` or `walletCredited: true`.

## Start locally

1. Extract the ZIP.
2. In the `smm-admin-frontend` folder run `npm ci` and `npm run dev`.
3. Spring Boot API must be running at `http://localhost:8081` (the original uploaded backend used port 8081).
4. Visit `http://localhost:5173/`, log in with a CUSTOMER account, then choose **My wallet** or **Add funds**.
5. Direct wallet link: `http://localhost:5173/wallet`. Direct Add Funds link: `http://localhost:5173/wallet?addFunds=1`.
6. Keep `VITE_DEMO_MODE=false` in `.env.development`; demo mode displays the older mock console instead of this live customer frontend.
7. If your backend uses a different port, change only `VITE_DEV_PROXY_TARGET` in `.env.development`.

### Production

Set `VITE_API_BASE_URL` to your **HTTPS backend origin** or configure same-origin `/api` reverse proxy. Ensure Spring Security/CORS/cookies are configured appropriately. Deploy React with the included `vercel.json` SPA rewrite.

**Never** place `RAZORPAY_KEY_SECRET` or a Razorpay webhook secret in any Vite `VITE_*` setting. The public Key ID is delivered via the authenticated backend order-creation response.

## Backend API contract expected

The frontend calls your existing/in-progress Spring Boot APIs:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/customer/wallet/balance` | Live wallet (`availableBalance`, `reservedBalance`, `currencyCode`, `status`) |
| POST | `/api/v1/customer/wallet/initialize` | Create zero-balance wallet and two ledger accounts, idempotently |
| POST | `/api/v1/customer/wallet/topups` | Create Razorpay Order for authenticated CUSTOMER |
| POST | `/api/v1/customer/wallet/topups/verify` | **Still required on backend**: verify checkout signature and captured payment, credit ledger once |
| GET | `/api/v1/customer/wallet/topups/{topupNumber}` | **Optional/if implemented**: check payment/credit status |
| GET | `/api/v1/customer/wallet/ledger?page=0&size=20` | **Optional/if implemented**: wallet statement |

All API responses use the existing `ApiResponse` envelope containing a `data` field. All calls send the current CUSTOMER JWT and existing refresh cookie handling.

### Create top-up request

`POST /api/v1/customer/wallet/topups`

- Header `Idempotency-Key`: a fresh UUID for a new attempt; reused during retries of the **same** attempt.
- Body: `{"amount":"500.00"}`.
- Response `data` should be shaped like:

```json
{
  "paymentIntentId": "db-public-id",
  "topupNumber": "TP...",
  "amount": 500.00,
  "amountInPaise": 50000,
  "currencyCode": "INR",
  "status": "AWAITING_PAYMENT",
  "razorpayOrderId": "order_...",
  "razorpayKeyId": "rzp_test_..."
}
```

If the provider order is still being prepared and `razorpayOrderId` or `razorpayKeyId` is missing, the UI **does not open** Checkout. It shows a pending state and asks the customer not to create another payment before checking it.

### Verify top-up request — **must be implemented server-side**

After successful Razorpay modal callback, this frontend sends:

`POST /api/v1/customer/wallet/topups/verify`

```json
{
  "paymentIntentId": "db-public-id",
  "razorpay_order_id": "order_...",
  "razorpay_payment_id": "pay_...",
  "razorpay_signature": "hex-signature"
}
```

**Required backend behavior before reporting `CREDITED`:**

1. Authenticate CUSTOMER and verify payment intent ownership. Load the saved provider Order ID **from your database**, never trust the browser-provided Order ID alone.
2. Verify HMAC-SHA256 over `savedOrderId + '|' + razorpay_payment_id` using the **backend** Razorpay API Key Secret; compare in constant time. Reject bad or missing signatures.
3. Query Razorpay's API server-to-server for the payment and confirm `status=captured`, `order_id`, amount in paise, currency `INR`, intended merchant/account and payment intent match. A valid signature alone is **not** sufficient to credit funds.
4. In one atomic database transaction with row locking and unique idempotency/transaction references, post balanced `BANK_CLEARING` DEBIT and customer `WALLET_AVAILABLE` CREDIT journal lines and update the wallet projection **once**, even under callbacks/retries.
5. Handle duplicates, wrong/partial amount, expired/reversed payments, unknown orders, provider timeouts and webhook replay. Persist events for reconciliation and refund/dispute handling; never blindly credit.
6. Only when the wallet journal is posted, respond with `data: {"status":"CREDITED", "walletCredited":true }`. Otherwise reply with explicit pending/review state, or an appropriate error response.
7. Secure the webhook separately with Razorpay's webhook secret and raw-body HMAC validation; webhook reconciliation is still needed when the browser is closed before response.

If this verify endpoint does not exist in your backend yet, the UI will **show a pending/verification unavailable state rather than claim success**. The original uploaded frontend cannot make the backend verify payments on its own.

## Test checklist

- [ ] Login as CUSTOMER; visit `/wallet`, `/services`, `/wallet?addFunds=1` (including refresh/navigation).
- [ ] Wallet initialized if empty; balance displays live server value.
- [ ] Top-up with amount below ₹1 rejected by UI; excessive values rejected by backend limits.
- [ ] `POST /topups` returns valid `order_...` and public `rzp_test_...` key ID.
- [ ] Standard Checkout modal opens on a supported browser/device in Razorpay **Test Mode**.
- [ ] Close Checkout: informative toast, reopen same Order; no second order created.
- [ ] `payment.failed`: error toast; balance unchanged.
- [ ] Successful Checkout: frontend calls backend verify endpoint; wallet remains unchanged until verified ledger credit.
- [ ] Duplicate/replayed signature requests never credit a second time.
- [ ] Wrong amount, wrong order, invalid signature rejected; balance unchanged.
- [ ] Refresh wallet: real value shown; statement endpoint gracefully reports unavailable if not implemented.

**Security:** The previously pasted test secret was disclosed in conversation. Rotate/regenerate those Razorpay credentials before use, and never expose the new secret in source, browser, screenshots, or messages.

**Compliance:** Before enabling Live Mode or accepting customer funds, complete merchant/acquirer approval, wallet and PPI legal review, refund/dispute handling, tax/accounting decisions and full financial integration testing.
