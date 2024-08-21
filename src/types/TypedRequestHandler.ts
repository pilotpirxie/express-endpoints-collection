import { z } from "zod";
import { NextFunction, Request, Response } from "express";
import { EndpointInputSchema, EndpointOutputSchema } from "./EndpointInfo";
import { ParamsDictionary, Query } from "express-serve-static-core";

export interface TypedRequest<T extends EndpointInputSchema> extends Request {
  body: z.infer<NonNullable<T["body"]>>;
  query: z.infer<NonNullable<T["query"]>> & Omit<Query, never>;
  params: z.infer<NonNullable<T["params"]>> & Omit<ParamsDictionary, never>;
  headers: z.infer<NonNullable<T["headers"]>>;
}

export type TypedResponse<T extends EndpointOutputSchema> = Omit<
  Response,
  "json" | "status" | "sendStatus"
> & {
  json: (data: z.infer<NonNullable<T[number]["body"]>>) => void;
  status: <S extends T[number]["status"]>(
    code: S,
  ) => Omit<TypedResponse<T>, "status"> & {
    json: (
      data: z.infer<NonNullable<Extract<T[number], { status: S }>["body"]>>,
    ) => void;
  };
  sendStatus: <S extends T[number]["status"]>(code: S) => void;
};

export type TypedRequestHandler<
  TInput extends EndpointInputSchema,
  TOutput extends EndpointOutputSchema,
> = (
  req: TypedRequest<TInput>,
  res: TypedResponse<TOutput>,
  next: NextFunction,
) => void | Promise<void>;
