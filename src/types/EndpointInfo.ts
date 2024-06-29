import { EndpointInputSchema } from "./EndpointInputSchema";
import { EndpointOutputSchema } from "./EndpointOutputSchema";
import { HttpMethod } from "./HttpMethod";

export type EndpointInfo = {
  path: string;
  method: HttpMethod;
  inputSchema?: EndpointInputSchema;
  outputSchema?: EndpointOutputSchema;
  summary?: string;
};
