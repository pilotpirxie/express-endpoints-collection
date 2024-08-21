export type CustomErrorHandler = (
  error: Error,
  validationDetails: unknown,
) => object;
