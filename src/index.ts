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
import { AnyZodObject, z } from "zod";
import { TypedRequestHandler } from "./types/TypedRequestHandler";

export class EndpointsCollection {
  private endpoints: EndpointInfo[] = [];
  private router = Router();
  private collectionPrefix = "";

  public constructor({ collectionPrefix = "" }: { collectionPrefix?: string }) {
    this.collectionPrefix = collectionPrefix;
  }

  private static validateInput(schema: EndpointInputSchema) {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        if (schema.query) {
          this.coerceAll(schema.query, req.query);
          const querySchemaCoerced = z.object(schema.query?.shape || {});
          req.query = querySchemaCoerced.parse(req.query);
        }
        if (schema.body) {
          this.coerceAll(schema.body, req.body);
          const bodySchemaCoerced = z.object(schema.body?.shape || {});
          req.body = bodySchemaCoerced.parse(req.body);
        }
        if (schema.params) {
          this.coerceAll(schema.params, req.params);
          const paramsSchemaCoerced = z.object(schema.params?.shape || {});
          req.params = paramsSchemaCoerced.parse(req.params);
        }
        if (schema.headers) {
          this.coerceAll(schema.headers, req.headers);
          const headersSchemaCoerced = z.object(schema.headers?.shape || {});
          req.headers = headersSchemaCoerced.parse(req.headers);
        }
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

  private static coerceAll(schema: AnyZodObject, data: any) {
    for (const key in schema.shape) {
      const coerced = EndpointsCollection.coerceOnly(
        schema.shape[key],
        data[key],
      );
      data[key] = coerced.success ? coerced.data : data[key];
    }
  }

  // private static coerce(schema: z.ZodType, data: any) {
  //   if (schema instanceof z.ZodNumber) {
  //     return Number(data);
  //   } else if (schema instanceof z.ZodBoolean) {
  //     return data === "true" || data === "1" || data === true;
  //   } else if (schema instanceof z.ZodString) {
  //     return String(data);
  //   } else if (schema instanceof z.ZodDate) {
  //     return new Date(data);
  //   } else if (schema instanceof z.ZodArray) {
  //     return Array.isArray(data) ? data : [data];
  //   } else if (schema instanceof z.ZodRecord) {
  //     return data;
  //   } else if (schema instanceof z.ZodObject) {
  //     const result: Record<string, any> = {};
  //     for (const key in schema.shape) {
  //       result[key] = EndpointsCollection.coerce(schema.shape[key], data[key]);
  //     }
  //   } else {
  //     return data;
  //   }
  // }

  private static coerceOnly<T extends z.ZodTypeAny>(
    schema: T,
    value: unknown,
  ): z.SafeParseReturnType<any, any> {
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
        const coercedObject: Record<string, any> = {};
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

  public callOriginal(
    method: HttpMethod,
    path: string,
    {
      inputSchema,
      outputSchema,
      summary,
      beforeResponse = [],
      afterInputValidation = [],
      beforeInputValidation = [],
    }: EndpointArgs<EndpointInputSchema, EndpointOutputSchema>,
    handlers: RequestHandler | RequestHandler[] | TypedRequestHandler<any, any>,
  ) {
    this.endpoints.push({
      path: this.collectionPrefix + path,
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
      combinedHandlers.push(EndpointsCollection.validateInput(inputSchema));
    }

    if (afterInputValidation) {
      combinedHandlers.push(afterInputValidation);
    }

    combinedHandlers.push(handlers);

    if (beforeResponse) {
      combinedHandlers.push(beforeResponse);
    }

    return this.router[method](path, ...combinedHandlers);
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
