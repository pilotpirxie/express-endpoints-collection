import { RequestHandler, Response } from "express";

export function timingPadMiddleware(ms: number): RequestHandler {
  return (_req, res, next) => {
    const started = Date.now();
    const originalEnd = res.end.bind(res);
    res.end = ((...args: Parameters<Response["end"]>) => {
      const wait = ms - (Date.now() - started);
      if (wait <= 0) {
        return originalEnd(...args);
      }
      setTimeout(() => originalEnd(...args), wait);
      return res;
    }) as Response["end"];
    next();
  };
}
