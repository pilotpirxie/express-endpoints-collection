import { Router } from "express";
import { generateOpenAPI } from "./generator";
import { getLicense, type LicenseStatus } from "./license";
import { CacheStore, createNodeCacheStore } from "./middlewares/cache";
import {
  mergeMiddlewares,
  type ChildMiddlewares,
} from "./middlewares/mergeMiddlewares";
import { createRateLimiter } from "./middlewares/rateLimit";
import { CollectionConfig } from "./types/CollectionMiddlewares";
import { CustomErrorHandler } from "./types/CustomErrorHandler";
import { EndpointInfo } from "./types/EndpointInfo";
import { EndpointsCollection } from "./EndpointsCollection";
import type { RequestHandler } from "express";

export class EndpointsApi {
  private readonly collections: EndpointsCollection[] = [];
  private readonly router = Router();
  private readonly cacheStore?: CacheStore;
  private readonly defaultRateLimiter?: RequestHandler;

  public constructor(private readonly config: CollectionConfig = {}) {
    const middlewares = config.middlewares;

    if (middlewares?.cache) {
      const {
        enabled: _enabled,
        key: _key,
        ...nodeCacheOptions
      } = middlewares.cache;
      this.cacheStore = createNodeCacheStore(nodeCacheOptions);
    }

    if (middlewares?.rateLimit) {
      this.defaultRateLimiter = createRateLimiter(middlewares.rateLimit);
    }

    void getLicense();
  }

  public createEndpointsCollection({
    prefix,
    customErrorHandler,
    middlewares,
  }: {
    prefix?: string;
    customErrorHandler?: CustomErrorHandler;
    middlewares?: ChildMiddlewares;
  } = {}): EndpointsCollection {
    const collection = new EndpointsCollection({
      collectionPrefix: prefix,
      customErrorHandler: customErrorHandler ?? this.config.customErrorHandler,
      middlewares: mergeMiddlewares(this.config.middlewares, middlewares),
      shared: {
        cacheStore: this.cacheStore,
        defaultRateLimiter: this.defaultRateLimiter,
      },
    });

    this.collections.push(collection);
    this.router.use(collection.getRouter());
    return collection;
  }

  public getRouter(): Router {
    return this.router;
  }

  public getEndpoints(): EndpointInfo[] {
    return this.collections.flatMap((collection) => collection.getEndpoints());
  }

  public generateOpenAPI(
    options: Omit<Parameters<typeof generateOpenAPI>[0], "endpoints">,
  ) {
    return generateOpenAPI({
      ...options,
      endpoints: this.getEndpoints(),
    });
  }

  public getLicense(): Promise<LicenseStatus> {
    return getLicense();
  }
}
