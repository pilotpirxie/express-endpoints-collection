import { EndpointOutputSchema } from "./EndpointOutputSchema";
import { z } from "zod";
import { Response } from "express";

export type TypedResponse<T extends EndpointOutputSchema> = Omit<
  Response,
  "json" | "status" | "sendStatus"
> & {
  json: (data: z.infer<NonNullable<T[number]["body"]>>) => void;
  status: <S extends T[number]["status"]>(
    code: S,
  ) => Omit<TypedResponse<T>, "status"> & {
    json: (
      data: z.infer<NonNullable<Extract<T[number], { status: S }>["body"]>>,
    ) => void;
  };
  sendStatus: <S extends T[number]["status"]>(code: S) => void;
};
