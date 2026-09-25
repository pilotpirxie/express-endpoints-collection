import express, { Express } from "express";
import bodyParser from "body-parser";
import { EndpointsApi, z } from "../src";

const app: Express = express();
app.use(bodyParser.json());

export const api = new EndpointsApi({
  middlewares: { jwt: { secret: "secret", enabled: true } },
});

export const endpointsCollection = api.createEndpointsCollection();

export const openApiConfig = {
  title: "Minimal demo",
  version: "1.0.0",
  servers: ["http://localhost:3000"],
  commonResponses: [
    {
      status: 500,
      body: z.object({
        message: z.string(),
      }),
    },
  ],
};

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
  },
  (req, res) => {
    const { a, b } = req.body;
    res.json({ result: a + b });
  },
);

app.use(api.getRouter());

app.get("/openapi.yaml", (req, res) => {
  res.setHeader("Content-Type", "text/yaml");
  return res.send(api.generateOpenAPI(openApiConfig));
});

if (require.main === module) {
  app.listen(3000, () => {
    console.info(`Server is running on port http://localhost:3000`);
  });
}
