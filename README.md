
## Passage production environment

Set these values in Vercel before enabling live operations. `PAYSTACK_SUBACCOUNT_CODE` is the owner fallback used when an event does not have a client subaccount. `RESEND_API_KEY` and `RESEND_FROM_EMAIL` enable optional ticket confirmations, while `GATE_CHECKIN_PIN` protects the hidden gate route. Existing Paystack, Turso, and QR-link variables remain required for payments and persistence.

| Variable | Purpose |
| --- | --- |
| `PAYSTACK_SECRET_KEY` | Server-side Paystack API and webhook verification |
| `VITE_PAYSTACK_PUBLIC_KEY` | Browser Paystack Inline checkout |
| `PAYSTACK_SUBACCOUNT_CODE` | Owner fallback payout subaccount |
| `RESEND_API_KEY` | Optional confirmation email delivery |
| `RESEND_FROM_EMAIL` | Verified Resend sender address |
| `GATE_CHECKIN_PIN` | Hidden venue check-in PIN |
| `TURSO_DATABASE_URL` | Turso database URL |
| `TURSO_AUTH_TOKEN` | Turso authentication token |
| `NEXT_PUBLIC_BASE_URL` | Public QR and ticket URL base |
