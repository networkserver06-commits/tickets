import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTicketingRoutes } from "./ticketing";

type Handler = (req: any, res: any, next?: () => unknown) => unknown;
function harness(db: any, adminMiddleware?: Handler) {
  const routes = new Map<string, Handler>();
  const app = {
    post: (path: string, ...handlers: Handler[]) =>
      routes.set(`POST ${path}`, handlers[handlers.length - 1]!),
    get: (path: string, ...handlers: Handler[]) =>
      routes.set(`GET ${path}`, async (req, res) => {
        let index = -1;
        const next = async () => {
          index += 1;
          const handler = handlers[index];
          return handler ? handler(req, res, next) : undefined;
        };
        return next();
      }),
  } as any;
  registerTicketingRoutes(app, () => db, adminMiddleware);
  return routes;
}
function response() {
  const result: { status?: number; body?: unknown } = {};
  return {
    result,
    status(code: number) {
      result.status = code;
      return this;
    },
    json(body: unknown) {
      result.body = body;
      return this;
    },
  };
}

describe("ticketing REST routes", () => {
  afterEach(() => {
    delete process.env.PAYSTACK_SECRET_KEY;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("rejects a webhook with an invalid signature before touching the database", () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const routes = harness({
      select: () => {
        throw new Error("database should not be called");
      },
    });
    const res = response();
    routes.get("POST /api/webhook/paystack")!(
      { body: Buffer.from('{"event":"charge.success"}'), header: () => "bad" },
      res
    );
    expect(res.result).toEqual({
      status: 401,
      body: { error: "Invalid signature" },
    });
  });

  it("requires admin authentication before contacting Paystack", async () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const routes = harness({}, (_req, res) => res.status(401).json({ error: "Admin authentication required" }));
    const res = response();
    await routes.get("GET /api/paystack/transactions")!(
      { headers: {}, query: {} },
      res
    );
    expect(res.result).toEqual({
      status: 401,
      body: { error: "Admin authentication required" },
    });
  });

  it("rejects an authenticated non-admin before contacting Paystack", async () => {
    const routes = harness({}, (_req, res) => res.status(403).json({ error: "Admin role required" }));
    const res = response();
    await routes.get("GET /api/paystack/transactions")!(
      { headers: {}, query: {} },
      res
    );
    expect(res.result).toEqual({
      status: 403,
      body: { error: "Admin role required" },
    });
  });

  it("returns a configuration error when the Paystack secret is missing", async () => {
    delete process.env.PAYSTACK_SECRET_KEY;
    const routes = harness({});
    const res = response();
    await routes.get("GET /api/paystack/transactions")!(
      { headers: {}, query: {} },
      res
    );
    expect(res.result).toEqual({
      status: 503,
      body: { error: "Paystack secret key is not configured" },
    });
  });

  it("maps a Paystack upstream failure to a safe gateway error", async () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ status: false, message: "Unauthorized" }),
            { status: 401, headers: { "content-type": "application/json" } }
          )
        )
    );
    const routes = harness({}, (_req, _res, next) => next?.());
    const res = response();
    await routes.get("GET /api/paystack/transactions")!(
      { headers: {}, query: {} },
      res
    );
    expect(res.result).toEqual({
      status: 502,
      body: { error: "Unauthorized" },
    });
  });

  it("initializes a server-side card checkout from the live event price", async () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.com/test", access_code: "access", status: "initialized" } }), { status: 200, headers: { "content-type": "application/json" } })));
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "EVT-1", title: "Test Event", ticketPrice: 250000, capacity: 100, soldCount: 2, paystackSubaccountCode: "ACCT_test" }],
          }),
        }),
      }),
    };
    const routes = harness(db);
    const res = response();
    await routes.get("POST /api/payments/initialize")!({ body: { eventId: "EVT-1", quantity: 2, name: "Buyer", email: "buyer@example.com", phone: "0723000000" }, protocol: "https", header: (name: string) => name === "x-forwarded-proto" ? "https" : undefined, get: (name: string) => name === "host" ? "tickets.example.com" : undefined }, res);
    expect(res.result.status).toBe(200);
    expect((res.result.body as any).authorizationUrl).toBe("https://checkout.paystack.com/test");
    const request = (fetch as any).mock.calls[0][1];
    const payload = JSON.parse(request.body);
    expect(payload.amount).toBe("500000");
    expect(payload.currency).toBe("KES");
    expect(payload.subaccount).toBe("ACCT_test");
    expect(payload.metadata.eventId).toBe("EVT-1");
  });

  it("starts a Kenya M-Pesa charge with the normalized phone number", async () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: true, data: { reference: "passage-server-reference", status: "pending", display_text: "Approve the prompt" } }), { status: 200, headers: { "content-type": "application/json" } })));
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => [{ id: "EVT-1", title: "Test Event", ticketPrice: 250000, capacity: 100, soldCount: 2, paystackSubaccountCode: "ACCT_test" }],
          }),
        }),
      }),
    };
    const routes = harness(db);
    const res = response();
    await routes.get("POST /api/payments/mpesa")!({ body: { eventId: "EVT-1", quantity: 1, name: "Buyer", email: "buyer@example.com", phone: "0723 000 000" }, protocol: "https", header: () => "https", get: () => "tickets.example.com" }, res);
    expect(res.result.status).toBe(200);
    expect((res.result.body as any).channel).toBe("mobile_money");
    const request = (fetch as any).mock.calls[0][1];
    const payload = JSON.parse(request.body);
    expect(payload.mobile_money).toEqual({ phone: "+254723000000", provider: "mpesa" });
    expect(payload.currency).toBe("KES");
  });

  it("returns not found for a ticket that does not exist", async () => {
    const db = {
      select: () => ({
        from: () => ({ where: () => ({ limit: async () => [] }) }),
      }),
    };
    const routes = harness(db);
    const res = response();
    await routes.get("POST /api/tickets/verify")!(
      { body: { ticketId: "missing" } },
      res
    );
    expect(res.result).toEqual({
      status: 404,
      body: { valid: false, error: "Ticket not found" },
    });
  });
});
