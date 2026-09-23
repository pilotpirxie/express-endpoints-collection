import { rateLimit } from "express-rate-limit";
import type { RateLimitMiddlewareConfig } from "../types/CollectionMiddlewares";

export function createRateLimiter(config: RateLimitMiddlewareConfig) {
  const { enabled: _enabled, ...options } = config;
  return rateLimit(options);
}
