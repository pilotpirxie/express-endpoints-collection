import { RequestHandler } from "express";
import { TypedRequestHandler } from "./TypedRequestHandler";
import { EndpointInputSchema, EndpointOutputSchema } from "./EndpointInfo";

export type AllPossibilitiesRequestHandler<
  TInput extends EndpointInputSchema,
  TOutput extends EndpointOutputSchema,
> =
  | RequestHandler
  | RequestHandler[]
  | TypedRequestHandler<TInput, TOutput>
  | TypedRequestHandler<TInput, TOutput>[];
