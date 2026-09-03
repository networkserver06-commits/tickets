
## Passage production environment

Set these values in Vercel before enabling live operations. Use the Vite names as the canonical deployment contract: `VITE_PAYSTACK_PUBLIC_KEY` and `VITE_PUBLIC_BASE_URL`. For compatibility with existing Vercel settings, the browser also accepts `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` and `NEXT_PUBLIC_BASE_URL` as aliases. `PAYSTACK_SUBACCOUNT_CODE` is the owner fallback used when an event does not have a client subaccount. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` enable optional ticket confirmations, while `GATE_CHECKIN_PIN` protects the hidden gate route. Existing Paystack, Turso, and QR-link variables remain required for payments and persistence.

| Variable | Purpose |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Server-side Paystack API and webhook verification |
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


## Admin upgrade

Events require an explicit payout-account selection. The admin displays projected and paid amounts in KSh, validates whole-number financial inputs, and reports image storage readiness. Images up to 1 MB use a Forge-independent embedded fallback when managed storage keys are unavailable.
