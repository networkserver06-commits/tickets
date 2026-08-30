# Turso and Paystack deployment setup

The ticketing runtime uses Drizzle ORM with the SQLite schema in `drizzle/ticketing-schema.ts` and the libSQL client in `server/ticketDb.ts`. Add the following variables in Vercel for the Preview and Production environments:

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso database URL, usually beginning with `libsql://` |
| `TURSO_AUTH_TOKEN` | Turso database auth token |
| `PAYSTACK_SECRET_KEY` | Server-only Paystack secret used for HMAC-SHA512 webhook verification |

Apply the generated migration against the selected Turso database from a trusted environment with the Turso CLI or Drizzle Kit, using the project’s SQLite configuration:

```bash
TURSO_DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." pnpm drizzle-kit migrate --config drizzle.ticketing.config.ts
```

Configure Paystack to send successful transaction events to `https://<your-vercel-domain>/api/webhook/paystack`. The handler verifies the exact raw request body, ignores non-success events, idempotently keys orders by Paystack reference, and creates one or more unique `tkt_...` ticket IDs. Ticket scans are sent as JSON to `/api/tickets/verify` with `{ "ticketId": "..." }`; only a ticket currently marked `valid` can be changed to `used`.

The managed Manus project also contains the scaffold authentication database connection. Ticketing data is intentionally isolated behind the Turso/libSQL client so the payment and verification workflows use the SQLite schema described above.
