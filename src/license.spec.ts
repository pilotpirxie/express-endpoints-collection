import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { getLicense, type LicenseStatus } from "./license";

const STORE = Symbol.for("express-endpoints-collection.license");
const KEY = "key/with space";
const LICENSE_URL = "https://stacknoir.com/eec/license";

function resetLicenseSlot(): void {
  delete (globalThis as { [STORE]?: Promise<LicenseStatus> })[STORE];
  delete process.env.EEC_API_KEY;
}

afterEach(() => {
  resetLicenseSlot();
  mock.restoreAll();
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("getLicense", () => {
  it("does not fetch when the key is missing or blank", async () => {
    resetLicenseSlot();
    const fetchMock = mock.method(globalThis, "fetch", async () => {
      throw new Error("should not fetch");
    });
    const warnMock = mock.method(console, "warn", () => undefined);

    const missing = await getLicense();
    process.env.EEC_API_KEY = "   ";
    resetLicenseSlot();
    process.env.EEC_API_KEY = "   ";
    const blank = await getLicense();

    assert.deepEqual(missing, { state: "missing" });
    assert.deepEqual(blank, { state: "missing" });
    assert.equal(fetchMock.mock.calls.length, 0);
    assert.equal(warnMock.mock.calls.length, 0);
  });

  it("maps a valid response and sends the key only in the query", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      jsonResponse({
        valid: true,
        expires_at: "2099-01-01",
        issued_to: "Dropzone Sp. z o.o.",
        issued_at: "2026-09-25",
      }),
    );
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const status = await getLicense();

    assert.deepEqual(status, {
      state: "valid",
      expiresAt: "2099-01-01",
      issuedTo: "Dropzone Sp. z o.o.",
      issuedAt: "2026-09-25",
    });
    assert.equal(fetchMock.mock.calls.length, 1);
    const url = String(fetchMock.mock.calls[0]?.arguments[0]);
    assert.equal(url, `${LICENSE_URL}?key=${encodeURIComponent(KEY)}`);
    const init = fetchMock.mock.calls[0]?.arguments[1] as
      | RequestInit
      | undefined;
    assert.equal(JSON.stringify(init?.headers ?? {}).includes(KEY), false);
    assert.equal(warnMock.mock.calls.length, 0);
  });

  it("fetches once for repeated calls", async () => {
    const fetchMock = mock.method(globalThis, "fetch", async () =>
      jsonResponse({ valid: true }),
    );
    process.env.EEC_API_KEY = KEY;

    const [first, second, third] = await Promise.all([
      getLicense(),
      getLicense(),
      getLicense(),
    ]);

    assert.equal(first.state, "valid");
    assert.equal(second, first);
    assert.equal(third, first);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("warns once for an invalid license and hides the key", async () => {
    mock.method(globalThis, "fetch", async () =>
      jsonResponse({ valid: false, issued_to: "Dropzone Sp. z o.o." }),
    );
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const first = await getLicense();
    const second = await getLicense();

    assert.equal(first.state, "invalid");
    assert.equal(first.issuedTo, "Dropzone Sp. z o.o.");
    assert.equal(second, first);
    assert.equal(warnMock.mock.calls.length, 1);
    const message = String(warnMock.mock.calls[0]?.arguments[0]);
    assert.match(message, /license invalid/);
    assert.equal(message.includes(KEY), false);
    assert.equal(message.includes(encodeURIComponent(KEY)), false);
  });

  it("treats a past expires_at as expired", async () => {
    mock.method(globalThis, "fetch", async () =>
      jsonResponse({ valid: true, expires_at: "2000-01-01" }),
    );
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const status = await getLicense();

    assert.equal(status.state, "expired");
    assert.equal(status.expiresAt, "2000-01-01");
    assert.equal(warnMock.mock.calls.length, 1);
    const message = String(warnMock.mock.calls[0]?.arguments[0]);
    assert.match(message, /license expired/);
    assert.equal(message.includes(KEY), false);
  });

  it("treats a non-date expires_at as invalid", async () => {
    mock.method(globalThis, "fetch", async () =>
      jsonResponse({ valid: true, expires_at: "tomorrow" }),
    );
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const status = await getLicense();

    assert.equal(status.state, "invalid");
    assert.equal(warnMock.mock.calls.length, 1);
    assert.equal(
      String(warnMock.mock.calls[0]?.arguments[0]).includes(KEY),
      false,
    );
  });

  it("treats a non-2xx response as invalid", async () => {
    mock.method(globalThis, "fetch", async () => jsonResponse({}, 500));
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const status = await getLicense();

    assert.deepEqual(status, { state: "invalid" });
    assert.equal(warnMock.mock.calls.length, 1);
    assert.equal(
      String(warnMock.mock.calls[0]?.arguments[0]).includes(KEY),
      false,
    );
  });

  it("treats a schema mismatch as invalid", async () => {
    mock.method(globalThis, "fetch", async () =>
      jsonResponse({ valid: "yes" }),
    );
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const status = await getLicense();

    assert.equal(status.state, "invalid");
    assert.equal(warnMock.mock.calls.length, 1);
  });

  it("treats a body that is not JSON as unreachable", async () => {
    mock.method(
      globalThis,
      "fetch",
      async () => new Response("not-json", { status: 200 }),
    );
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const status = await getLicense();

    assert.equal(status.state, "unreachable");
    assert.equal(warnMock.mock.calls.length, 1);
    const message = String(warnMock.mock.calls[0]?.arguments[0]);
    assert.match(message, /license unreachable/);
    assert.equal(message.includes(KEY), false);
  });

  it("treats a thrown fetch as unreachable and redacts the key", async () => {
    const encoded = encodeURIComponent(KEY);
    mock.method(globalThis, "fetch", async () => {
      throw new TypeError(`connect failed ${LICENSE_URL}?key=${encoded}`);
    });
    const warnMock = mock.method(console, "warn", () => undefined);
    process.env.EEC_API_KEY = KEY;

    const status = await getLicense();

    assert.equal(status.state, "unreachable");
    assert.equal(warnMock.mock.calls.length, 1);
    const message = String(warnMock.mock.calls[0]?.arguments[0]);
    assert.match(message, /license unreachable: TypeError /);
    assert.equal(message.includes(KEY), false);
    assert.equal(message.includes(encoded), false);
  });
});
