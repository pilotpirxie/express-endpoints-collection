import { EndpointInputSchema, EndpointOutputSchema } from "./EndpointInfo";
import { AllPossibilitiesRequestHandler } from "./AllPossibilitiesRequestHandler";

export type EndpointArgs<
  TInput extends EndpointInputSchema,
  TOutput extends EndpointOutputSchema,
> = {
  inputSchema?: TInput;
  outputSchema: TOutput;
  summary?: string;
  beforeInputValidation?: AllPossibilitiesRequestHandler<TInput, TOutput>;
  afterInputValidation?: AllPossibilitiesRequestHandler<TInput, TOutput>;
  beforeResponse?: AllPossibilitiesRequestHandler<TInput, TOutput>;
};
