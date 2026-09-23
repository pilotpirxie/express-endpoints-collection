import { ErrorRequestHandler } from "express";
import type { ErrorMiddlewareConfig } from "../types/CollectionMiddlewares";

function errorName(err: unknown): string | undefined {
  if (err instanceof Error) {
    return err.name;
  }
  return undefined;
}

export function errorHandlerMiddleware(
  config: ErrorMiddlewareConfig,
): ErrorRequestHandler {
  return (err, req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }

    const mapped = config.onError?.(err, req, res);
    if (mapped) {
      if (mapped.body !== undefined) {
        res.status(mapped.status).json(mapped.body);
        return;
      }
      res.sendStatus(mapped.status);
      return;
    }

    if (errorName(err) === "PayloadTooLargeError") {
      res.sendStatus(413);
      return;
    }

    console.error(err);
    res.sendStatus(500);
  };
}
