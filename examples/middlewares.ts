import express, { Express, NextFunction } from "express";
import bodyParser from "body-parser";
import { z } from "zod";
import {
  EndpointsCollection,
  generateOpenAPI,
  TypedRequest,
  TypedResponse,
} from "../src";
import { jwtVerify } from "./middlewares/jwt";

const app: Express = express();
app.use(bodyParser.json());

export const endpointsCollection = new EndpointsCollection();

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
    afterInputValidation: [
      jwtVerify("secret"),
      (
        req: TypedRequest<typeof input>,
        res: TypedResponse<typeof output>,
        next: NextFunction,
      ) => {
        const { a, b } = req.body;
        res.json({
          result: a + b,
        });
      },
    ],
  },
  (req, res) => {
    const { a, b } = req.body;
    res.json({ result: a + b });
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
