import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { describe, it } from "node:test";
import type { Express } from "express";
import { sign } from "jsonwebtoken";
import { app as advancedApp } from "./app";
import { app as middlewaresApp } from "./middlewares";

async function withApp(
  app: Express,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = await new Promise<ReturnType<typeof app.listen>>(
    (resolve, reject) => {
      const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
      listening.on("error", reject);
    },
  );
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

function bearer(secret: string, sub = "1"): string {
  return `Bearer ${sign({ sub }, secret, { algorithm: "HS256" })}`;
}

async function postJson(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("example apps over HTTP", () => {
  it("serves the advanced example routes", async () => {
    const token = bearer("your_jwt_secret");

    await withApp(advancedApp, async (baseUrl) => {
      const created = await postJson(`${baseUrl}/users`, {
        username: "ada",
        email: "ada@example.com",
        password: "long-enough",
      });
      assert.equal(created.status, 201);
      const createdBody = (await created.json()) as { username: string };
      assert.equal(createdBody.username, "ada");

      const invalidUser = await postJson(`${baseUrl}/users`, {
        username: "x",
        email: "ada@example.com",
        password: "long-enough",
      });
      assert.equal(invalidUser.status, 400);

      const login = await postJson(`${baseUrl}/login`, {
        email: "ada@example.com",
        password: "long-enough",
      });
      assert.equal(login.status, 200);
      assert.deepEqual(await login.json(), { token: "simulated_jwt_token" });

      const missingToken = await fetch(`${baseUrl}/users/15`);
      assert.equal(missingToken.status, 401);

      const profile = await fetch(`${baseUrl}/users/15`, {
        headers: { authorization: token },
      });
      assert.equal(profile.status, 200);
      assert.deepEqual(await profile.json(), {
        id: 15,
        username: "exampleUser",
        email: "user@example.com",
      });

      const updated = await fetch(`${baseUrl}/users/15`, {
        method: "PUT",
        headers: {
          authorization: token,
          "content-type": "application/json",
        },
        body: JSON.stringify({ username: "ada" }),
      });
      assert.equal(updated.status, 200);
      const updatedBody = (await updated.json()) as { username: string };
      assert.equal(updatedBody.username, "ada");

      const posts = await fetch(`${baseUrl}/posts?limit=2`);
      const postsAgain = await fetch(`${baseUrl}/posts?limit=2`);
      const postsBody = (await posts.json()) as { posts: unknown[] };
      assert.equal(posts.status, 200);
      assert.equal(postsBody.posts.length, 2);
      assert.deepEqual(await postsAgain.json(), postsBody);

      const registered = await postJson(`${baseUrl}/users/register`, {
        username: "ada",
        email: "ada@example.com",
        password: "Password1!",
        profile: {
          firstName: "Ada",
          lastName: "Lovelace",
          age: 36,
          interests: ["books"],
        },
        settings: {
          newsletter: true,
          theme: "dark",
          notifications: { email: true, push: false, sms: false },
        },
      });
      assert.equal(registered.status, 201);
      const registeredBody = (await registered.json()) as {
        username: string;
        profile: { interests: string[] };
      };
      assert.equal(registeredBody.username, "ada");
      assert.deepEqual(registeredBody.profile.interests, ["books"]);

      const searchUrl = `${baseUrl}/products/search?q=phone&category=Electronics&category=Books&minPrice=10&inStock=true&sortBy=price&page=1&limit=10`;
      const search = await fetch(searchUrl);
      const searchAgain = await fetch(searchUrl);
      assert.equal(search.status, 200);
      const searchBody = (await search.json()) as { products: unknown[] };
      assert.equal(searchBody.products.length, 10);
      assert.deepEqual(await searchAgain.json(), searchBody);

      const sum = await postJson(`${baseUrl}/add`, { a: 2, b: 3 });
      assert.equal(sum.status, 200);
      assert.deepEqual(await sum.json(), { result: 5 });

      const upload = await postJson(
        `${baseUrl}/upload`,
        {
          files: [{ filename: "a.txt", mimetype: "text/plain", size: 4 }],
        },
        { authorization: token },
      );
      assert.equal(upload.status, 400);

      const paid = await postJson(
        `${baseUrl}/webhooks/payment`,
        {
          event: "payment.success",
          paymentId: "pay_1",
          amount: 12.5,
          currency: "USD",
          timestamp: "2026-09-25T12:00:00.000Z",
        },
        { "x-webhook-signature": "your_webhook_secret" },
      );
      assert.equal(paid.status, 200);
      const paidBody = (await paid.json()) as {
        received: boolean;
        message: string;
      };
      assert.equal(paidBody.received, true);
      assert.match(paidBody.message, /payment\.success/);

      const unpaid = await postJson(
        `${baseUrl}/webhooks/payment`,
        {
          event: "payment.failure",
          paymentId: "pay_2",
          amount: 1,
          currency: "EUR",
          timestamp: "2026-09-25T12:00:00.000Z",
        },
        { "x-webhook-signature": "wrong" },
      );
      assert.equal(unpaid.status, 401);
    });
  });

  it("serves the middleware example routes", async () => {
    const token = bearer("secret", "42");

    await withApp(middlewaresApp, async (baseUrl) => {
      const login = await postJson(`${baseUrl}/login`, {
        email: "ada@example.com",
        password: "secret",
      });
      assert.equal(login.status, 200);
      const loginBody = (await login.json()) as { token: string };
      assert.equal(typeof loginBody.token, "string");
      assert.ok(loginBody.token.length > 0);

      const denied = await postJson(`${baseUrl}/add?id=1`, { a: 1, b: 2 });
      assert.equal(denied.status, 401);

      const added = await postJson(
        `${baseUrl}/add?id=1`,
        { a: 1, b: 2 },
        { authorization: token },
      );
      assert.equal(added.status, 200);
      assert.deepEqual(await added.json(), { result: 3 });

      const me = await fetch(`${baseUrl}/me`, {
        headers: { authorization: token },
      });
      assert.equal(me.status, 200);
      assert.deepEqual(await me.json(), { ok: true, userId: "42" });

      const preview = await fetch(`${baseUrl}/preview`);
      assert.equal(preview.status, 200);
      assert.deepEqual(await preview.json(), { ok: true });

      const posts = await fetch(`${baseUrl}/posts`);
      const postsAgain = await fetch(`${baseUrl}/posts`);
      const postsBody = await posts.json();
      assert.equal(posts.status, 200);
      assert.deepEqual(postsBody, { posts: [{ id: 1, title: "Hello" }] });
      assert.deepEqual(await postsAgain.json(), postsBody);

      const burstStatuses: number[] = [];
      for (let attempt = 0; attempt < 4; attempt += 1) {
        const response = await postJson(`${baseUrl}/burst`, {});
        burstStatuses.push(response.status);
      }
      assert.deepEqual(burstStatuses, [200, 200, 200, 429]);

      const traced = await fetch(`${baseUrl}/traced`);
      assert.equal(traced.status, 200);
      assert.equal(traced.headers.get("x-trace"), "1");

      const quiet = await fetch(`${baseUrl}/quiet`);
      assert.equal(quiet.status, 200);
      assert.deepEqual(await quiet.json(), { ok: true });

      const item = await fetch(`${baseUrl}/item?id=a`);
      const itemAgain = await fetch(`${baseUrl}/item?id=a`);
      assert.equal(item.status, 200);
      assert.deepEqual(await item.json(), { id: "a", title: "Hello" });
      assert.deepEqual(await itemAgain.json(), { id: "a", title: "Hello" });

      const boom = await fetch(`${baseUrl}/boom`);
      assert.equal(boom.status, 422);
      assert.deepEqual(await boom.json(), { error: "nope" });

      const hang = await fetch(`${baseUrl}/hang`);
      assert.equal(hang.status, 503);

      const ready = await fetch(`${baseUrl}/ready`);
      assert.equal(ready.status, 200);
      assert.equal(ready.headers.get("x-ready"), "1");
      assert.deepEqual(await ready.json(), { ok: true });

      const echo = await postJson(`${baseUrl}/echo`, { message: "hi" });
      assert.equal(echo.status, 200);
      assert.deepEqual(await echo.json(), { message: "hi" });
    });
  });
});
