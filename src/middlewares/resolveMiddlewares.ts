import { ErrorRequestHandler, RequestHandler } from "express";
import type {
  CacheMiddlewareConfig,
  CollectionMiddlewares,
  EndpointMiddlewares,
  ErrorMiddlewareConfig,
  JwtMiddlewareConfig,
  MiddlewareOverride,
  RateLimitMiddlewareConfig,
  RequestLoggerMiddlewareConfig,
} from "../types/CollectionMiddlewares";
import { CacheStore, cacheMiddleware } from "./cache";
import { errorHandlerMiddleware } from "./errorHandler";
import { jwtMiddleware } from "./jwt";
import { createRateLimiter } from "./rateLimit";
import { requestLoggerMiddleware } from "./requestLogger";

export type ResolvedMiddleware = {
  requestLogger?: RequestHandler;
  rateLimiter?: RequestHandler;
  jwt?: RequestHandler;
  cache?: RequestHandler;
  errorHandler?: ErrorRequestHandler;
};

function unconfigured(name: string): Error {
  return new Error(`Middleware "${name}" is not configured on this collection`);
}

function resolveOverride<T extends { enabled?: boolean }>(
  name: string,
  collection: T | undefined,
  endpoint: MiddlewareOverride<T> | undefined,
): T | undefined {
  if (endpoint === false) {
    return undefined;
  }

  if (endpoint === true) {
    if (!collection) {
      throw unconfigured(name);
    }
    return { ...collection, enabled: true };
  }

  if (endpoint !== undefined) {
    if (!collection) {
      throw unconfigured(name);
    }
    return { ...collection, ...endpoint, enabled: true };
  }

  if (!collection || collection.enabled !== true) {
    return undefined;
  }

  return collection;
}

function resolveCache(
  collection: CacheMiddlewareConfig | undefined,
  endpoint: MiddlewareOverride<CacheMiddlewareConfig> | undefined,
  store: CacheStore | undefined,
): RequestHandler | undefined {
  if (endpoint === false) {
    return undefined;
  }

  const enabling = endpoint === true || endpoint !== undefined;
  if (enabling && !collection) {
    throw unconfigured("cache");
  }

  if (!enabling) {
    if (!collection || collection.enabled !== true || !store) {
      return undefined;
    }
  }

  if (!collection || !store) {
    throw unconfigured("cache");
  }

  const endpointConfig =
    endpoint !== undefined && endpoint !== true ? endpoint : undefined;
  const key =
    endpointConfig?.key ?? collection.key ?? ((req) => req.originalUrl);
  const ttlSeconds =
    typeof endpointConfig?.stdTTL === "number"
      ? endpointConfig.stdTTL
      : undefined;

  return cacheMiddleware(store, key, ttlSeconds);
}

export function resolveMiddlewares(input: {
  collection: CollectionMiddlewares | undefined;
  endpoint: EndpointMiddlewares | undefined;
  cacheStore: CacheStore | undefined;
  defaultRateLimiter: RequestHandler | undefined;
}): ResolvedMiddleware {
  const collection = input.collection;
  const endpoint = input.endpoint;

  const requestLogger = resolveOverride<RequestLoggerMiddlewareConfig>(
    "requestLogger",
    collection?.requestLogger,
    endpoint?.requestLogger,
  );
  const rateLimit = resolveOverride<RateLimitMiddlewareConfig>(
    "rateLimit",
    collection?.rateLimit,
    endpoint?.rateLimit,
  );
  const jwt = resolveOverride<JwtMiddlewareConfig>(
    "jwt",
    collection?.jwt,
    endpoint?.jwt,
  );
  const errorHandler = resolveOverride<ErrorMiddlewareConfig>(
    "errorHandler",
    collection?.errorHandler,
    endpoint?.errorHandler,
  );

  let rateLimiter: RequestHandler | undefined;
  if (rateLimit) {
    const endpointRateLimit = endpoint?.rateLimit;
    if (endpointRateLimit === true || endpointRateLimit === undefined) {
      if (!input.defaultRateLimiter) {
        throw unconfigured("rateLimit");
      }
      rateLimiter = input.defaultRateLimiter;
    } else {
      rateLimiter = createRateLimiter(rateLimit);
    }
  }

  return {
    requestLogger: requestLogger
      ? requestLoggerMiddleware(requestLogger.log)
      : undefined,
    rateLimiter,
    jwt: jwt ? jwtMiddleware(jwt) : undefined,
    cache: resolveCache(collection?.cache, endpoint?.cache, input.cacheStore),
    errorHandler: errorHandler
      ? errorHandlerMiddleware(errorHandler)
      : undefined,
  };
}
