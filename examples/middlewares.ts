import bodyParser from "body-parser";
import express, { Express, NextFunction } from "express";
import jwt from "jsonwebtoken";
import {
  defineMiddlewares,
  EndpointsCollection,
  generateOpenAPI,
  TypedRequest,
  TypedResponse,
  z,
} from "../src";

const app: Express = express();
app.use(bodyParser.json());

const demo = defineMiddlewares({
  customErrorHandler: (_error, details) => ({
    error: "ValidationError",
    details,
  }),
  middlewares: {
    requestLogger: {
      enabled: true,
      log: (info) => {
        console.info(
          `${info.method} ${info.originalUrl} ${info.statusCode} ${info.durationMs}ms`,
        );
      },
    },
    jwt: {
      secret: "secret",
      onVerified: (decoded, req) => {
        (req as { userId?: string }).userId = String(decoded.sub ?? "");
      },
      onUnauthorized: (reason) => ({
        status: 401,
        body: { error: reason },
      }),
    },
    cache: { stdTTL: 60, checkperiod: 120 },
    rateLimit: {
      windowMs: 60_000,
      limit: 30,
      validate: { trustProxy: false },
    },
    timeout: { ms: 2_000 },
    timingPad: { ms: 200 },
    errorHandler: {
      enabled: true,
      onError: (err) => {
        if (err instanceof Error && err.message === "nope") {
          return { status: 422, body: { error: "nope" } };
        }
      },
    },
  },
});

export const endpointsCollection = new EndpointsCollection({ ...demo });

export const openApiConfig = {
  title: "Middlewares demo",
  version: "1.0.0",
  servers: ["http://localhost:3000"],
};

const input = {
  body: z.object({
    a: z.number(),
    b: z.number(),
  }),
  query: z.object({
    id: z.string(),
  }),
};

const output = [
  {
    status: 400,
    body: z.object({
      result: z.number(),
    }),
  },
];

endpointsCollection.post(
  "/add",
  {
    inputSchema: input,
    outputSchema: output,
    summary: "Add two numbers",
    middlewares: { jwt: true },
    afterInputValidation: [
      (
        req: TypedRequest<typeof input>,
        _res: TypedResponse<typeof output>,
        next: NextFunction,
      ) => {
        void req.query.id;
        next();
      },
    ],
  },
  (req, res) => {
    const { a, b } = req.body;
    res.json({ result: a + b });
  },
);

endpointsCollection.post(
  "/login",
  {
    inputSchema: {
      body: z.object({
        email: z.string().email(),
        password: z.string(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({ token: z.string() }),
      },
    ],
    summary: "User login",
    middlewares: { timingPad: true },
  },
  (_req, res) => {
    res.json({ token: jwt.sign({ sub: "1" }, "secret") });
  },
);

endpointsCollection.get(
  "/me",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({ ok: z.literal(true), userId: z.string() }),
      },
    ],
    summary: "Current user",
    middlewares: { jwt: true },
  },
  (req, res) => {
    res.json({
      ok: true,
      userId: (req as { userId?: string }).userId ?? "",
    });
  },
);

endpointsCollection.get(
  "/preview",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({ ok: z.literal(true) }),
      },
    ],
    summary: "Optional auth preview",
    middlewares: { jwt: { required: false } },
  },
  (_req, res) => {
    res.json({ ok: true });
  },
);

endpointsCollection.get(
  "/posts",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({
          posts: z.array(z.object({ id: z.number(), title: z.string() })),
        }),
      },
    ],
    summary: "List posts",
    middlewares: { cache: true },
  },
  (_req, res) => {
    res.json({ posts: [{ id: 1, title: "Hello" }] });
  },
);

endpointsCollection.post(
  "/burst",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({ ok: z.literal(true) }),
      },
    ],
    summary: "Burst endpoint",
    middlewares: { rateLimit: { limit: 3 } },
  },
  (_req, res) => {
    res.json({ ok: true });
  },
);

endpointsCollection.get(
  "/traced",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({ ok: z.literal(true) }),
      },
    ],
    summary: "Traced",
    beforeInputValidation: [
      (_req, res, next) => {
        res.setHeader("x-trace", "1");
        next();
      },
    ],
  },
  (_req, res) => {
    res.json({ ok: true });
  },
);

endpointsCollection.get(
  "/quiet",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({ ok: z.literal(true) }),
      },
    ],
    summary: "Skip request log",
    middlewares: { requestLogger: false },
  },
  (_req, res) => {
    res.json({ ok: true });
  },
);

endpointsCollection.get(
  "/item",
  {
    inputSchema: {
      query: z.object({
        id: z.string(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({ id: z.string(), title: z.string() }),
      },
    ],
    summary: "Cached item",
    middlewares: {
      cache: {
        key: (req) => `item:${String(req.query.id)}`,
        stdTTL: 10,
      },
    },
  },
  (req, res) => {
    res.json({ id: req.query.id, title: "Hello" });
  },
);

endpointsCollection.get(
  "/boom",
  {
    outputSchema: [
      {
        status: 422,
        body: z.object({ error: z.string() }),
      },
    ],
    summary: "Mapped error",
  },
  () => {
    throw new Error("nope");
  },
);

endpointsCollection.get(
  "/ready",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({ ok: z.literal(true) }),
      },
    ],
    summary: "Before response",
    beforeResponse: [
      (_req, res) => {
        res.setHeader("x-ready", "1");
        res.json({ ok: true });
      },
    ],
  },
  (_req, _res, next) => {
    next();
  },
);

endpointsCollection.post(
  "/echo",
  {
    inputSchema: {
      body: z.object({
        message: z.string().min(1),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({ message: z.string() }),
      },
      {
        status: 400,
        body: z.object({ error: z.string(), details: z.unknown() }),
      },
    ],
    summary: "Echo",
  },
  (req, res) => {
    res.json({ message: req.body.message });
  },
);

endpointsCollection.get(
  "/hang",
  {
    outputSchema: [
      {
        status: 503,
        body: z.object({ error: z.string() }),
      },
    ],
    summary: "Timed out",
    middlewares: { timeout: { ms: 50 } },
  },
  async () => {
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  },
);

app.use(endpointsCollection.getRouter());

app.get("/openapi.yaml", (req, res) => {
  res.setHeader("Content-Type", "text/yaml");
  return res.send(
    generateOpenAPI({
      ...openApiConfig,
      endpoints: endpointsCollection.getEndpoints(),
    }),
  );
});

if (require.main === module) {
  app.listen(3000, () => {
    console.info(`Server is running on port http://localhost:3000`);
  });
}
