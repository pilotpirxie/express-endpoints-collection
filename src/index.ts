import {
  Request,
  Response,
  NextFunction,
  Router,
  RequestHandler,
} from "express";
import { EndpointInputSchema } from "./types/EndpointInputSchema";
import { EndpointOutputSchema } from "./types/EndpointOutputSchema";
import { EndpointInfo } from "./types/EndpointInfo";
import { EndpointArgs } from "./types/EndpointArgs";
import { HttpMethod } from "./types/HttpMethod";
import { z } from "zod";

export class EndpointsCollection {
  private endpoints: EndpointInfo[] = [];
  private router = Router();

  public constructor() {}

  private static validateInput(schema: EndpointInputSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (schema.query) schema.query.parse(req.query);
        if (schema.body) schema.body.parse(req.body);
        if (schema.params) schema.params.parse(req.params);
        if (schema.headers) schema.headers.parse(req.headers);
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          return res.status(400).json({
            error: error.errors,
          });
        }
        next(error);
      }
    };
  }

  private static validateOutput(schema: EndpointOutputSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      const originalJson = res.json;

      // @ts-ignore
      res.json = (body: any) => {
        const status = res.statusCode;
        const schemaForStatus = schema.find((s) => s.status === status);

        try {
          if (schemaForStatus?.body) {
            schemaForStatus.body.parse(body);
          }
          originalJson.call(res, body);
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.error("Error in response validation", error.errors);
            return res.status(500).json({
              error: "Internal server error",
            });
          }
          next(error);
        }
      };

      next();
    };
  }

  public callOriginal(
    method: HttpMethod,
    path: string,
    {
      inputSchema,
      outputSchema,
      summary,
      afterOutput = [],
      beforeOutput = [],
      afterInput = [],
      beforeInput = [],
    }: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    this.endpoints.push({
      path,
      method: method,
      inputSchema,
      outputSchema,
      summary,
    });

    const combinedHandlers: (RequestHandler[] | RequestHandler)[] = [];

    if (beforeInput) {
      combinedHandlers.push(beforeInput);
    }

    if (inputSchema) {
      combinedHandlers.push(EndpointsCollection.validateInput(inputSchema));
    }

    if (afterInput) {
      combinedHandlers.push(afterInput);
    }

    combinedHandlers.push(handlers);

    if (beforeOutput) {
      combinedHandlers.push(beforeOutput);
    }

    if (outputSchema) {
      combinedHandlers.push(EndpointsCollection.validateOutput(outputSchema));
    }

    if (afterOutput) {
      combinedHandlers.push(afterOutput);
    }

    return this.router[method](path, ...combinedHandlers);
  }

  public get(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("get", path, args, handlers);
  }

  public post(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("post", path, args, handlers);
  }

  public put(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("put", path, args, handlers);
  }

  public delete(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("delete", path, args, handlers);
  }

  public patch(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("patch", path, args, handlers);
  }

  public options(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("options", path, args, handlers);
  }

  public head(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("head", path, args, handlers);
  }

  public trace(
    path: string,
    args: EndpointArgs,
    handlers: RequestHandler | RequestHandler[],
  ) {
    return this.callOriginal("trace", path, args, handlers);
  }

  public getEndpoints() {
    return this.endpoints;
  }

  public getRouter() {
    return this.router;
  }
}
