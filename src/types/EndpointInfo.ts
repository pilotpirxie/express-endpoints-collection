import { HttpMethod } from "./HttpMethod";
import type { ZodObject, ZodTypeAny } from "zod";

export type EndpointInputSchema = {
  query?: ZodObject;
  body?: ZodObject;
  params?: ZodObject;
  headers?: ZodObject;
};

export type EndpointOutputSchema = {
  status: number;
  description?: string;
  body?: ZodTypeAny;
}[];

export type EndpointInfo = {
  path: string;
  method: HttpMethod;
  inputSchema?: EndpointInputSchema;
  outputSchema: EndpointOutputSchema;
  summary?: string;
  operationId?: string;
};
