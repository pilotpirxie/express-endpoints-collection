import { NextFunction, Request, Response } from "express";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err) {
    console.error(err);
  }

  if (err.name === "PayloadTooLargeError") {
    return res.sendStatus(413);
  }

  return res.sendStatus(500);
};
