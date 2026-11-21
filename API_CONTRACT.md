# SMM Platform — API contract (updated Phase 2)

**Source:** matched against the existing Spring Boot `smm-platform-api` Phase 2 controllers, DTOs and their `@RequestMapping` values. This supersedes the original draft contract that mistakenly described Category, Service, Inputs and Pricing as unimplemented and used `/price-versions`.

**Active mode:** `VITE_DEMO_MODE=false` uses real HTTP data. All responses are `{success,message,data,timestamp}`; **current Phase 2 list `data` values are plain arrays**, not paged objects. `/admin/*` uses the authenticated Super Admin JWT after MFA; customer routes use a separately authenticated CUSTOMER JWT.

## Phase 1 — authentication (implemented)

| HTTP | Path | Meaning |
|---|---|---|
| POST | `/api/v1/admin/auth/login` | Password factor → MFA challenge token |
| POST | `/api/v1/admin/auth/mfa/verify` | TOTP / unused recovery code → access JWT & refresh session |
| POST | `/api/v1/admin/auth/refresh` | HttpOnly refresh cookie rotates |
| POST | `/api/v1/admin/auth/logout` | Revoke current session |
| POST | `/api/v1/auth/login`, `/api/v1/auth/register` | Customer authentication / registration |
| POST | `/api/v1/auth/refresh`, `/api/v1/auth/logout` | Customer session management |

Do not send the MFA challenge token as a Bearer token. Do not store JWTs or MFA secrets in committed files.

## Phase 2 — Super Admin management (implemented in backend, integrated in frontend)

All paths begin with `/api/v1/admin/catalog`.

| Area | HTTP endpoints |
|---|---|
| Platforms | GET/POST `/platforms`, GET/PUT `/platforms/{id}`, PATCH `/platforms/{id}/status` |
| Categories | GET/POST `/categories`, GET/PUT `/categories/{id}`, PATCH `/categories/{id}/status` |
| Services | GET/POST `/services`, GET/PUT `/services/{id}`, PATCH `/services/{id}/status`, PATCH `/services/{id}/policy` |
| Inputs | GET/POST `/services/{serviceId}/inputs`, PUT `/services/{serviceId}/inputs/{inputId}`, PATCH `/services/{serviceId}/inputs/{inputId}/status` |
| Price versions | GET/POST `/services/{serviceId}/prices` — immutable version creation |

### Exact backend request fields

- Platform POST: `{code,name,officialPolicyUrl}`; PUT `{name,officialPolicyUrl}`; PATCH `{status,reason?}`.
- Category POST/PUT: `{platformId,parentId,name,slug,sortOrder}`; PATCH `{status,reason}`.
- Service POST: `{serviceCode,platformId,categoryId,name,description}`; PUT excludes `serviceCode`; PATCH status `{status,reason}`.
- Policy review PATCH: `{policyStatus,policyReferenceUrl,reviewNotes,confirmedCompliant}`.
- Input POST: `{inputKey,label,inputType,required,helpText,maxLength,minNumber,maxNumber,allowedValues,sortOrder}`; PUT excludes `inputKey`; PATCH `{active,reason}`.
- Pricing POST: `{rateAmount,rateUnit,fixedPackageQuantity,minimumQuantity,maximumQuantity,minimumCharge,taxMode,taxRatePercent,changeReason}`.

## Phase 2 — customer catalogue (implemented)

| HTTP | Path | Response `data` |
|---|---|---|
| GET | `/api/v1/catalog/platforms` | Active platform array |
| GET | `/api/v1/catalog/categories?platformId=` | Active category array |
| GET | `/api/v1/catalog/services?platformId=&categoryId=&search=` | Published service array |
| GET | `/api/v1/catalog/services/{publicId}` | Published service detail (no price or input array) |
| GET | `/api/v1/catalog/services/{publicId}/inputs` | Active input definitions array |
| GET | `/api/v1/catalog/services/{publicId}/price` | Current price version |
| GET | `/api/v1/catalog/services/{publicId}/price-preview?quantity=N` | `{priceVersionId,quantity,currencyCode,subtotal,taxAmount,total}` |

`src/api/customerApi.ts` composes the service, price, category and input endpoints into the frontend view; no price is calculated on the client.

## Phases 3–5 — deferred backend contracts

Not implemented in the paired backend: wallet summary/top-ups/ledger with verified bank collection; order quotes, order debit and manual fulfilment; support, announcements, reporting and audit list APIs. The frontend retains legacy screens as scaffolding, not completed financial operations. Customer checkout is intentionally replaced by a read-only price estimate until the order backend exists.

Further setup, exact call order and platform icon mapping: see [PHASE2_INTEGRATION.md](PHASE2_INTEGRATION.md).


## Phase 4.1 deployed API addendum (supersedes old planned order fields)

The Phase 4 backend uses `POST /api/v1/customer/orders/quotes` with `{servicePublicId,quantity}` and returns `quoteId,subtotal,taxAmount,total,expiresAt`. `POST /api/v1/customer/orders` takes `{quoteId,inputs,customerNote}` plus a stable `Idempotency-Key`. Customer/admin order lists return Spring Page `{content,totalElements,number,size,totalPages}`; frontend normalizes this. Order detail returns `{order,history,inputs,fulfilment,refunds}`.

The companion backend adds `/api/v1/admin/payments/topups/summary`, `/api/v1/admin/payments/topups`, `/api/v1/admin/customers`, `/api/v1/admin/audit-logs`. All require an active designated SUPER_ADMIN account. `totalCreditedAmount` means verified credited wallet top-ups only, not bank settlements. See `PHASE4_1_FRONTEND_ADMIN_UI_AUDIT.md`.
