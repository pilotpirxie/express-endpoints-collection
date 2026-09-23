import { RequestHandler, Response } from "express";
import type { TimeoutMiddlewareConfig } from "../types/CollectionMiddlewares";

export function timeoutMiddleware(
  config: TimeoutMiddlewareConfig,
): RequestHandler {
  const status = config.status ?? 503;
  const body = config.body ?? { error: "Request Timeout" };
  return (_req, res, next) => {
    let settled = false;
    const originalEnd = res.end.bind(res);
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);
    const timer = setTimeout(() => {
      if (settled || res.headersSent) {
        return;
      }
      res.status(status).json(body);
    }, config.ms);

    res.end = ((...args: Parameters<Response["end"]>) => {
      clearTimeout(timer);
      if (settled) {
        return res;
      }
      settled = true;
      return originalEnd(...args);
    }) as Response["end"];

    res.json = ((payload) => {
      if (settled) {
        return res;
      }
      return originalJson(payload);
    }) as Response["json"];

    res.send = ((payload) => {
      if (settled) {
        return res;
      }
      return originalSend(payload);
    }) as Response["send"];

    res.on("close", () => clearTimeout(timer));
    next();
  };
}
