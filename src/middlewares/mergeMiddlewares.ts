import type {
  CacheMiddlewareConfig,
  CollectionMiddlewares,
  ErrorMiddlewareConfig,
  JwtMiddlewareConfig,
  RateLimitMiddlewareConfig,
  RequestLoggerMiddlewareConfig,
  TimeoutMiddlewareConfig,
  TimingPadMiddlewareConfig,
} from "../types/CollectionMiddlewares";

export type ChildMiddlewares = {
  requestLogger?: Partial<RequestLoggerMiddlewareConfig>;
  jwt?: Partial<JwtMiddlewareConfig>;
  errorHandler?: Partial<ErrorMiddlewareConfig>;
  timeout?: Partial<TimeoutMiddlewareConfig>;
  timingPad?: Partial<TimingPadMiddlewareConfig>;
  cache?: Pick<CacheMiddlewareConfig, "enabled" | "key">;
  rateLimit?: Pick<RateLimitMiddlewareConfig, "enabled">;
};

function mergeKey<T extends object>(
  rootValue: T | undefined,
  childValue: Partial<T> | undefined,
): T | undefined {
  if (childValue === undefined) {
    return rootValue;
  }
  return { ...rootValue, ...childValue } as T;
}

export function mergeMiddlewares(
  root?: CollectionMiddlewares,
  child?: ChildMiddlewares,
): CollectionMiddlewares | undefined {
  if (child?.cache !== undefined && root?.cache === undefined) {
    throw new Error('Middleware "cache" is not configured on this api');
  }
  if (child?.rateLimit !== undefined && root?.rateLimit === undefined) {
    throw new Error('Middleware "rateLimit" is not configured on this api');
  }

  if (root === undefined && child === undefined) {
    return undefined;
  }

  const merged: CollectionMiddlewares = {};
  const requestLogger = mergeKey(root?.requestLogger, child?.requestLogger);
  const jwt = mergeKey(root?.jwt, child?.jwt);
  const errorHandler = mergeKey(root?.errorHandler, child?.errorHandler);
  const timeout = mergeKey(root?.timeout, child?.timeout);
  const timingPad = mergeKey(root?.timingPad, child?.timingPad);
  const cache = mergeKey(root?.cache, child?.cache);
  const rateLimit = mergeKey(root?.rateLimit, child?.rateLimit);

  if (requestLogger !== undefined) {
    merged.requestLogger = requestLogger;
  }
  if (jwt !== undefined) {
    merged.jwt = jwt;
  }
  if (errorHandler !== undefined) {
    merged.errorHandler = errorHandler;
  }
  if (timeout !== undefined) {
    merged.timeout = timeout;
  }
  if (timingPad !== undefined) {
    merged.timingPad = timingPad;
  }
  if (cache !== undefined) {
    merged.cache = cache;
  }
  if (rateLimit !== undefined) {
    merged.rateLimit = rateLimit;
  }

  if (
    merged.jwt !== undefined &&
    (typeof merged.jwt.secret !== "string" || merged.jwt.secret === "")
  ) {
    throw new Error('Middleware "jwt" is missing secret');
  }

  return merged;
}
