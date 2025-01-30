import { RequestHandler } from "express";
import { EndpointInputSchema, EndpointOutputSchema } from "./EndpointInfo";
import { TypedRequestHandler } from "./TypedRequestHandler";

export type EndpointArgs<
  TInput extends EndpointInputSchema,
  TOutput extends EndpointOutputSchema,
> = {
  inputSchema?: TInput;
  outputSchema: TOutput;
  summary?: string;
  operationId?: string;
  beforeInputValidation?: (
    | RequestHandler
    | RequestHandler[]
    | TypedRequestHandler<TInput, TOutput>
    | TypedRequestHandler<TInput, TOutput>[]
  )[];
  afterInputValidation?: (
    | RequestHandler
    | RequestHandler[]
    | TypedRequestHandler<TInput, TOutput>
    | TypedRequestHandler<TInput, TOutput>[]
  )[];
  beforeResponse?: (
    | RequestHandler
    | RequestHandler[]
    | TypedRequestHandler<TInput, TOutput>
    | TypedRequestHandler<TInput, TOutput>[]
  )[];
};
