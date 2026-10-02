import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { afterEach, describe, it, mock } from "node:test";
import express, { type Express } from "express";
import { getLicense } from "./license";
import {
  EndpointsApi,
  type ChildMiddlewares,
  type LicenseStatus,
  z,
} from "./index";

const STORE = Symbol.for("express-endpoints-collection.license");

const okOutput = [
  { status: 200 as const, body: z.object({ ok: z.literal(true) }) },
];

const pathOutput = [
  { status: 200 as const, body: z.object({ path: z.string() }) },
];

function resetLicenseSlot(): void {
  delete (globalThis as { [STORE]?: unknown })[STORE];
  delete process.env.EEC_API_KEY;
}

async function settleValidLicense(): Promise<void> {
  resetLicenseSlot();
  process.env.EEC_API_KEY = "test-key";
  const fetchMock = mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(JSON.stringify({ valid: true, expires_at: "2099-01-01" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  );
  try {
    const status = await getLicense();
    if (status.state !== "valid") {
      throw new Error(`expected valid license, received ${status.state}`);
    }
  } finally {
    fetchMock.mock.restore();
  }
}

afterEach(() => {
  resetLicenseSlot();
  mock.restoreAll();
});

async function withServer(
  configure: (app: Express) => void,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const app = express();
  app.use(express.json());
  configure(app);
  const server = await new Promise<ReturnType<typeof app.listen>>(
    (resolve, reject) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
      listening.on("error", reject);
    },
  );
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("EndpointsApi", () => {
  it("shares one cache across collections", async () => {
    await settleValidLicense();
    let calls = 0;
    const api = new EndpointsApi({
      middlewares: {
        cache: { stdTTL: 60, checkperiod: 0, enabled: false },
      },
    });
    const shops = api.createEndpointsCollection({ prefix: "/shops" });
    const account = api.createEndpointsCollection({ prefix: "/account" });
    const cacheKey: ChildMiddlewares = { cache: { key: () => "same" } };

    shops.get(
      "/item",
      { outputSchema: pathOutput, middlewares: cacheKey },
      (_req, res) => {
        calls += 1;
        res.status(200).json({ path: "shops" });
      },
    );
    account.get(
      "/item",
      { outputSchema: pathOutput, middlewares: cacheKey },
      (_req, res) => {
        calls += 1;
        res.status(200).json({ path: "account" });
      },
    );

    await withServer(
      (app) => {
        app.use(api.getRouter());
      },
      async (baseUrl) => {
        const first = await fetch(`${baseUrl}/shops/item`);
        const second = await fetch(`${baseUrl}/account/item`);
        assert.equal(first.status, 200);
        assert.deepEqual(await second.json(), { path: "shops" });
        assert.equal(calls, 1);
      },
    );
  });

  it("uses an injected cache store and replays statusCode", async () => {
    await settleValidLicense();
    const entries = new Map<string, unknown>();
    let sets = 0;
    let calls = 0;
    const api = new EndpointsApi({
      cacheStore: {
        get: (key) => entries.get(key),
        set: (key, value) => {
          sets += 1;
          entries.set(key, value);
        },
        del: (key) => {
          entries.delete(key);
        },
      },
      middlewares: {
        cache: {},
      },
    });
    const shops = api.createEndpointsCollection();
    const createdOutput = [
      { status: 201 as const, body: z.object({ ok: z.literal(true) }) },
    ];

    shops.post(
      "/item",
      { outputSchema: createdOutput, middlewares: { cache: true } },
      (_req, res) => {
        calls += 1;
        res.status(201).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(api.getRouter());
      },
      async (baseUrl) => {
        const first = await fetch(`${baseUrl}/item`, { method: "POST" });
        const second = await fetch(`${baseUrl}/item`, { method: "POST" });
        assert.equal(first.status, 201);
        assert.equal(second.status, 201);
        assert.deepEqual(await second.json(), { ok: true });
        assert.equal(calls, 1);
        assert.equal(sets, 1);
      },
    );
  });

  it("shares one rate limiter and keeps a per-route override separate", async () => {
    await settleValidLicense();
    const api = new EndpointsApi({
      middlewares: {
        rateLimit: {
          windowMs: 60_000,
          limit: 1,
          enabled: false,
          validate: false,
          keyGenerator: () => "client",
        },
      },
    });
    const shops = api.createEndpointsCollection({ prefix: "/shops" });
    const account = api.createEndpointsCollection({ prefix: "/account" });
    shops.get(
      "/one",
      { outputSchema: okOutput, middlewares: { rateLimit: true } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    account.get(
      "/two",
      { outputSchema: okOutput, middlewares: { rateLimit: true } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    shops.get(
      "/loose",
      { outputSchema: okOutput, middlewares: { rateLimit: { limit: 5 } } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(api.getRouter());
      },
      async (baseUrl) => {
        const first = await fetch(`${baseUrl}/shops/one`);
        const second = await fetch(`${baseUrl}/account/two`);
        const loose = await fetch(`${baseUrl}/shops/loose`);
        assert.equal(first.status, 200);
        assert.equal(second.status, 429);
        assert.equal(loose.status, 200);
      },
    );
  });

  it("serves a route registered after the collection is mounted", async () => {
    const api = new EndpointsApi();
    const shops = api.createEndpointsCollection({ prefix: "/shops" });

    await withServer(
      (app) => {
        app.use(api.getRouter());
        shops.get("/late", { outputSchema: okOutput }, (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/shops/late`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      },
    );
  });

  it("collects endpoints and OpenAPI paths from every collection", () => {
    const api = new EndpointsApi();
    const shops = api.createEndpointsCollection({ prefix: "/shops" });
    const account = api.createEndpointsCollection({ prefix: "/account" });
    shops.get("/a", { outputSchema: okOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    account.post(
      "/b",
      {
        inputSchema: { body: z.object({ name: z.string() }) },
        outputSchema: okOutput,
      },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    assert.deepEqual(
      api.getEndpoints().map((endpoint) => [endpoint.method, endpoint.path]),
      [
        ["get", "/shops/a"],
        ["post", "/account/b"],
      ],
    );

    const document = api.generateOpenAPI({
      title: "Shared",
      version: "1.0.0",
      servers: ["http://localhost"],
      asJson: true,
    }) as { paths?: Record<string, unknown> };

    assert.ok(document.paths?.["/shops/a"]);
    assert.ok(document.paths?.["/account/b"]);
  });

  it("does not fetch a license when EEC_API_KEY is unset", async () => {
    resetLicenseSlot();
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("should not fetch");
    });

    const api = new EndpointsApi();
    const status: LicenseStatus = await api.getLicense();

    assert.deepEqual(status, { state: "missing" });
    assert.equal(fetchMock.mock.calls.length, 0);
  });
});
