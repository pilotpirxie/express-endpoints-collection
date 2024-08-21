import express, { Express, NextFunction } from "express";
import bodyParser from "body-parser";
import { z } from "zod";
import { EndpointsCollection, TypedRequest, TypedResponse } from "../src";
import { generateOpenAPI } from "../src/generator";

const app: Express = express();
app.use(bodyParser.json());

const endpointsCollection = new EndpointsCollection();

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
    afterInputValidation: (
      req: TypedRequest<typeof input>,
      res: TypedResponse<typeof output>,
      next: NextFunction,
    ) => {
      const { a, b } = req.body;
      res.json({
        result: a + b,
      });
    },
  },
  (req, res) => {
    const { a, b } = req.body;
    res.json({ result: a + b });
  },
);

app.use(endpointsCollection.getRouter());

app.get("/openapi", (req, res) => {
  res.setHeader("Content-Type", "text/yaml");
  return res.send(
    generateOpenAPI({
      title: "Minimal demo",
      version: "1.0.0",
      endpoints: endpointsCollection.getEndpoints(),
      servers: ["http://localhost:3000"],
    }),
  );
});

app.listen(3000, () => {
  console.info(`Server is running on port http://localhost:3000`);
});
