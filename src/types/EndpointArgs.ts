import { EndpointInputSchema } from "./EndpointInputSchema";
import { EndpointOutputSchema } from "./EndpointOutputSchema";
import { RequestHandler } from "express";

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
