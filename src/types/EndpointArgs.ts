import { EndpointInputSchema } from "./EndpointInputSchema";
import { EndpointOutputSchema } from "./EndpointOutputSchema";
import { RequestHandler } from "express";

export type EndpointArgs = {
  inputSchema?: EndpointInputSchema;
  outputSchema?: EndpointOutputSchema;
  summary?: string;
  beforeInput?: RequestHandler | RequestHandler[];
  afterInput?: RequestHandler | RequestHandler[];
  beforeOutput?: RequestHandler | RequestHandler[];
  afterOutput?: RequestHandler | RequestHandler[];
};
