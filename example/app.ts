import express, { Express } from "express";
import bodyParser from "body-parser";
import { SimpleExpressOpenAPI } from "../src";
import Joi from "joi";

const port = process.env.PORT || 3000;
const app: Express = express();
app.set("trust proxy", true);
app.use(bodyParser.json({ limit: process.env.MAX_BODY_SIZE || "1KB" }));
app.disable("x-powered-by");

const simpleExpressOpenapiRouter = new SimpleExpressOpenAPI();
const router = simpleExpressOpenapiRouter.registerRouter(express.Router());

router.post(
  "/users",
  {
    // @ts-ignore
    inputSchema: {
      body: Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
      }),
    },
    outputSchema: {
      body: Joi.object({
        id: Joi.number().required(),
        name: Joi.string().required(),
        email: Joi.string().email().required(),
      }),
    },
    summary: "Create a new user",
  },
  (req, res) => {
    res.json({ id: 1, ...req.body });
  },
);

app.use(router);

app.get("/api-docs", (req, res) => {
  res.json(simpleExpressOpenapiRouter.getEndpoints());
});

app.listen(port, () => {
  console.info({
    sdk: process.version,
    datetime: new Date().toISOString(),
  });
  console.info(`Server is running on port ${port}`);
});
