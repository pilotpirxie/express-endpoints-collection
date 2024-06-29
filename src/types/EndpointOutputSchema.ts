import { z } from "zod";

export type EndpointOutputSchema = {
  status: number;
  description?: string;
  body?: z.ZodType;
}[];
