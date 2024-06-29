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
  beforeInput?: RequestHandler | RequestHandler[];
  afterInput?: RequestHandler | RequestHandler[];
  beforeOutput?: RequestHandler | RequestHandler[];
  afterOutput?: RequestHandler | RequestHandler[];
};
