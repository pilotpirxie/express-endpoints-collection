import { NextFunction, Request, Response } from "express";
import { CacheStore } from "./cacheStore";

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

type Cache = JSONCache | RenderCache | SendCache;

const cache =
  (cacheStore: CacheStore) =>
  (req: Request, res: Response, next: NextFunction) => {
    const key = req.originalUrl;
    const cached = cacheStore.get(key) as Cache | undefined;

    if (cached) {
      if (cached.type === "json") {
        return res.json(cached.body);
      }

      if (cached.type === "send") {
        return res.send(cached.body);
      }

      return res.render(cached.view, cached.options);
    }

    // @ts-ignore
    res.cacheJSONResponse = res.json;

    // @ts-ignore
    res.json = (body) => {
      cacheStore.set(key, {
        type: "json",
        body,
      });

      // @ts-ignore
      res.cacheJSONResponse(body);
    };

    // @ts-ignore
    res.cacheRenderResponse = res.render;

    // @ts-ignore
    res.render = (view, options, callback) => {
      cacheStore.set(key, {
        type: "render",
        view,
        options,
      });

      // @ts-ignore
      res.cacheRenderResponse(view, options, callback);
    };

    // @ts-ignore
    res.cacheSendResponse = res.send;

    // @ts-ignore
    res.send = (body) => {
      cacheStore.set(key, {
        type: "send",
        body,
      });

      // @ts-ignore
      res.cacheSendResponse(body);
    };

    return next();
  };

export default cache;
