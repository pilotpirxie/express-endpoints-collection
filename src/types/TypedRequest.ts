import { EndpointInputSchema } from "./EndpointInputSchema";
import { z } from "zod";

export type TypedRequest<T extends EndpointInputSchema> = {
  body: z.infer<NonNullable<T["body"]>>;
  query: z.infer<NonNullable<T["query"]>>;
  params: z.infer<NonNullable<T["params"]>>;
  headers: z.infer<NonNullable<T["headers"]>>;
};
