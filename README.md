
## Passage production environment

Set these values in Vercel before enabling live operations. Use the Vite names as the canonical deployment contract: `VITE_PAYSTACK_PUBLIC_KEY` and `VITE_PUBLIC_BASE_URL`. For compatibility with existing Vercel settings, the browser also accepts `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` and `NEXT_PUBLIC_BASE_URL` as aliases. `PAYSTACK_SUBACCOUNT_CODE` is the owner fallback used when an event does not have a client subaccount. `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and an independent high-entropy `ADMIN_SESSION_SECRET` are required for admin access. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` enable optional ticket confirmations, while `GATE_CHECKIN_PIN` protects the hidden gate route. Existing Paystack, Turso, and QR-link variables remain required for payments and persistence.

| Variable | Purpose |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Server-side Paystack API and webhook verification |
| `ADMIN_USERNAME` | Admin login username |
| `ADMIN_PASSWORD` | Admin login password |
| `ADMIN_SESSION_SECRET` | Independent secret used to sign admin session cookies |
| `VITE_PAYSTACK_PUBLIC_KEY` | Canonical browser Paystack Inline checkout key |
| `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` | Compatibility alias for the browser checkout key |
| `PAYSTACK_SUBACCOUNT_CODE` | Owner fallback payout subaccount |
| `RESEND_API_KEY` | Optional confirmation email delivery |
| `RESEND_FROM_EMAIL` | Verified Resend sender address |
| `GATE_CHECKIN_PIN` | Hidden venue check-in PIN |
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso authentication token |
| `VITE_PUBLIC_BASE_URL` | Canonical public QR and ticket URL base |
| `NEXT_PUBLIC_BASE_URL` | Compatibility alias for the public URL base |


## Payment methods

The storefront now supports two KES payment paths through Paystack. Card payments use the server-side transaction initialization endpoint at `/api/payments/initialize`, which redirects the customer to Paystack Checkout. Kenya M-Pesa payments use `/api/payments/mpesa` with the Paystack Charge API and the `mobile_money` provider `mpesa`; the storefront checks `/api/payments/status` while waiting for the customer to approve the phone prompt. Successful payments are finalized only by the signed `/api/webhook/paystack` webhook, which issues the event tickets idempotently.

Configure the Paystack webhook URL as `https://YOUR_DOMAIN/api/webhook/paystack` in the Paystack dashboard. The Paystack account must have the relevant Kenya card and Mobile Money channels enabled, and the server must use the secret key while the browser never handles card details.

## Admin upgrade

Events require an explicit payout-account selection. The admin displays projected and paid amounts in KSh, validates whole-number financial inputs, and reports image storage readiness. Images up to 1 MB use a Forge-independent embedded fallback when managed storage keys are unavailable.
