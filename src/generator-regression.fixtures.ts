import { z } from "zod";
import { EndpointsCollection } from "./EndpointsCollection";

/**
 * Builds an EndpointsCollection with diverse routes (paths, methods, params, query,
 * headers, bodies, multiple statuses, operationId) so OpenAPI regression tests mirror
 * real example apps without starting HTTP servers.
 */
export function createRegressionEndpointsCollection(): EndpointsCollection {
  const collection = new EndpointsCollection();

  collection.post(
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
    (_req, res) => {
      res.status(201).end();
    },
  );

  collection.get(
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
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.put(
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
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.get(
    "/products/search",
    {
      inputSchema: {
        query: z.object({
          q: z.string().optional(),
          category: z.array(z.string()).optional(),
          minPrice: z.number().optional(),
          maxPrice: z.number().optional(),
          inStock: z.boolean().optional(),
          sortBy: z.enum(["price", "name", "popularity"]).optional(),
          page: z.number().int().positive().optional(),
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
              }),
            ),
            totalCount: z.number(),
          }),
        },
      ],
      summary: "Product search",
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.post(
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
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.post(
    "/validate",
    {
      outputSchema: [
        {
          status: 200,
          description: "Shape A",
          body: z.object({ a: z.number() }),
        },
        {
          status: 200,
          description: "Shape B",
          body: z.object({ b: z.string() }),
        },
      ],
      summary: "Merged same-status responses",
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  return collection;
}

/** Metadata passed to generateOpenAPI alongside regression endpoints. */
export const regressionOpenAPIMeta = {
  title: "Regression Test API",
  version: "1.0.0",
  servers: ["https://api.example.com"] as const,
  commonResponses: [
    {
      status: 500,
      body: z.object({
        message: z.string(),
      }),
    },
  ] as const,
};
