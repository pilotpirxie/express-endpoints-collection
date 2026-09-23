import type { Request, Response } from "express";
import type { Options as RateLimitOptions } from "express-rate-limit";
import type { Algorithm, JwtPayload } from "jsonwebtoken";
import NodeCache from "node-cache";
import type { CustomErrorHandler } from "./CustomErrorHandler";

export type NodeCacheOptions = NonNullable<
  ConstructorParameters<typeof NodeCache>[0]
>;

export type JwtUnauthorizedReason =
  | "missing_authorization"
  | "invalid_authorization"
  | "missing_token"
  | "expired"
  | "invalid_token";

export type RequestLogInfo = {
  method: string;
  originalUrl: string;
  statusCode: number;
  durationMs: number;
};

export type JwtMiddlewareConfig = {
  secret: string;
  required?: boolean;
  algorithms?: Algorithm[];
  enabled?: boolean;
  onVerified?: (decoded: JwtPayload, req: Request) => void | false;
  onUnauthorized?: (reason: JwtUnauthorizedReason) => {
    status?: number;
    body: unknown;
  };
};

export type CacheMiddlewareConfig = NodeCacheOptions & {
  enabled?: boolean;
  key?: (req: Request) => string;
};

export type RateLimitMiddlewareConfig = Partial<RateLimitOptions> & {
  enabled?: boolean;
};

export type ErrorMiddlewareConfig = {
  enabled?: boolean;
  onError?: (
    err: unknown,
    req: Request,
    res: Response,
  ) => { status: number; body?: unknown } | void;
};

export type RequestLoggerMiddlewareConfig = {
  enabled?: boolean;
  log?: (info: RequestLogInfo) => void;
};

export type CollectionMiddlewares = {
  requestLogger?: RequestLoggerMiddlewareConfig;
  jwt?: JwtMiddlewareConfig;
  cache?: CacheMiddlewareConfig;
  rateLimit?: RateLimitMiddlewareConfig;
  errorHandler?: ErrorMiddlewareConfig;
};

export type CollectionConfig = {
  customErrorHandler?: CustomErrorHandler;
  middlewares?: CollectionMiddlewares;
};

export type MiddlewareOverride<T> = boolean | Partial<T>;

export type EndpointMiddlewares = {
  requestLogger?: MiddlewareOverride<RequestLoggerMiddlewareConfig>;
  jwt?: MiddlewareOverride<JwtMiddlewareConfig>;
  cache?: MiddlewareOverride<CacheMiddlewareConfig>;
  rateLimit?: MiddlewareOverride<RateLimitMiddlewareConfig>;
  errorHandler?: MiddlewareOverride<ErrorMiddlewareConfig>;
};
