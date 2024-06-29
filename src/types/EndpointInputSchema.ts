import Joi from "joi";

export type EndpointInputSchema = {
  query?: Joi.Schema;
  body?: Joi.Schema;
  params?: Joi.Schema;
  headers?: Joi.Schema;
};
