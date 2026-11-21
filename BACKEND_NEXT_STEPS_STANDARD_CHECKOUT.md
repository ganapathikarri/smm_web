# Backend audit & next implementation: Razorpay Standard Checkout

## Sources inspected

- Original uploaded `smm-platform-api (2).zip`: Spring Boot + Phase 2 catalogue; payment and wallet packages are placeholders.
- Previously generated `smm-platform-api-phase3-razorpay-source.zip`: implements Razorpay **UPI QR** endpoints under `/api/v1/wallet`, not the new Standard Checkout (`/api/v1/customer/wallet`) code.
- Uploaded `smm_backup.sql`: contains `payment_intents`, `wallet_topups`, `payment_events`, `bank_transactions`, `ledger_transactions`, `ledger_entries` and `wallet_accounts`, including idempotency and uniqueness constraints.
- The user's latest live MySQL query: one ₹50 top-up is `PENDING / CREATED` with an empty `provider_request_id` (Razorpay Order ID).

**Cannot validate:** The current locally edited `TopupCreationService`, `RazorpayOrderClient`, `PaymentController`, signature verification and ledger posting code were not attached in the uploaded backend snapshot. No live Razorpay or MySQL calls were performed. The frontend ZIP does **not** silently replace or fix the backend.

## Priority 0 — Fix order creation before Checkout

1. Confirm `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` exist in **Spring Boot process environment**. Spring Boot does not automatically read a standalone `.env` file. Regenerate any secret previously shared in chat.
2. Add safe exception logging of Razorpay HTTP code, response category and local intent reference; **never log keys, tokens or payer details**.
3. `POST /api/v1/customer/wallet/topups`: validate active verified customer, active wallet, min/max amount and idempotency key; commit the local `payment_intents` and `wallet_topups` record; call `POST https://api.razorpay.com/v1/orders` outside a long database transaction; then commit the returned `order_...` to `payment_intents.provider_request_id` with status `AWAITING_PAYMENT`.
4. Return checkout-ready success **only when** both order ID and key ID are available. If still `CREATED`, return a pending/202 state with no claim of successful payment.
5. On timeout/unknown provider outcome, do **not** blindly create a new Razorpay Order for the same request. First look up/reconcile by the original receipt/reference and persist the matching Order ID after verifying ownership, amount and currency.
6. Add a safe customer ownership-protected `GET /api/v1/customer/wallet/topups/{topupNumber}` with actual top-up status plus a way to safely expose any reconciled order readiness. Do not allow a customer to query another user's payment.

## Priority 1 — Verify Standard Checkout signature and provider capture

Implement `POST /api/v1/customer/wallet/topups/verify` accepting:

```json
{
  "paymentIntentId": "local-public-uuid",
  "razorpay_order_id": "order_example",
  "razorpay_payment_id": "pay_example",
  "razorpay_signature": "signature-from-checkout"
}
```

Backend must:
- Authenticate the customer and look up the saved `PaymentIntent` by its **public ID and current user ID**.
- Use the saved Razorpay Order ID, not the browser's `razorpay_order_id`, when calculating HMAC-SHA256 of `saved_order_id + "|" + payment_id`. Constant-time compare the signature.
- Call Razorpay API server-to-server to fetch the payment; require `captured`, expected order, INR, exact amount, and correct merchant/account. Treat unexpected/late/wrong amount as review-required, not automatically credited.
- Store unique Razorpay payment transaction ID in `bank_transactions` and post the wallet credit **exactly once** in a single MySQL transaction; create balanced `ledger_transactions` / `ledger_entries` and update `wallet_accounts` projection under a lock.
- Respond `status: "CREDITED", walletCredited: true` **only when ledger commit succeeds**; otherwise pending/review status.

## Priority 2 — Durable webhooks and reconciliation

- Razorpay signed webhooks (use the raw request body and a separate webhook secret; verify before any writes).
- Deduplicate `payment_events(provider_code,provider_event_id)`.
- Recover dropped browser callbacks, network failures and provider-created orders whose local update failed.
- Prevent double credit using `bank_transactions(provider_code,provider_transaction_id)` and unique ledger idempotency keys.
- Provide payment/refund exceptions for admin; never directly mutate financial records.
- Test duplicate events, two simultaneous verify requests, amount mismatch, failed payment, lost response, partial payment, wrong order ID, and database rollback.

## UI contract

```json
{
  "success": true,
  "data": {
    "paymentIntentId": "uuid",
    "topupNumber": "TP...",
    "amount": 50.00,
    "amountInPaise": 5000,
    "currencyCode": "INR",
    "status": "AWAITING_PAYMENT",
    "razorpayOrderId": "order_...",
    "razorpayKeyId": "rzp_test_..."
  }
}
```

If either `razorpayOrderId` or `razorpayKeyId` is missing, the frontend will show **Razorpay order not ready** and must not open Checkout.

**UPI + Netbanking:** Do not create a fake bank-account access form or ask for bank credentials. Standard Checkout supplies eligible UPI/banking options inside Razorpay's secure modal. The actual available methods depend on merchant onboarding and payment configuration.

**Launch gate:** Merchant activation/eligibility, source-of-funds and stored-balance legal review (own-services-only prepaid model), tax/refund rules and real-money ledger reconciliation must be approved/tested before accepting live funds.
