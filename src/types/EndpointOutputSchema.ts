import Joi from "joi";

export type EndpointOutputSchema = {
  body: Joi.Schema;
  headers?: Joi.Schema;
};
