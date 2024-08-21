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
  beforeInputValidation?:
    | RequestHandler[]
    | TypedRequestHandler<TInput, TOutput>[];
  afterInputValidation?:
    | RequestHandler[]
    | TypedRequestHandler<TInput, TOutput>[];
  beforeResponse?: RequestHandler[] | TypedRequestHandler<TInput, TOutput>[];
};
