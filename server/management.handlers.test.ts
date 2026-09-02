import { describe, expect, it, beforeEach } from "vitest";
import clientsHandler from "../api/management/clients";
import eventsHandler from "../api/management/events";
import subaccountsHandler from "../api/management/subaccounts";
import gateHandler from "../api/gate/checkin";

function responseMock() { const state: any = {}; return { state, status(code: number) { state.code = code; return this; }, json(body: unknown) { state.body = body; return this; }, setHeader() { return this; }, end() { return this; } } as any; }

describe("management and gate handler boundaries", () => {
  beforeEach(() => { process.env.ADMIN_USERNAME = "admin"; process.env.ADMIN_PASSWORD = "password"; });
  it("rejects unauthenticated client, event, and subaccount management calls", async () => {
    for (const handler of [clientsHandler, eventsHandler, subaccountsHandler]) { const res = responseMock(); await handler({ method: "GET", headers: {} } as any, res); expect(res.state.code).toBe(401); }
  });
  it("rejects unauthenticated gate check-in calls", async () => {
    const res = responseMock(); await gateHandler({ method: "POST", headers: {}, body: {} } as any, res); expect(res.state.code).toBe(401);
  });
});
