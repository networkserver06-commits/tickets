import handler from "../api/index.ts";

const response = {
  headersSent: false,
  setHeader() {},
  status(code: number) {
    console.log("STATUS", code);
    return this;
  },
  json(payload: unknown) {
    console.log("JSON", JSON.stringify(payload));
    return this;
  },
};

await handler(
  {
    method: "GET",
    url: "/api/management/clients",
    headers: { host: "localhost" },
    query: {},
  } as any,
  response as any,
);
