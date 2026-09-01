import { afterEach, describe, expect, it, vi } from "vitest";
import { registerTicketingRoutes } from "./ticketing";
import { sdk } from "./_core/sdk";

type Handler = (req: any, res: any) => unknown;
function harness(db: any) {
  const routes = new Map<string, Handler>();
  const app = { post: (path: string, ...handlers: Handler[]) => routes.set(`POST ${path}`, handlers[handlers.length - 1]!), get: (path: string, ...handlers: Handler[]) => routes.set(`GET ${path}`, handlers[handlers.length - 1]!) } as any;
  registerTicketingRoutes(app, () => db);
  return routes;
}
function response() { const result: { status?: number; body?: unknown } = {}; return { result, status(code: number) { result.status = code; return this; }, json(body: unknown) { result.body = body; return this; } }; }

describe("ticketing REST routes", () => {
  afterEach(() => { delete process.env.PAYSTACK_SECRET_KEY; vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("rejects a webhook with an invalid signature before touching the database", () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const routes = harness({ select: () => { throw new Error("database should not be called"); } });
    const res = response();
    routes.get("POST /api/webhook/paystack")!({ body: Buffer.from('{"event":"charge.success"}'), header: () => "bad" }, res);
    expect(res.result).toEqual({ status: 401, body: { error: "Invalid signature" } });
  });

  it("requires admin authentication before contacting Paystack", async () => {
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    const routes = harness({});
    const res = response();
    await routes.get("GET /api/paystack/transactions")!({ headers: {}, query: {} }, res);
    expect(res.result).toEqual({ status: 401, body: { error: "Admin authentication required" } });
  });

  it("rejects an authenticated non-admin before contacting Paystack", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ role: "user" } as any);
    const routes = harness({});
    const res = response();
    await routes.get("GET /api/paystack/transactions")!({ headers: {}, query: {} }, res);
    expect(res.result).toEqual({ status: 403, body: { error: "Admin role required" } });
  });

  it("returns a configuration error when the Paystack secret is missing", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ role: "admin" } as any);
    delete process.env.PAYSTACK_SECRET_KEY;
    const routes = harness({});
    const res = response();
    await routes.get("GET /api/paystack/transactions")!({ headers: {}, query: {} }, res);
    expect(res.result).toEqual({ status: 503, body: { error: "Paystack secret key is not configured" } });
  });

  it("maps a Paystack upstream failure to a safe gateway error", async () => {
    vi.spyOn(sdk, "authenticateRequest").mockResolvedValue({ role: "admin" } as any);
    process.env.PAYSTACK_SECRET_KEY = "test-secret";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: false, message: "Unauthorized" }), { status: 401, headers: { "content-type": "application/json" } })));
    const routes = harness({});
    const res = response();
    await routes.get("GET /api/paystack/transactions")!({ headers: {}, query: {} }, res);
    expect(res.result).toEqual({ status: 502, body: { error: "Unauthorized" } });
  });

  it("returns not found for a ticket that does not exist", async () => {
    const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }) };
    const routes = harness(db);
    const res = response();
    await routes.get("POST /api/tickets/verify")!({ body: { ticketId: "missing" } }, res);
    expect(res.result).toEqual({ status: 404, body: { valid: false, error: "Ticket not found" } });
  });
});
