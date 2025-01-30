import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import { EndpointsCollection } from "../src";
import { z } from "zod";
import NodeCache from "node-cache";
import { NodeCacheAdapter } from "./middlewares/cacheStore";
import cache from "./middlewares/cache";
import { jwtVerify } from "./middlewares/jwt";
import { generateOpenAPI } from "../src";
import { errorHandler } from "./middlewares/errors";

const port = process.env.PORT || 3000;
const app: Express = express();
app.set("trust proxy", true);
app.use(bodyParser.json({ limit: process.env.MAX_BODY_SIZE || "1KB" }));
app.disable("x-powered-by");

const nodeCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const nodeCacheAdapter = new NodeCacheAdapter({ nodeCache });

const endpointsCollection = new EndpointsCollection();

const logRequest = (req: Request, res: Response, next: Function) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
};

endpointsCollection.post(
  "/users",
  {
    inputSchema: {
      body: z.object({
        username: z.string().min(3).max(20),
        email: z.string().email(),
        password: z.string().min(8),
      }),
    },
    outputSchema: [
      {
        status: 201,
        body: z.object({
          id: z.number(),
          username: z.string(),
          email: z.string().email(),
        }),
      },
      {
        status: 400,
        body: z.object({
          error: z.string(),
        }),
      },
    ],
    summary: "Register a new user",
    operationId: "registerUser",
  },
  (req, res) => {
    const { username, email } = req.body;
    res.status(201).json({
      id: Math.floor(Math.random() * 1000),
      username,
      email,
    });
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
        body: z.object({
          token: z.string(),
        }),
      },
      {
        status: 401,
        body: z.object({
          error: z.string(),
        }),
      },
    ],
    summary: "User login",
  },
  (req, res) => {
    res.json({ token: "simulated_jwt_token" });
  },
);

endpointsCollection.get(
  "/users/:id",
  {
    inputSchema: {
      params: z.object({
        id: z.string(),
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
          username: z.string(),
          email: z.string().email(),
        }),
      },
      {
        status: 404,
        body: z.object({
          error: z.string(),
        }),
      },
    ],
    summary: "Get user profile",
    beforeInputValidation: [jwtVerify("your_jwt_secret")],
  },
  (req, res) => {
    const userId = parseInt(req.params.id);
    res.json({
      id: userId,
      username: "exampleUser",
      email: "user@example.com",
    });
  },
);

endpointsCollection.put(
  "/users/:id",
  {
    inputSchema: {
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        username: z.string().min(3).max(20).optional(),
        email: z.string().email().optional(),
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
          username: z.string(),
          email: z.string().email(),
        }),
      },
      {
        status: 404,
        body: z.object({
          error: z.string(),
        }),
      },
    ],
    summary: "Update user profile",
    beforeInputValidation: [jwtVerify("your_jwt_secret")],
  },
  (req, res) => {
    const userId = parseInt(req.params.id);
    const { username, email } = req.body;
    res.json({
      id: userId,
      username: username || "exampleUser",
      email: email || "user@example.com",
    });
  },
);

endpointsCollection.get(
  "/posts",
  {
    outputSchema: [
      {
        status: 200,
        body: z.object({
          posts: z.array(
            z.object({
              id: z.number(),
              title: z.string(),
              content: z.string(),
            }),
          ),
          totalPages: z.number(),
        }),
      },
    ],
    summary: "Get posts with pagination",
    beforeInputValidation: [cache(nodeCacheAdapter)],
  },
  (req, res) => {
    const limit = parseInt(req.query.limit as string) || 10;
    const posts = Array.from({ length: limit }, (_, i) => ({
      id: i + 1,
      title: `Post ${i + 1}`,
      content: `This is the content of post ${i + 1}`,
    }));
    res.json({
      posts,
      totalPages: 5,
    });
  },
);

endpointsCollection.post(
  "/users/register",
  {
    inputSchema: {
      body: z.object({
        username: z.string().min(3).max(20),
        email: z.string().email(),
        password: z
          .string()
          .min(8)
          .regex(
            /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/,
          ),
        profile: z.object({
          firstName: z.string(),
          lastName: z.string(),
          age: z.number().int().min(18).max(120),
          interests: z.array(z.string()).min(1).max(5),
        }),
        settings: z.object({
          newsletter: z.boolean(),
          theme: z.enum(["light", "dark", "system"]),
          notifications: z.object({
            email: z.boolean(),
            push: z.boolean(),
            sms: z.boolean(),
          }),
        }),
      }),
    },
    outputSchema: [
      {
        status: 201,
        body: z.object({
          id: z.number(),
          username: z.string(),
          email: z.string().email(),
          profile: z.object({
            firstName: z.string(),
            lastName: z.string(),
            age: z.number(),
            interests: z.array(z.string()),
          }),
        }),
      },
      {
        status: 400,
        body: z.object({
          error: z.string(),
          details: z.array(
            z.object({
              field: z.string(),
              message: z.string(),
            }),
          ),
        }),
      },
    ],
    summary: "Register a new user with complex profile",
    beforeInputValidation: [logRequest],
  },
  (req, res) => {
    const { username, email, profile } = req.body;
    res.status(201).json({
      id: Math.floor(Math.random() * 1000),
      username,
      email,
      profile,
    });
  },
);

endpointsCollection.post(
  "/add",
  {
    inputSchema: {
      body: z.object({
        a: z.number(),
        b: z.number(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({
          result: z.number(),
        }),
      },
    ],
    summary: "Add two numbers",
  },
  (req, res) => {
    const { a, b } = req.body;
    res.json({ result: a + b });
  },
);

endpointsCollection.get(
  "/products/search",
  {
    inputSchema: {
      query: z.object({
        q: z.string().optional(),
        category: z.array(z.string()).optional(),
        minPrice: z.number().optional(),
        maxPrice: z.number().optional(),
        inStock: z.boolean().optional(),
        brand: z.array(z.string()).optional(),
        sortBy: z.enum(["price", "name", "popularity"]).optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
        page: z.number().int().positive().optional(),
        limit: z.number().int().positive().max(100).optional(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({
          products: z.array(
            z.object({
              id: z.number(),
              name: z.string(),
              price: z.number(),
              category: z.string(),
              brand: z.string(),
              inStock: z.boolean(),
            }),
          ),
          totalCount: z.number(),
          page: z.number(),
          totalPages: z.number(),
        }),
      },
    ],
    summary: "Advanced product search",
    beforeInputValidation: [cache(nodeCacheAdapter)],
  },
  (req, res) => {
    const products = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Product ${i + 1}`,
      price: Math.random() * 100,
      category: ["Electronics", "Clothing", "Books"][i % 3],
      brand: ["Brand A", "Brand B", "Brand C"][i % 3],
      inStock: Math.random() > 0.5,
    }));
    res.json({
      products,
      totalCount: 100,
      page: 1,
      totalPages: 10,
    });
  },
);

endpointsCollection.post(
  "/upload",
  {
    inputSchema: {
      body: z.object({
        files: z
          .array(
            z.object({
              filename: z.string(),
              mimetype: z.string(),
              size: z.number(),
            }),
          )
          .min(1)
          .max(5),
        description: z.string().optional(),
      }),
      headers: z.object({
        "content-type": z.literal("multipart/form-data"),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({
          uploadedFiles: z.array(
            z.object({
              id: z.string(),
              filename: z.string(),
              url: z.string(),
            }),
          ),
        }),
      },
      {
        status: 413,
        body: z.object({
          error: z.string(),
        }),
      },
    ],
    summary: "Upload multiple files",
    beforeInputValidation: [jwtVerify("your_jwt_secret")],
  },
  (req, res) => {
    const { files } = req.body;
    const uploadedFiles = files.map((file, index) => ({
      id: `file_${index + 1}`,
      filename: file.filename,
      url: `https://example.com/uploads/${file.filename}`,
    }));
    res.json({ uploadedFiles });
  },
);

const webhookSecret = "your_webhook_secret";
const validateWebhook = (req: Request, res: Response, next: Function) => {
  const signature = req.headers["x-webhook-signature"];
  if (signature !== webhookSecret) {
    return res.status(401).json({ error: "Invalid webhook signature" });
  }
  next();
};

endpointsCollection.post(
  "/webhooks/payment",
  {
    inputSchema: {
      body: z.object({
        event: z.enum(["payment.success", "payment.failure"]),
        paymentId: z.string(),
        amount: z.number(),
        currency: z.string().length(3),
        timestamp: z.string().datetime(),
      }),
      headers: z.object({
        "x-webhook-signature": z.string(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({
          received: z.boolean(),
          message: z.string(),
        }),
      },
      {
        status: 401,
        body: z.object({
          error: z.string(),
        }),
      },
    ],
    summary: "Receive payment webhook",
    beforeInputValidation: [validateWebhook],
  },
  (req, res) => {
    const { event, paymentId } = req.body;
    res.json({
      received: true,
      message: `Processed ${event} for payment ${paymentId}`,
    });
  },
);

app.use(endpointsCollection.getRouter());

app.get("/openapi", (req, res) => {
  res.setHeader("Content-Type", "text/yaml");
  return res.send(
    generateOpenAPI({
      title: "Advanced API Documentation",
      version: "1.0.0",
      endpoints: endpointsCollection.getEndpoints(),
      servers: ["http://localhost:3000"],
    }),
  );
});

app.use(errorHandler);

app.listen(port, () => {
  console.info({
    sdk: process.version,
    datetime: new Date().toISOString(),
  });
  console.info(`Server is running on port ${port}`);
});
