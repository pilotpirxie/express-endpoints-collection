import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeMiddlewares } from "./mergeMiddlewares";

describe("mergeMiddlewares", () => {
  it("returns undefined when both sides are omitted", () => {
    assert.equal(mergeMiddlewares(), undefined);
  });

  it("keeps the root jwt secret when the child only enables jwt", () => {
    const root = {
      jwt: { secret: "secret", enabled: false },
      timeout: { ms: 1_000 },
    };
    const child = { jwt: { enabled: true } };

    const merged = mergeMiddlewares(root, child);

    assert.equal(merged?.jwt?.secret, "secret");
    assert.equal(merged?.jwt?.enabled, true);
    assert.equal(merged?.timeout?.ms, 1_000);
    assert.equal(root.jwt.enabled, false);
    assert.deepEqual(child, { jwt: { enabled: true } });
  });

  it("throws when the merged jwt secret is missing or blank", () => {
    assert.throws(
      () => mergeMiddlewares(undefined, { jwt: { enabled: true } }),
      /Middleware "jwt" is missing secret/,
    );
    assert.throws(
      () => mergeMiddlewares({ jwt: { secret: "" } }),
      /Middleware "jwt" is missing secret/,
    );
  });

  it("throws when a child enables cache or rateLimit without root config", () => {
    assert.throws(
      () => mergeMiddlewares(undefined, { cache: { enabled: false } }),
      /Middleware "cache" is not configured on this api/,
    );
    assert.throws(
      () => mergeMiddlewares(undefined, { rateLimit: { enabled: true } }),
      /Middleware "rateLimit" is not configured on this api/,
    );
  });

  it("keeps root cache and rateLimit options under a child enabled flag", () => {
    const root = {
      cache: { stdTTL: 60, checkperiod: 120 },
      rateLimit: { windowMs: 60_000, limit: 30 },
    };
    const merged = mergeMiddlewares(root, {
      cache: { enabled: true },
      rateLimit: { enabled: true },
    });

    assert.equal(merged?.cache?.stdTTL, 60);
    assert.equal(merged?.cache?.enabled, true);
    assert.equal(merged?.rateLimit?.limit, 30);
    assert.equal(merged?.rateLimit?.enabled, true);
    assert.equal(root.cache.stdTTL, 60);
  });
});
