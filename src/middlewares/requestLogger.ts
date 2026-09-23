import { NextFunction, Request, Response } from "express";
import type { RequestLogInfo } from "../types/CollectionMiddlewares";

function defaultLog(info: RequestLogInfo): void {
  console.info(
    `${new Date().toISOString()} ${info.method} ${info.originalUrl} ${info.statusCode} ${info.durationMs}ms`,
  );
}

export function requestLoggerMiddleware(
  log: (info: RequestLogInfo) => void = defaultLog,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const started = Date.now();
    res.on("finish", () => {
      log({
        method: req.method,
        originalUrl: req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Date.now() - started,
      });
    });
    next();
  };
}
