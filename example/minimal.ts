import express, { Express } from "express";
import bodyParser from "body-parser";
import { z } from "zod";
import { EndpointsCollection, TypedRequest, TypedResponse } from "../src";
import { generateOpenAPI } from "../src/generator";
import { jwtVerify } from "./middlewares/jwt";

const app: Express = express();
app.use(bodyParser.json());

const endpointsCollection = new EndpointsCollection();

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
        status: 400,
        body: z.object({
          result: z.number(),
        }),
      },
    ],
    summary: "Add two numbers",
    afterInputValidation: [jwtVerify("secret")],
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
      commonResponses: [
        {
          status: 500,
          body: z.object({
            message: z.string(),
          }),
        },
      ],
    }),
  );
});

app.listen(3000, () => {
  console.info(`Server is running on port http://localhost:3000`);
});
