# Wallet Live Frontend Hotfix

- Before top-up, check wallet balance; on a precise 404 `Wallet not found` or `Wallet not initialized` error, initialize the zero-balance wallet using the authenticated backend API.
- Do not initialize on network errors, missing backend routes or generic failures.
- Transaction activity now parses `data.content` from the Spring Data Page returned by `/api/v1/customer/wallet/ledger`.
- Must deploy with corresponding backend hotfix; use Razorpay test mode for end-to-end verification first.
