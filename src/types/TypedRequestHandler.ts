import { EndpointInputSchema } from "./EndpointInputSchema";
import { EndpointOutputSchema } from "./EndpointOutputSchema";
import { TypedRequest } from "./TypedRequest";
import { TypedResponse } from "./TypedResponse";
import { NextFunction } from "express";

export type TypedRequestHandler<
  TInput extends EndpointInputSchema,
  TOutput extends EndpointOutputSchema,
> = (
  req: TypedRequest<TInput>,
  res: TypedResponse<TOutput>,
  next: NextFunction,
) => void | Promise<void>;
