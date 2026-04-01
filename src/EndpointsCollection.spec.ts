import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import express, { type Express, type ErrorRequestHandler } from "express";
import { z } from "zod";
import { EndpointsCollection } from "./EndpointsCollection";

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
});
