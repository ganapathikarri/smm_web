# Phase 4.2 — Order Management visibility and routing fix

## Verified against supplied Phase 4.1 frontend and backend source
- **The order-management API and React component already existed**: `GET /api/v1/admin/orders`, `AdminOrdersLive`. This was NOT missing backend source.
- Original `App.tsx` initialized its admin page to `dashboard` no matter what URL was opened; direct `/admin/orders` navigations landed on Overview, and orders were below six catalogue navigation items.
- The corrected frontend adds a prominent **Order Management** item immediately after Overview and a quick shortcut in the top bar.
- Direct `/admin/orders` now opens the order page; page state persists across refresh/MFA and browser Back/Forward. The existing Vercel rewrite to `index.html` supports this SPA path.
- An empty orders list now explains that successful Razorpay **top-ups are not orders**. Customer must submit service order through the Phase 4 flow.
- API failures distinguish missing route (404), expired JWT (401), wrong role (403), and proxy/backend errors from a genuine empty order list.
- The admin order UI is visible in demo and real modes, but **live API results require `VITE_DEMO_MODE=false`** and the Phase 4.1 backend.

## Important local / deployment checks
1. In MyEclipse run the **Phase 4.1 reporting backend** (not Phase 3). Confirm Swagger shows `GET /api/v1/admin/orders`.
2. In frontend `.env.development` set `VITE_DEMO_MODE=false`, `VITE_API_BASE_URL=`, `VITE_DEV_PROXY_TARGET=http://localhost:8081`. Restart Vite after changes.
3. Open **http://localhost:5173/admin/orders** (live mode). Authenticate as **SUPER_ADMIN** with MFA.
4. In browser DevTools > Network check `/api/v1/admin/orders?page=0&size=20` and its HTTP code. 200 with `data.content: []` means no submitted orders; 401/403 means auth; 404 indicates active backend mismatch; 502/connection error suggests proxy or backend.
5. Test from customer portal: navigate to service catalogue, request quote, then **Confirm & place order**. Wallet top-up alone does NOT create an order.
6. On Vercel set `VITE_DEMO_MODE=false`, set backend HTTPS base URL or verified proxy routing, rebuild/redeploy. Environment variables are applied at build time and stale deployments retain old menus.

## Source-level audit
- Backend `AdminOrderController` uses `/api/v1/admin/orders` with `@PreAuthorize(hasRole('SUPER_ADMIN'))`.
- Backend returns `ApiResponse<Page<OrderResponse>>`; `adminApi.orders()` unwraps `.data`, `normalizePage` reads Spring's `content`, `totalElements` fields.
- `AdminOrdersLive` renders data from `adminApi.orders()` and details/actions via matching backend routes.
- No backend edits required for this visibility fix.
- Source/static checks do not prove your deployed Vercel build or API connectivity; verify the Network response in your environment.
