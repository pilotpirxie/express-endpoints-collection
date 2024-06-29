import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import { EndpointsCollection } from "../src";
import Joi from "joi";
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
      body: Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
      }),
      query: Joi.object({
        category: Joi.string().only().allow("a", "b").optional(),
      }),
      params: Joi.object({
        id: Joi.number().required(),
      }),
      headers: Joi.object({
        authorization: Joi.string().required(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: Joi.object({
          id: Joi.number().required(),
          token: Joi.string().required(),
          notification_push_token: Joi.string().allow("").required(),
          notification_user_id: Joi.string().allow("").required(),
          notification_tags: Joi.array().items(Joi.string()).required(),
          email: Joi.string().email().required(),
        }),
      },
    ],
    summary: "Test of validation endpoint",
  },
  (req: Request, res: Response) => {
    return res.json({ id: 1, ...req.body });
  },
);

endpointsCollection.post(
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
        body: Joi.object({
          message: Joi.string().required(),
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
