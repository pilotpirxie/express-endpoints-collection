import { AnyZodObject } from "zod";

export type EndpointInputSchema = {
  query?: AnyZodObject;
  body?: AnyZodObject;
  params?: AnyZodObject;
  headers?: AnyZodObject;
};
