import {
  Request,
  Response,
  NextFunction,
  Router,
  RequestHandler,
} from "express";
import {
  EndpointInfo,
  EndpointInputSchema,
  EndpointOutputSchema,
} from "./types/EndpointInfo";
import { HttpMethod } from "./types/HttpMethod";
import { AnyZodObject, z } from "zod";
import { CustomErrorHandler } from "./types/CustomErrorHandler";
import { ParamsDictionary, Query } from "express-serve-static-core";
import { IncomingHttpHeaders } from "http";
import { TypedRequestHandler } from "./types/TypedRequestHandler";
import { EndpointArgs } from "./types/EndpointArgs";

export class EndpointsCollection {
  private endpoints: EndpointInfo[] = [];
  private router = Router();
  private readonly collectionPrefix?: string;
  private readonly customErrorHandler?: CustomErrorHandler;

  public constructor({
    collectionPrefix,
    customErrorHandler,
  }: {
    collectionPrefix?: string;
    customErrorHandler?: CustomErrorHandler;
  } = {}) {
    this.collectionPrefix = collectionPrefix;
    this.customErrorHandler = customErrorHandler;
  }

  private validateInput(schema: EndpointInputSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (schema.query) {
          req.query = this.coerceAll(schema.query, req.query) as Query;
          req.query = schema.query.parse(req.query);
        }
        if (schema.body) {
          req.body = this.coerceAll(schema.body, req.body);
          req.body = schema.body.parse(req.body);
        }
        if (schema.params) {
          req.params = this.coerceAll(
            schema.params,
            req.params,
          ) as ParamsDictionary;
          req.params = schema.params.parse(req.params);
        }
        if (schema.headers) {
          req.headers = this.coerceAll(
            schema.headers,
            req.headers,
          ) as IncomingHttpHeaders;
          req.headers = schema.headers.parse(req.headers);
        }
        next();
      } catch (error) {
        if (error instanceof z.ZodError) {
          if (this.customErrorHandler) {
            return res
              .status(400)
              .json(this.customErrorHandler(error, error.errors));
          }

          return res.status(400).json({
            error: error.errors,
          });
        }
        next(error);
      }
    };
  }

  private coerceAll(schema: AnyZodObject, data: any) {
    const deepClone: Record<string, unknown> = {};
    for (const key in schema.shape) {
      const coerced = this.coerceOnly(schema.shape[key], data[key]);

      deepClone[key] = coerced.success ? coerced.data : data[key];
    }
    return deepClone;
  }

  private coerceOnly(
    schema: z.ZodTypeAny,
    value: unknown,
  ): z.SafeParseReturnType<unknown, unknown> {
    if (schema instanceof z.ZodString) {
      return z.coerce.string().safeParse(value);
    } else if (schema instanceof z.ZodNumber) {
      return z.coerce.number().safeParse(value);
    } else if (schema instanceof z.ZodBoolean) {
      return z.coerce.boolean().safeParse(value);
    } else if (schema instanceof z.ZodDate) {
      return z.coerce.date().safeParse(value);
    } else if (schema instanceof z.ZodBigInt) {
      return z.coerce.bigint().safeParse(value);
    } else if (schema instanceof z.ZodArray) {
      if (Array.isArray(value)) {
        const coercedArray = value.map((item) =>
          this.coerceOnly(schema.element, item),
        );
        return z
          .array(z.any())
          .safeParse(
            coercedArray.map((result) =>
              result.success ? result.data : result.error,
            ),
          );
      }
      return z.array(z.any()).safeParse(value);
    } else if (schema instanceof z.ZodObject) {
      if (typeof value === "object" && value !== null) {
        const coercedObject: Record<string, unknown> = {};
        for (const [key, propertySchema] of Object.entries(schema.shape)) {
          const propertyValue = (value as any)[key];
          const coercedProperty = this.coerceOnly(
            propertySchema as z.ZodTypeAny,
            propertyValue,
          );
          coercedObject[key] = coercedProperty.success
            ? coercedProperty.data
            : propertyValue;
        }
        return z.object(schema.shape).safeParse(coercedObject);
      }
      return z.object(schema.shape).safeParse(value);
    } else {
      return schema.safeParse(value);
    }
  }

  public callOriginal<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    method: HttpMethod,
    path: string,
    {
      inputSchema,
      outputSchema,
      summary,
      beforeInputValidation = [],
      afterInputValidation = [],
      beforeResponse = [],
    }: EndpointArgs<TInput, TOutput>,
    handler: TypedRequestHandler<TInput, TOutput>,
  ) {
    const pathToUse = this.collectionPrefix
      ? `${this.collectionPrefix}${path}`
      : path;

    this.endpoints.push({
      path: pathToUse,
      method: method,
      inputSchema,
      outputSchema,
      summary,
    });

    const combinedHandlers: (RequestHandler[] | RequestHandler)[] = [];

    if (beforeInputValidation) {
      combinedHandlers.push(beforeInputValidation);
    }

    if (inputSchema) {
      combinedHandlers.push(this.validateInput(inputSchema));
    }

    if (afterInputValidation) {
      combinedHandlers.push(afterInputValidation);
    }

    combinedHandlers.push(handler);

    if (beforeResponse) {
      combinedHandlers.push(beforeResponse);
    }

    return this.router[method](pathToUse, ...combinedHandlers);
  }

  public get<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handlers: TypedRequestHandler<TInput, TOutput>,
  ) {
    return this.callOriginal("get", path, args, handlers);
  }

  public post<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handler: TypedRequestHandler<TInput, TOutput>,
  ) {
    return this.callOriginal("post", path, args, handler);
  }

  public put<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handlers: TypedRequestHandler<TInput, TOutput>,
  ) {
    return this.callOriginal("put", path, args, handlers);
  }

  public delete<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handlers: TypedRequestHandler<TInput, TOutput>,
  ) {
    return this.callOriginal("delete", path, args, handlers);
  }

  public patch<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handlers: TypedRequestHandler<TInput, TOutput>,
  ) {
    return this.callOriginal("patch", path, args, handlers);
  }

  public options<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handlers: TypedRequestHandler<TInput, TOutput>,
  ) {
    return this.callOriginal("options", path, args, handlers);
  }

  public head<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handlers: TypedRequestHandler<TInput, TOutput>,
  ) {
    return this.callOriginal("head", path, args, handlers);
  }

  public trace<
    TInput extends EndpointInputSchema,
    TOutput extends EndpointOutputSchema,
  >(
    path: string,
    args: EndpointArgs<TInput, TOutput>,
    handlers: TypedRequestHandler<TInput, TOutput>,
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
