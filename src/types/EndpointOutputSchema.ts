import Joi from "joi";

export type EndpointOutputSchema = {
  status: number;
  description?: string;
  body?: Joi.Schema;
}[];
