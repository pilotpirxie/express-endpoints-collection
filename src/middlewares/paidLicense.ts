import type { RequestHandler } from "express";
import { readLicenseStatus } from "../license";

export function withPaidLicense(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    if (readLicenseStatus()?.state === "valid") {
      handler(req, res, next);
      return;
    }
    next();
  };
}
