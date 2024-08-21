import { HttpMethod } from "./HttpMethod";
import { AnyZodObject } from "zod";

export type EndpointInputSchema = {
  query?: AnyZodObject;
  body?: AnyZodObject;
  params?: AnyZodObject;
  headers?: AnyZodObject;
};

export type EndpointOutputSchema = {
  status: number;
  description?: string;
  body?: AnyZodObject;
}[];

export type EndpointInfo = {
  path: string;
  method: HttpMethod;
  inputSchema?: EndpointInputSchema;
  outputSchema: EndpointOutputSchema;
  summary?: string;
};
