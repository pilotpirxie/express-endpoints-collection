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
  beforeInputValidation?: RequestHandler | RequestHandler[];
  afterInputValidation?: RequestHandler | RequestHandler[];
  beforeResponse?: RequestHandler | RequestHandler[];
};
