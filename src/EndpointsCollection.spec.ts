import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express, { type ErrorRequestHandler, type Express } from "express";
import { sign } from "jsonwebtoken";
import { z } from "zod";
import {
  defineMiddlewares,
  EndpointsCollection,
  type CollectionConfig,
  type CollectionMiddlewares,
  type EndpointMiddlewares,
  type JwtUnauthorizedReason,
  type RequestLogInfo,
  z as zFromLibrary,
} from "./index";

const emptyOkOutput = [
  { status: 200 as const, body: z.object({ ok: z.literal(true) }) },
];

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
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

describe("EndpointsCollection", () => {
  it("should register a GET route without input schema and return handler JSON", async () => {
    const collection = new EndpointsCollection();
    collection.get("/ping", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/ping`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      },
    );
  });

  it("should prepend collectionPrefix to registered paths on the router", async () => {
    const collection = new EndpointsCollection({ collectionPrefix: "/api/v1" });
    collection.get("/test", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const notFound = await fetch(`${baseUrl}/test`);
        assert.equal(notFound.status, 404);

        const hit = await fetch(`${baseUrl}/api/v1/test`);
        assert.equal(hit.status, 200);
        assert.deepEqual(await hit.json(), { ok: true });
      },
    );
  });

  it("should coerce string query values to numbers per Zod schema before the handler runs", async () => {
    const collection = new EndpointsCollection();
    collection.get(
      "/query",
      {
        inputSchema: { query: z.object({ id: z.number() }) },
        outputSchema: [
          {
            status: 200,
            body: z.object({ id: z.number(), typeofId: z.literal("number") }),
          },
        ],
      },
      (req, res) => {
        assert.equal(typeof req.query.id, "number");
        res.status(200).json({ id: req.query.id, typeofId: "number" });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/query?id=123`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          id: 123,
          typeofId: "number",
        });
      },
    );
  });

  it("should respond 400 with default Zod issue payload when body fails validation", async () => {
    const collection = new EndpointsCollection();
    collection.post(
      "/items",
      {
        inputSchema: {
          body: z.object({ name: z.string().min(1) }),
        },
        outputSchema: [{ status: 200, body: z.object({ name: z.string() }) }],
      },
      (req, res) => {
        res.status(200).json({ name: req.body.name });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        assert.equal(response.status, 400);
        const body = (await response.json()) as { error: unknown };
        assert.ok(Array.isArray(body.error));
        assert.ok((body.error as { path?: unknown[] }[]).length > 0);
      },
    );
  });

  it("should parse numeric path params when valid and reject non-numeric params with 400", async () => {
    const collection = new EndpointsCollection();
    collection.get(
      "/users/:userId",
      {
        inputSchema: { params: z.object({ userId: z.number() }) },
        outputSchema: [{ status: 200, body: z.object({ userId: z.number() }) }],
      },
      (req, res) => {
        res.status(200).json({ userId: req.params.userId });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const ok = await fetch(`${baseUrl}/users/42`);
        assert.equal(ok.status, 200);
        assert.deepEqual(await ok.json(), { userId: 42 });

        const bad = await fetch(`${baseUrl}/users/not-a-number`);
        assert.equal(bad.status, 400);
      },
    );
  });

  it("should require declared headers and return 400 when a required header is missing", async () => {
    const collection = new EndpointsCollection();
    collection.get(
      "/secure",
      {
        inputSchema: {
          headers: z.object({ "x-api-key": z.string().min(1) }),
        },
        outputSchema: [
          { status: 200, body: z.object({ authorized: z.literal(true) }) },
        ],
      },
      (_req, res) => {
        res.status(200).json({ authorized: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const missing = await fetch(`${baseUrl}/secure`);
        assert.equal(missing.status, 400);

        const ok = await fetch(`${baseUrl}/secure`, {
          headers: { "x-api-key": "secret" },
        });
        assert.equal(ok.status, 200);
        assert.deepEqual(await ok.json(), { authorized: true });
      },
    );
  });

  it("should use customErrorHandler payload for Zod validation failures", async () => {
    const collection = new EndpointsCollection({
      customErrorHandler: (_error, validationDetails) => ({
        customError: validationDetails,
      }),
    });
    collection.post(
      "/echo",
      {
        inputSchema: { body: z.object({ value: z.number() }) },
        outputSchema: [{ status: 200, body: z.object({ value: z.number() }) }],
      },
      (req, res) => {
        res.status(200).json({ value: req.body.value });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/echo`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ value: "not-a-number" }),
        });
        assert.equal(response.status, 400);
        const body = (await response.json()) as { customError: unknown };
        assert.ok(Array.isArray(body.customError));
      },
    );
  });

  it("should run beforeInputValidation, validation, afterInputValidation, then the handler in order", async () => {
    const collection = new EndpointsCollection();
    const order: string[] = [];

    collection.get(
      "/ordered",
      {
        inputSchema: { query: z.object({ n: z.coerce.number() }) },
        outputSchema: [
          { status: 200, body: z.object({ order: z.array(z.string()) }) },
        ],
        beforeInputValidation: [
          (_req, _res, next) => {
            order.push("before");
            next();
          },
        ],
        afterInputValidation: [
          (_req, _res, next) => {
            order.push("after");
            next();
          },
        ],
        beforeResponse: [
          (_req, _res, next) => {
            order.push("after");
            next();
          },
        ],
      },
      (_req, res) => {
        order.push("handler");
        res.status(200).json({ order: [...order] });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/ordered?n=1`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          order: ["before", "after", "handler"],
        });
      },
    );
  });

  it("should expose POST, PUT, DELETE, and PATCH handlers on distinct paths", async () => {
    const collection = new EndpointsCollection();
    const methodBody = z.object({ method: z.string() });

    collection.post(
      "/m/post",
      { outputSchema: [{ status: 200, body: methodBody }] },
      (_req, res) => {
        res.status(200).json({ method: "post" });
      },
    );
    collection.put(
      "/m/put",
      { outputSchema: [{ status: 200, body: methodBody }] },
      (_req, res) => {
        res.status(200).json({ method: "put" });
      },
    );
    collection.delete(
      "/m/delete",
      { outputSchema: [{ status: 200, body: methodBody }] },
      (_req, res) => {
        res.status(200).json({ method: "delete" });
      },
    );
    collection.patch(
      "/m/patch",
      { outputSchema: [{ status: 200, body: methodBody }] },
      (_req, res) => {
        res.status(200).json({ method: "patch" });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const postRes = await fetch(`${baseUrl}/m/post`, { method: "POST" });
        assert.equal(postRes.status, 200);
        assert.deepEqual(await postRes.json(), { method: "post" });

        const putRes = await fetch(`${baseUrl}/m/put`, { method: "PUT" });
        assert.equal(putRes.status, 200);
        assert.deepEqual(await putRes.json(), { method: "put" });

        const delRes = await fetch(`${baseUrl}/m/delete`, { method: "DELETE" });
        assert.equal(delRes.status, 200);
        assert.deepEqual(await delRes.json(), { method: "delete" });

        const patchRes = await fetch(`${baseUrl}/m/patch`, { method: "PATCH" });
        assert.equal(patchRes.status, 200);
        assert.deepEqual(await patchRes.json(), { method: "patch" });
      },
    );
  });

  it("should propagate synchronous handler errors to Express error middleware as 500", async () => {
    const collection = new EndpointsCollection();
    collection.get("/boom", { outputSchema: emptyOkOutput }, () => {
      throw new Error("Internal");
    });

    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
      const message = err instanceof Error ? err.message : "error";
      res.status(500).json({ message });
    };

    await withServer(
      (app) => {
        app.use(collection.getRouter());
        app.use(errorHandler);
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/boom`);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { message: "Internal" });
      },
    );
  });

  it("should validate multiple path segments like /users/:userId/posts/:postId", async () => {
    const collection = new EndpointsCollection();
    collection.get(
      "/users/:userId/posts/:postId",
      {
        inputSchema: {
          params: z.object({
            userId: z.coerce.number(),
            postId: z.coerce.number(),
          }),
        },
        outputSchema: [
          {
            status: 200,
            body: z.object({
              userId: z.number(),
              postId: z.number(),
            }),
          },
        ],
      },
      (req, res) => {
        res.status(200).json({
          userId: req.params.userId,
          postId: req.params.postId,
        });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/users/10/posts/99`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { userId: 10, postId: 99 });
      },
    );
  });

  it("should allow handlers to return different declared status bodies (200 vs 404)", async () => {
    const collection = new EndpointsCollection();
    collection.get(
      "/resource/:id",
      {
        inputSchema: { params: z.object({ id: z.string() }) },
        outputSchema: [
          {
            status: 200,
            body: z.object({ found: z.literal(true), id: z.string() }),
          },
          { status: 404, body: z.object({ found: z.literal(false) }) },
        ],
      },
      (req, res) => {
        if (req.params.id === "missing") {
          res.status(404).json({ found: false });
          return;
        }
        res.status(200).json({ found: true, id: req.params.id });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const ok = await fetch(`${baseUrl}/resource/abc`);
        assert.equal(ok.status, 200);
        assert.deepEqual(await ok.json(), { found: true, id: "abc" });

        const notFound = await fetch(`${baseUrl}/resource/missing`);
        assert.equal(notFound.status, 404);
        assert.deepEqual(await notFound.json(), { found: false });
      },
    );
  });

  it("should accept standard Express middleware in beforeInputValidation (e.g. sets a header)", async () => {
    const collection = new EndpointsCollection();
    collection.get(
      "/traced",
      {
        outputSchema: [
          { status: 200, body: z.object({ traceHeader: z.string() }) },
        ],
        beforeInputValidation: [
          (_req, res, next) => {
            res.setHeader("x-trace", "from-middleware");
            next();
          },
        ],
      },
      (_req, res) => {
        const traceHeader = res.getHeader("x-trace");
        res.status(200).json({
          traceHeader: typeof traceHeader === "string" ? traceHeader : "",
        });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/traced`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-trace"), "from-middleware");
        assert.deepEqual(await response.json(), {
          traceHeader: "from-middleware",
        });
      },
    );
  });

  it("should work when the collection router is mounted under a parent path with app.use", async () => {
    const collection = new EndpointsCollection();
    collection.get(
      "/items",
      {
        outputSchema: [
          { status: 200, body: z.object({ path: z.literal("/nested/items") }) },
        ],
      },
      (_req, res) => {
        res.status(200).json({ path: "/nested/items" });
      },
    );

    await withServer(
      (app) => {
        app.use("/nested", collection.getRouter());
      },
      async (baseUrl) => {
        const miss = await fetch(`${baseUrl}/items`);
        assert.equal(miss.status, 404);

        const hit = await fetch(`${baseUrl}/nested/items`);
        assert.equal(hit.status, 200);
        assert.deepEqual(await hit.json(), { path: "/nested/items" });
      },
    );
  });

  it("should support PUT with JSON body for typical update-resource flows", async () => {
    const collection = new EndpointsCollection();
    collection.put(
      "/profile",
      {
        inputSchema: {
          body: z.object({
            displayName: z.string().min(1),
            bio: z.string().optional(),
          }),
        },
        outputSchema: [
          {
            status: 200,
            body: z.object({
              displayName: z.string(),
              bio: z.string().optional(),
            }),
          },
        ],
      },
      (req, res) => {
        res.status(200).json({
          displayName: req.body.displayName,
          bio: req.body.bio,
        });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/profile`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: "Ada",
            bio: "Engineer",
          }),
        });
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), {
          displayName: "Ada",
          bio: "Engineer",
        });
      },
    );
  });

  it("should merge collectionPrefix with app.use mount path for full URL shape", async () => {
    const collection = new EndpointsCollection({ collectionPrefix: "/v2" });
    collection.get(
      "/health",
      {
        outputSchema: [
          { status: 200, body: z.object({ ok: z.literal(true) }) },
        ],
      },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use("/api", collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/api/v2/health`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      },
    );
  });
});

describe("built-in middlewares", () => {
  const secret = "secret";

  function token(sub = "1"): string {
    return sign({ sub }, secret, { algorithm: "HS256" });
  }

  it("should keep working when middlewares are omitted", async () => {
    const collection = new EndpointsCollection();
    collection.get("/ping", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/ping`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      },
    );
  });

  it("should leave JWT off when the collection does not set enabled true", async () => {
    const collection = new EndpointsCollection({
      middlewares: { jwt: { secret } },
    });
    collection.get("/open", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/open`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      },
    );
  });

  it("should require JWT on every route when collection jwt is enabled true", async () => {
    const collection = new EndpointsCollection({
      middlewares: { jwt: { secret, enabled: true } },
    });
    collection.get("/private", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const missing = await fetch(`${baseUrl}/private`);
        assert.equal(missing.status, 401);
        assert.deepEqual(await missing.json(), {
          error: "Missing Authorization Header",
        });

        const ok = await fetch(`${baseUrl}/private`, {
          headers: { authorization: `Bearer ${token()}` },
        });
        assert.equal(ok.status, 200);
        assert.deepEqual(await ok.json(), { ok: true });
      },
    );
  });

  it("should skip JWT when the endpoint sets jwt false", async () => {
    const collection = new EndpointsCollection({
      middlewares: { jwt: { secret, enabled: true } },
    });
    collection.get(
      "/public",
      { outputSchema: emptyOkOutput, middlewares: { jwt: false } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/public`);
        assert.equal(response.status, 200);
      },
    );
  });

  it("should allow a missing header when required is false and still reject a bad token", async () => {
    let verified = 0;
    const collection = new EndpointsCollection({
      middlewares: {
        jwt: {
          secret,
          onVerified: () => {
            verified += 1;
          },
        },
      },
    });
    collection.get(
      "/optional",
      {
        outputSchema: emptyOkOutput,
        middlewares: { jwt: { required: false } },
      },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const open = await fetch(`${baseUrl}/optional`);
        assert.equal(open.status, 200);
        assert.equal(verified, 0);

        const bad = await fetch(`${baseUrl}/optional`, {
          headers: { authorization: "Bearer not-a-token" },
        });
        assert.equal(bad.status, 401);
      },
    );
  });

  it("should set req.userId from onVerified and reject when it returns false", async () => {
    const userOutput = [
      { status: 200 as const, body: z.object({ userId: z.number() }) },
    ];
    const accepted = new EndpointsCollection({
      middlewares: {
        jwt: {
          secret,
          enabled: true,
          onVerified: (decoded, req) => {
            (req as Express["request"] & { userId?: number }).userId = Number(
              decoded.sub,
            );
          },
        },
      },
    });
    accepted.get("/me", { outputSchema: userOutput }, (req, res) => {
      const userId = (req as Express["request"] & { userId?: number }).userId;
      res.status(200).json({ userId: userId ?? 0 });
    });

    const rejected = new EndpointsCollection({
      middlewares: {
        jwt: { secret, enabled: true, onVerified: () => false },
      },
    });
    rejected.get("/nope", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(accepted.getRouter());
        app.use(rejected.getRouter());
      },
      async (baseUrl) => {
        const ok = await fetch(`${baseUrl}/me`, {
          headers: { authorization: `Bearer ${token("7")}` },
        });
        assert.equal(ok.status, 200);
        assert.deepEqual(await ok.json(), { userId: 7 });

        const denied = await fetch(`${baseUrl}/nope`, {
          headers: { authorization: `Bearer ${token()}` },
        });
        assert.equal(denied.status, 401);
        assert.deepEqual(await denied.json(), { error: "Unauthorized" });
      },
    );
  });

  it("should use onUnauthorized for the failure body", async () => {
    const collection = new EndpointsCollection({
      middlewares: {
        jwt: {
          secret,
          enabled: true,
          onUnauthorized: (reason) => ({
            status: 403,
            body: { errorCode: reason },
          }),
        },
      },
    });
    collection.get("/private", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/private`);
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), {
          errorCode: "missing_authorization",
        });
      },
    );
  });

  it("should cache a JSON body when the endpoint sets cache true", async () => {
    let calls = 0;
    const collection = new EndpointsCollection({
      middlewares: {
        cache: { stdTTL: 60, checkperiod: 0, enabled: false },
      },
    });
    collection.get(
      "/cached",
      { outputSchema: emptyOkOutput, middlewares: { cache: true } },
      (_req, res) => {
        calls += 1;
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const first = await fetch(`${baseUrl}/cached`);
        const second = await fetch(`${baseUrl}/cached`);
        assert.equal(first.status, 200);
        assert.deepEqual(await second.json(), { ok: true });
        assert.equal(calls, 1);
      },
    );
  });

  it("should use an endpoint cache key for that route only", async () => {
    const pathOutput = [
      { status: 200 as const, body: z.object({ path: z.string() }) },
    ];
    let calls = 0;
    const collection = new EndpointsCollection({
      middlewares: { cache: { stdTTL: 60, checkperiod: 0, enabled: false } },
    });
    collection.get(
      "/a",
      {
        outputSchema: pathOutput,
        middlewares: { cache: { key: () => "fixed" } },
      },
      (_req, res) => {
        calls += 1;
        res.status(200).json({ path: "a" });
      },
    );
    collection.get(
      "/b",
      {
        outputSchema: pathOutput,
        middlewares: { cache: { key: () => "fixed" } },
      },
      (_req, res) => {
        calls += 1;
        res.status(200).json({ path: "b" });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        await fetch(`${baseUrl}/a`);
        const second = await fetch(`${baseUrl}/b`);
        assert.deepEqual(await second.json(), { path: "a" });
        assert.equal(calls, 1);
      },
    );
  });

  it("should share the collection rate limiter and use a separate limiter for an override", async () => {
    const collection = new EndpointsCollection({
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
    collection.get(
      "/one",
      { outputSchema: emptyOkOutput, middlewares: { rateLimit: true } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    collection.get(
      "/two",
      { outputSchema: emptyOkOutput, middlewares: { rateLimit: true } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );
    collection.get(
      "/loose",
      {
        outputSchema: emptyOkOutput,
        middlewares: { rateLimit: { limit: 5 } },
      },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const first = await fetch(`${baseUrl}/one`);
        const second = await fetch(`${baseUrl}/two`);
        const loose = await fetch(`${baseUrl}/loose`);
        assert.equal(first.status, 200);
        assert.equal(second.status, 429);
        assert.equal(loose.status, 200);
      },
    );
  });

  it("should not limit a route that sets rateLimit false", async () => {
    const collection = new EndpointsCollection({
      middlewares: {
        rateLimit: {
          windowMs: 60_000,
          limit: 1,
          enabled: true,
          validate: false,
          keyGenerator: () => "client",
        },
      },
    });
    collection.get("/limited", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    collection.get(
      "/open",
      { outputSchema: emptyOkOutput, middlewares: { rateLimit: false } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        await fetch(`${baseUrl}/limited`);
        const blocked = await fetch(`${baseUrl}/limited`);
        const open = await fetch(`${baseUrl}/open`);
        assert.equal(blocked.status, 429);
        assert.equal(open.status, 200);
      },
    );
  });

  it("should log the finished response and skip logging when disabled", async () => {
    const entries: RequestLogInfo[] = [];
    const collection = new EndpointsCollection({
      middlewares: {
        requestLogger: {
          enabled: true,
          log: (info) => {
            entries.push(info);
          },
        },
      },
    });
    collection.get("/logged", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });
    collection.get(
      "/quiet",
      { outputSchema: emptyOkOutput, middlewares: { requestLogger: false } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        await fetch(`${baseUrl}/logged`);
        await fetch(`${baseUrl}/quiet`);
        assert.equal(entries.length, 1);
        assert.equal(entries[0]?.method, "GET");
        assert.equal(entries[0]?.originalUrl, "/logged");
        assert.equal(entries[0]?.statusCode, 200);
        assert.equal(typeof entries[0]?.durationMs, "number");
      },
    );
  });

  it("should turn thrown handler errors into 500 and let onError replace the body", async () => {
    const logged = new EndpointsCollection({
      middlewares: { errorHandler: { enabled: true } },
    });
    logged.get("/boom", { outputSchema: emptyOkOutput }, () => {
      throw new Error("Internal");
    });

    const mapped = new EndpointsCollection({
      middlewares: {
        errorHandler: {
          enabled: true,
          onError: () => ({ status: 422, body: { errorCode: "boom" } }),
        },
      },
    });
    mapped.get("/mapped", { outputSchema: emptyOkOutput }, () => {
      throw new Error("Internal");
    });

    await withServer(
      (app) => {
        app.use(logged.getRouter());
        app.use(mapped.getRouter());
      },
      async (baseUrl) => {
        const fallback = await fetch(`${baseUrl}/boom`);
        assert.equal(fallback.status, 500);
        assert.equal(await fallback.text(), "Internal Server Error");

        const custom = await fetch(`${baseUrl}/mapped`);
        assert.equal(custom.status, 422);
        assert.deepEqual(await custom.json(), { errorCode: "boom" });
      },
    );
  });

  it("should let an app error handler run when errorHandler is false", async () => {
    const collection = new EndpointsCollection({
      middlewares: { errorHandler: { enabled: true } },
    });
    collection.get(
      "/boom",
      { outputSchema: emptyOkOutput, middlewares: { errorHandler: false } },
      () => {
        throw new Error("Internal");
      },
    );

    const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
      const message = err instanceof Error ? err.message : "error";
      res.status(500).json({ message });
    };

    await withServer(
      (app) => {
        app.use(collection.getRouter());
        app.use(errorHandler);
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/boom`);
        assert.equal(response.status, 500);
        assert.deepEqual(await response.json(), { message: "Internal" });
      },
    );
  });

  it("should use the endpoint validation handler instead of the collection one", async () => {
    const queryOutput = [
      { status: 200 as const, body: z.object({ n: z.number() }) },
    ];
    const collection = new EndpointsCollection({
      customErrorHandler: () => ({ errorCode: "ValidationError" }),
    });
    collection.get(
      "/default",
      {
        inputSchema: { query: z.object({ n: z.number() }) },
        outputSchema: queryOutput,
      },
      (req, res) => {
        res.status(200).json({ n: req.query.n });
      },
    );
    collection.get(
      "/other",
      {
        inputSchema: { query: z.object({ n: z.number() }) },
        outputSchema: queryOutput,
        customErrorHandler: () => ({ errorCode: "Other" }),
      },
      (req, res) => {
        res.status(200).json({ n: req.query.n });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const fallback = await fetch(`${baseUrl}/default`);
        assert.equal(fallback.status, 400);
        assert.deepEqual(await fallback.json(), {
          errorCode: "ValidationError",
        });

        const overridden = await fetch(`${baseUrl}/other`);
        assert.equal(overridden.status, 400);
        assert.deepEqual(await overridden.json(), { errorCode: "Other" });
      },
    );
  });

  it("should throw when an endpoint enables a middleware that was not configured", () => {
    const collection = new EndpointsCollection();
    assert.throws(
      () => {
        collection.get(
          "/x",
          { outputSchema: emptyOkOutput, middlewares: { cache: true } },
          (_req, res) => {
            res.status(200).json({ ok: true });
          },
        );
      },
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          'Middleware "cache" is not configured on this collection',
    );
  });

  it("should leave JWT and cache off when collection enabled is omitted", async () => {
    let calls = 0;
    const collection = new EndpointsCollection({
      middlewares: {
        jwt: { secret },
        cache: { stdTTL: 30, checkperiod: 0 },
      },
    });
    collection.get("/both", { outputSchema: emptyOkOutput }, (_req, res) => {
      calls += 1;
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/both`);
        assert.equal(response.status, 200);
        assert.equal(calls, 1);
      },
    );
  });

  it("should reject a missing token before serving a cached body", async () => {
    let calls = 0;
    const collection = new EndpointsCollection({
      middlewares: {
        jwt: { secret },
        cache: { stdTTL: 30, checkperiod: 0 },
      },
    });
    collection.get(
      "/both",
      {
        outputSchema: emptyOkOutput,
        middlewares: { jwt: true, cache: true },
      },
      (_req, res) => {
        calls += 1;
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/both`);
        assert.equal(response.status, 401);
        assert.equal(calls, 0);
      },
    );
  });

  it("should still run beforeInputValidation beside built-in middleware", async () => {
    const collection = new EndpointsCollection({
      middlewares: { jwt: { secret, enabled: false } },
    });
    collection.get(
      "/traced",
      {
        outputSchema: emptyOkOutput,
        beforeInputValidation: [
          (_req, res, next) => {
            res.setHeader("x-trace", "1");
            next();
          },
        ],
      },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/traced`);
        assert.equal(response.status, 200);
        assert.equal(response.headers.get("x-trace"), "1");
      },
    );
  });

  it("should leave timeout off when the collection does not set enabled true", async () => {
    const collection = new EndpointsCollection({
      middlewares: { timeout: { ms: 50 } },
    });
    collection.get("/open", { outputSchema: emptyOkOutput }, (_req, res) => {
      setTimeout(() => {
        res.status(200).json({ ok: true });
      }, 80);
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/open`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      },
    );
  });

  it("should send 503 when timeout is enabled and the handler is slow", async () => {
    const collection = new EndpointsCollection({
      middlewares: { timeout: { ms: 50 } },
    });
    collection.get(
      "/slow",
      { outputSchema: emptyOkOutput, middlewares: { timeout: true } },
      (_req, res) => {
        setTimeout(() => {
          res.status(200).json({ ok: true });
        }, 80);
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/slow`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: "Request Timeout" });
      },
    );
  });

  it("should skip timeout when the endpoint sets timeout false", async () => {
    const collection = new EndpointsCollection({
      middlewares: { timeout: { ms: 50, enabled: true } },
    });
    collection.get(
      "/open",
      { outputSchema: emptyOkOutput, middlewares: { timeout: false } },
      (_req, res) => {
        setTimeout(() => {
          res.status(200).json({ ok: true });
        }, 80);
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/open`);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { ok: true });
      },
    );
  });

  it("should use a per-route timeout ms override", async () => {
    const collection = new EndpointsCollection({
      middlewares: { timeout: { ms: 5_000 } },
    });
    collection.get(
      "/slow",
      { outputSchema: emptyOkOutput, middlewares: { timeout: { ms: 50 } } },
      (_req, res) => {
        setTimeout(() => {
          res.status(200).json({ ok: true });
        }, 80);
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/slow`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: "Request Timeout" });
      },
    );
  });

  it("should ignore a late handler body after timeout", async () => {
    const collection = new EndpointsCollection({
      middlewares: { timeout: { ms: 50 } },
    });
    collection.get(
      "/slow",
      { outputSchema: emptyOkOutput, middlewares: { timeout: true } },
      (_req, res) => {
        setTimeout(() => {
          res.status(200).json({ ok: true });
        }, 80);
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const response = await fetch(`${baseUrl}/slow`);
        assert.equal(response.status, 503);
        assert.deepEqual(await response.json(), { error: "Request Timeout" });
        await new Promise((resolve) => setTimeout(resolve, 50));
      },
    );
  });

  it("should leave timingPad off when the collection does not set enabled true", async () => {
    const collection = new EndpointsCollection({
      middlewares: { timingPad: { ms: 80 } },
    });
    collection.get("/open", { outputSchema: emptyOkOutput }, (_req, res) => {
      res.status(200).json({ ok: true });
    });

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const started = Date.now();
        const response = await fetch(`${baseUrl}/open`);
        const elapsed = Date.now() - started;
        assert.equal(response.status, 200);
        assert.ok(elapsed < 80);
      },
    );
  });

  it("should wait at least timingPad ms before sending", async () => {
    const collection = new EndpointsCollection({
      middlewares: { timingPad: { ms: 80 } },
    });
    collection.get(
      "/padded",
      { outputSchema: emptyOkOutput, middlewares: { timingPad: true } },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const started = Date.now();
        const response = await fetch(`${baseUrl}/padded`);
        const elapsed = Date.now() - started;
        assert.equal(response.status, 200);
        assert.ok(elapsed >= 80);
      },
    );
  });

  it("should pad a JWT 401 when timingPad is on", async () => {
    const collection = new EndpointsCollection({
      middlewares: {
        jwt: { secret },
        timingPad: { ms: 80 },
      },
    });
    collection.get(
      "/private",
      {
        outputSchema: emptyOkOutput,
        middlewares: { jwt: true, timingPad: true },
      },
      (_req, res) => {
        res.status(200).json({ ok: true });
      },
    );

    await withServer(
      (app) => {
        app.use(collection.getRouter());
      },
      async (baseUrl) => {
        const started = Date.now();
        const response = await fetch(`${baseUrl}/private`);
        const elapsed = Date.now() - started;
        assert.equal(response.status, 401);
        assert.ok(elapsed >= 80);
      },
    );
  });

  it("should throw when timeout ms is not greater than timingPad ms", () => {
    const collection = new EndpointsCollection({
      middlewares: {
        timeout: { ms: 50, enabled: true },
        timingPad: { ms: 80, enabled: true },
      },
    });
    assert.throws(
      () => {
        collection.get("/x", { outputSchema: emptyOkOutput }, (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          'Middleware "timeout" ms must be greater than "timingPad" ms',
    );
  });

  it("should throw when timeout is enabled without collection config", () => {
    const collection = new EndpointsCollection();
    assert.throws(
      () => {
        collection.get(
          "/x",
          { outputSchema: emptyOkOutput, middlewares: { timeout: true } },
          (_req, res) => {
            res.status(200).json({ ok: true });
          },
        );
      },
      (error: unknown) =>
        error instanceof Error &&
        error.message ===
          'Middleware "timeout" is not configured on this collection',
    );
  });

  it("should throw when timeout ms is not a positive number", () => {
    const collection = new EndpointsCollection({
      middlewares: { timeout: { ms: 0, enabled: true } },
    });
    assert.throws(
      () => {
        collection.get("/x", { outputSchema: emptyOkOutput }, (_req, res) => {
          res.status(200).json({ ok: true });
        });
      },
      (error: unknown) =>
        error instanceof Error &&
        error.message === 'Middleware "timeout" is missing ms',
    );
  });

  it("should return the same object from defineMiddlewares and the library z", () => {
    const config = {
      middlewares: { jwt: { secret, enabled: false as const } },
    };
    const defined = defineMiddlewares(config);
    assert.equal(defined, config);
    assert.equal(zFromLibrary, z);

    const reason: JwtUnauthorizedReason = "missing_authorization";
    const endpointMiddlewares: EndpointMiddlewares = { jwt: false };
    const collectionMiddlewares: CollectionMiddlewares | undefined =
      defined.middlewares;
    const collectionConfig: CollectionConfig = defined;
    assert.equal(reason, "missing_authorization");
    assert.equal(endpointMiddlewares.jwt, false);
    assert.equal(collectionMiddlewares?.jwt?.secret, secret);
    assert.equal(collectionConfig, defined);
  });
});
