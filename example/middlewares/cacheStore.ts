import NodeCache from 'node-cache';

export interface CacheStore {
  get(key: string): any;
  set(key: string, value: any): void;
  del(key: string): void;
}

export class NodeCacheAdapter implements CacheStore {
  private nodeCache: NodeCache | null = null;

  constructor({ nodeCache }: {
    nodeCache: NodeCache
  }) {
    this.nodeCache = nodeCache;
  }

  get(key: string): any {
    return this.nodeCache?.get(key);
  }

  set(key: string, value: any): void {
    this.nodeCache?.set(key, value);
  }

  del(key: string): void {
    this.nodeCache?.del(key);
  }
}
