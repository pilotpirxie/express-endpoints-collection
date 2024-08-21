import { AnyZodObject } from "zod";

export type EndpointOutputSchema = {
  status: number;
  description?: string;
  body?: AnyZodObject;
}[];
