import { EndpointInputSchema } from "./EndpointInputSchema";
import { z } from "zod";
import { Request } from "express";

export type TypedRequest<T extends EndpointInputSchema> = Omit<
  Request,
  "body" | "query" | "params" | "headers"
> & {
  body: z.infer<NonNullable<T["body"]>>;
  query: z.infer<NonNullable<T["query"]>>;
  params: z.infer<NonNullable<T["params"]>>;
  headers: z.infer<NonNullable<T["headers"]>>;
};
