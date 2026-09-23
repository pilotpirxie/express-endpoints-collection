import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type {
  JwtMiddlewareConfig,
  JwtUnauthorizedReason,
} from "../types/CollectionMiddlewares";

const defaultMessages: Record<JwtUnauthorizedReason, string> = {
  missing_authorization: "Missing Authorization Header",
  invalid_authorization: "Invalid Authorization Header",
  missing_token: "Missing Token in Authorization Header",
  expired: "Unauthorized",
  invalid_token: "Unauthorized",
};

function rejectUnauthorized(
  res: Response,
  config: JwtMiddlewareConfig,
  reason: JwtUnauthorizedReason,
) {
  if (config.onUnauthorized) {
    const result = config.onUnauthorized(reason);
    res.status(result.status ?? 401).json(result.body);
    return;
  }

  res.status(401).json({ error: defaultMessages[reason] });
}

export function jwtMiddleware(config: JwtMiddlewareConfig) {
  const required = config.required !== false;
  const algorithms = config.algorithms ?? ["HS256"];

  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header || Array.isArray(header)) {
      if (!header && !required) {
        next();
        return;
      }
      rejectUnauthorized(
        res,
        config,
        header ? "invalid_authorization" : "missing_authorization",
      );
      return;
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer") {
      rejectUnauthorized(res, config, "invalid_authorization");
      return;
    }
    if (!token) {
      rejectUnauthorized(res, config, "missing_token");
      return;
    }

    let decoded: jwt.JwtPayload | string;
    try {
      decoded = jwt.verify(token, config.secret, { algorithms });
    } catch (error: unknown) {
      rejectUnauthorized(
        res,
        config,
        error instanceof jwt.TokenExpiredError ? "expired" : "invalid_token",
      );
      return;
    }

    if (typeof decoded === "string") {
      rejectUnauthorized(res, config, "invalid_token");
      return;
    }

    try {
      if (config.onVerified?.(decoded, req) === false) {
        rejectUnauthorized(res, config, "invalid_token");
        return;
      }
    } catch {
      rejectUnauthorized(res, config, "invalid_token");
      return;
    }

    next();
  };
}
