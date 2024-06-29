import Joi from "joi";
import { Request, Response, NextFunction, Router } from "express";

type EndpointInputSchema = {
  query?: Joi.Schema;
  body?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
};

type EndpointOutputSchema = {
  body: Joi.Schema;
  headers?: Joi.Schema;
};

const httpMethods = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
  "connect",
] as const;

type EndpointInfo = {
  path: string;
  method: (typeof httpMethods)[number];
  inputSchema: EndpointInputSchema;
  outputSchema: EndpointOutputSchema;
  summary?: string;
};

export class SimpleExpressOpenAPI {
  private endpoints: EndpointInfo[] = [];

  public constructor() {}

  private collect(endpointInfo: EndpointInfo) {
    return (req: Request, res: Response, next: NextFunction) => {
      this.endpoints.push(endpointInfo);
      next();
    };
  }

  private static validateInput(schema: EndpointInputSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const { error: queryError } = schema.query?.validate(req.query) || {};
      const { error: bodyError } = schema.body?.validate(req.body) || {};
      const { error: paramsError } = schema.params?.validate(req.params) || {};
      const { error: headersError } =
        schema.headers?.validate(req.headers) || {};

      const error = queryError || bodyError || paramsError || headersError;
      if (error) {
        return res.status(400).json({
          error: error.message,
        });
      }

      next();
    };
  }

  private static validateOutput(schema: EndpointOutputSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      // @ts-ignore
      res.json = (body: any) => {
        const { error: bodyError } = schema.body.validate(body) || {};
        const { error: headersError } =
          schema.headers?.validate(res.getHeaders()) || {};

        const error = bodyError || headersError;
        if (error) {
          console.error("Error in response validation", error.message);
          return res.status(500).json({
            error: "Internal server error",
          });
        }

        originalJson.call(res, body);
      };

      next();
    };
  }

  public registerRouter(router: Router) {
    httpMethods.forEach((method) => {
      const originalMethod = router[method];

      // @ts-ignore
      router[method] = (
        path: string,
        endpointArgs: {
          inputSchema: EndpointInputSchema;
          outputSchema: EndpointOutputSchema;
          summary?: string;
        },
        ...handlers: any[]
      ) => {
        this.endpoints.push({
          path,
          method,
          inputSchema: endpointArgs.inputSchema,
          outputSchema: endpointArgs.outputSchema,
          summary: endpointArgs.summary,
        });

        originalMethod.call(
          router,
          path,
          SimpleExpressOpenAPI.validateInput(endpointArgs.inputSchema),
          // @ts-ignore
          ...handlers,
          SimpleExpressOpenAPI.validateOutput(endpointArgs.outputSchema),
        );
      };
    });

    return router;
  }

  public getEndpoints() {
    return this.endpoints;
  }
}
