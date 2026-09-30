import { z } from "zod";

export type LicenseStatus = {
  state: "missing" | "valid" | "invalid" | "expired" | "unreachable";
  issuedTo?: string;
  issuedAt?: string;
  expiresAt?: string;
};

const LICENSE_URL = "https://stacknoir.com/eec/license";
const STORE = Symbol.for("express-endpoints-collection.license");
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const licenseResponseSchema = z.object({
  valid: z.boolean(),
  expires_at: z.string().optional(),
  issued_to: z.string().optional(),
  issued_at: z.string().optional(),
});

type LicenseResponse = z.infer<typeof licenseResponseSchema>;

function redact(message: string, key: string): string {
  const encoded = encodeURIComponent(key);
  const withoutRaw = message.split(key).join("[redacted]");
  if (encoded === key) {
    return withoutRaw;
  }
  return withoutRaw.split(encoded).join("[redacted]");
}

function errorDetail(error: unknown, key: string): string {
  if (error instanceof Error) {
    return redact(`${error.name} ${error.message}`, key);
  }
  return "Error";
}

function warn(
  state: "invalid" | "expired" | "unreachable",
  detail?: string,
): void {
  if (detail) {
    console.warn(`[express-endpoints-collection] license ${state}: ${detail}`);
    return;
  }
  console.warn(`[express-endpoints-collection] license ${state}`);
}

function toStatus(parsed: LicenseResponse): LicenseStatus {
  const status: LicenseStatus = parsed.valid
    ? { state: "valid" }
    : { state: "invalid" };

  if (parsed.issued_to !== undefined) {
    status.issuedTo = parsed.issued_to;
  }
  if (parsed.issued_at !== undefined) {
    status.issuedAt = parsed.issued_at;
  }
  if (parsed.expires_at !== undefined) {
    status.expiresAt = parsed.expires_at;
  }

  if (!parsed.valid || parsed.expires_at === undefined) {
    return status;
  }

  if (!DATE_ONLY.test(parsed.expires_at)) {
    status.state = "invalid";
    return status;
  }

  if (Date.parse(`${parsed.expires_at}T23:59:59.999Z`) < Date.now()) {
    status.state = "expired";
  }

  return status;
}

async function checkLicense(key: string | undefined): Promise<LicenseStatus> {
  if (!key) {
    return { state: "missing" };
  }

  try {
    const response = await fetch(
      `${LICENSE_URL}?key=${encodeURIComponent(key)}`,
      { signal: AbortSignal.timeout(5000) },
    );

    if (!response.ok) {
      warn("invalid");
      return { state: "invalid" };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch (error: unknown) {
      warn("unreachable", errorDetail(error, key));
      return { state: "unreachable" };
    }

    const parsed = licenseResponseSchema.safeParse(body);
    if (!parsed.success) {
      warn("invalid");
      return { state: "invalid" };
    }

    const status = toStatus(parsed.data);
    if (status.state === "invalid" || status.state === "expired") {
      warn(status.state);
    }
    return status;
  } catch (error: unknown) {
    warn("unreachable", errorDetail(error, key));
    return { state: "unreachable" };
  }
}

type StoredLicenseStatus = LicenseStatus | { state: "configuring" };

type LicenseSlot = {
  promise: Promise<LicenseStatus>;
  status: StoredLicenseStatus;
};

function licenseStore(): { [STORE]?: LicenseSlot } {
  return globalThis as { [STORE]?: LicenseSlot };
}

export function readLicenseStatus(): StoredLicenseStatus | undefined {
  return licenseStore()[STORE]?.status;
}

export function getLicense(): Promise<LicenseStatus> {
  const store = licenseStore();
  const existing = store[STORE];
  if (existing) {
    return existing.promise;
  }

  const key = process.env.EEC_API_KEY?.trim();
  const created: LicenseSlot = {
    status: { state: "configuring" },
    promise: undefined as unknown as Promise<LicenseStatus>,
  };

  if (!key) {
    const status: LicenseStatus = { state: "missing" };
    created.status = status;
    created.promise = Promise.resolve(status);
    store[STORE] = created;
    return created.promise;
  }

  created.promise = checkLicense(key).then((status) => {
    created.status = status;
    return status;
  });
  store[STORE] = created;
  return created.promise;
}
