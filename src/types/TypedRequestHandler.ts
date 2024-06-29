import { EndpointInputSchema } from "./EndpointInputSchema";
import { EndpointOutputSchema } from "./EndpointOutputSchema";
import { TypedRequest } from "./TypedRequest";
import { TypedResponse } from "./TypedResponse";

export type TypedRequestHandler<
  TInput extends EndpointInputSchema,
  TOutput extends EndpointOutputSchema,
> = (
  req: TypedRequest<TInput>,
  res: TypedResponse<TOutput>,
) => void | Promise<void>;
