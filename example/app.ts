import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import { EndpointsCollection } from "../src";
import { z } from "zod";
import NodeCache from "node-cache";
import { NodeCacheAdapter } from "./middlewares/cacheStore";
import cache from "./middlewares/cache";
import { jwtVerify } from "./middlewares/jwt";
import { generateOpenAPI } from "../src/swaggerPlain";

const port = process.env.PORT || 3000;
const app: Express = express();
app.set("trust proxy", true);
app.use(bodyParser.json({ limit: process.env.MAX_BODY_SIZE || "1KB" }));
app.disable("x-powered-by");

const nodeCache = new NodeCache({
  stdTTL: 10,
  checkperiod: 1,
});

const nodeCacheAdapter = new NodeCacheAdapter({
  nodeCache,
});

const endpointsCollection = new EndpointsCollection();

endpointsCollection.post(
  "/validation/:id",
  {
    inputSchema: {
      body: z.object({
        name: z.string(),
        email: z.string().email(),
      }),
      query: z.object({
        category: z.enum(["a", "b"]).optional(),
      }),
      params: z.object({
        id: z.number(),
      }),
      headers: z.object({
        authorization: z.string(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({
          id: z.number(),
          token: z.string(),
          notification_push_token: z.string(),
          notification_user_id: z.string(),
          notification_tags: z.array(z.string()),
          email: z.string().email(),
        }),
      },
    ],
    summary: "Test of validation endpoint",
  },
  (req: Request, res: Response) => {
    return res.json({ id: 1, ...req.body });
  },
);

endpointsCollection.get(
  "/jwt",
  {
    summary: "Test of validation endpoint with jwt verification",
    beforeInput: [jwtVerify("secret")],
    outputSchema: [
      {
        status: 200,
      },
    ],
  },
  (req: Request, res: Response) => {
    return res.sendStatus(200);
  },
);

endpointsCollection.post(
  "/cache",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({
          message: z.string(),
        }),
      },
    ],
    summary: "Test of validation endpoint with cache middleware",
    beforeInput: [cache(nodeCacheAdapter)],
  },
  (req: Request, res: Response) => {
    return res.json({ message: "Hello, World!" });
  },
);

app.use(endpointsCollection.getRouter());

app.get("/api-docs", (req, res) => {
  res.json(endpointsCollection.getEndpoints());
});

app.get("/openapi", (req, res) => {
  res.json(
    generateOpenAPI({
      title: "API Documentation",
      version: "1.0.0",
      endpoints: endpointsCollection.getEndpoints(),
    }),
  );
});

app.listen(port, () => {
  console.info({
    sdk: process.version,
    datetime: new Date().toISOString(),
  });
  console.info(`Server is running on port ${port}`);
});
