import { NextFunction, Request, Response } from "express";
import NodeCache from "node-cache";
import type { NodeCacheOptions } from "../types/CollectionMiddlewares";

type JSONCache = {
  type: "json";
  body: object;
};

type RenderCache = {
  type: "render";
  view: string;
  options: object;
};

type SendCache = {
  type: "send";
  body: string;
};

type CacheEntry = JSONCache | RenderCache | SendCache;

export type CacheStore = {
  get(key: string): unknown;
  set(key: string, value: unknown, ttlSeconds?: number): void;
  del(key: string): void;
};

export function createNodeCacheStore(options: NodeCacheOptions): CacheStore {
  const nodeCache = new NodeCache(options);

  return {
    get(key: string): unknown {
      return nodeCache.get(key);
    },
    set(key: string, value: unknown, ttlSeconds?: number): void {
      if (typeof ttlSeconds === "number") {
        nodeCache.set(key, value, ttlSeconds);
        return;
      }
      nodeCache.set(key, value);
    },
    del(key: string): void {
      nodeCache.del(key);
    },
  };
}

function isCacheEntry(value: unknown): value is CacheEntry {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === "json" || type === "send" || type === "render";
}

export function cacheMiddleware(
  store: CacheStore,
  keyFn: (req: Request) => string = (req) => req.originalUrl,
  ttlSeconds?: number,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const cached = store.get(key);

    if (isCacheEntry(cached)) {
      if (cached.type === "json") {
        res.json(cached.body);
        return;
      }

      if (cached.type === "send") {
        if (cached.body.startsWith("{") || cached.body.startsWith("[")) {
          res.json(JSON.parse(cached.body));
          return;
        }
        res.send(cached.body);
        return;
      }

      res.render(cached.view, cached.options);
      return;
    }

    const originalJson = res.json.bind(res);
    const originalRender = res.render.bind(res);
    const originalSend = res.send.bind(res);

    const remember = (entry: CacheEntry) => {
      try {
        store.set(key, entry, ttlSeconds);
      } catch (error: unknown) {
        console.error(error);
      }
    };

    res.json = (body) => {
      remember({ type: "json", body: body ?? {} });
      return originalJson(body);
    };

    res.render = ((
      view: string,
      options?: object | ((err: Error, html: string) => void),
      callback?: (err: Error, html: string) => void,
    ) => {
      const renderOptions = typeof options === "function" ? undefined : options;
      const renderCallback = (
        typeof options === "function" ? options : callback
      ) as ((err: Error, html: string) => void) | undefined;
      remember({
        type: "render",
        view,
        options: renderOptions ?? {},
      });
      return originalRender(view, renderOptions, renderCallback);
    }) as Response["render"];

    res.send = (body) => {
      remember({
        type: "send",
        body: typeof body === "string" ? body : JSON.stringify(body),
      });
      return originalSend(body);
    };

    next();
  };
}
