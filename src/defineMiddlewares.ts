import type { CollectionConfig } from "./types/CollectionMiddlewares";

export function defineMiddlewares<T extends CollectionConfig>(config: T): T {
  return config;
}
