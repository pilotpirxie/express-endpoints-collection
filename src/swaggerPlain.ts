import Joi from "joi";
import { EndpointInfo } from "./types/EndpointInfo";

type DataType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

interface SchemaObject {
  type?: DataType;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  format?: string;
  description?: string;
}

interface ParameterObject {
  name: string;
  in: "query" | "header" | "path" | "cookie";
  description?: string;
  required?: boolean;
  schema: SchemaObject;
}

interface RequestBodyObject {
  content: {
    [mediaType: string]: {
      schema: SchemaObject;
    };
  };
}

interface ResponseObject {
  description: string;
  content?: {
    [mediaType: string]: {
      schema: SchemaObject;
    };
  };
}

interface OperationObject {
  summary?: string;
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: {
    [httpStatusCode: string]: ResponseObject;
  };
}

interface PathItemObject {
  [method: string]: OperationObject;
}

interface OpenAPIObject {
  openapi: string;
  info: {
    title: string;
    version: string;
  };
  paths: Record<string, PathItemObject>;
}

export function generateOpenAPI({
  title,
  version,
  endpoints,
}: {
  title: string;
  version: string;
  endpoints: EndpointInfo[];
}): OpenAPIObject {
  const paths: Record<string, PathItemObject> = {};

  endpoints.forEach((endpoint) => {
    const pathItem: PathItemObject = {};
    const operation: OperationObject = {
      summary: endpoint.summary,
      responses: {},
    };

    if (endpoint.inputSchema) {
      operation.parameters = [];

      if (endpoint.inputSchema.query) {
        operation.parameters.push(
          ...convertJoiToParameters(endpoint.inputSchema.query, "query"),
        );
      }

      if (endpoint.inputSchema.params) {
        operation.parameters.push(
          ...convertJoiToParameters(endpoint.inputSchema.params, "path"),
        );
      }

      if (endpoint.inputSchema.headers) {
        operation.parameters.push(
          ...convertJoiToParameters(endpoint.inputSchema.headers, "header"),
        );
      }
    }

    endpoint.outputSchema.forEach((outputSchema) => {
      operation.responses[outputSchema.status] = {
        description:
          outputSchema.description ||
          `Response for ${outputSchema.status} status code`,
        content: outputSchema.body && {
          "application/json": {
            schema: convertJoiToJsonSchema(outputSchema.body),
          },
        },
      };
    });

    if (endpoint.inputSchema?.body) {
      operation.requestBody = {
        content: {
          "application/json": {
            schema: convertJoiToJsonSchema(endpoint.inputSchema.body),
          },
        },
      };
    }

    pathItem[endpoint.method] = operation;
    paths[endpoint.path] = pathItem;
  });

  return {
    openapi: "3.0.0",
    info: {
      title,
      version,
    },
    paths,
  };
}

function convertJoiToParameters(
  schema: Joi.ObjectSchema | Joi.Schema,
  parameterType: "query" | "header" | "path" | "cookie",
): ParameterObject[] {
  return Object.entries(schema.describe().keys).map(([key, value]) => {
    const required = schema.describe().keys.required.includes(key);
    const valueTyped = value as Joi.Schema;

    return {
      name: key,
      in: parameterType,
      required,
      schema: convertJoiToJsonSchema(valueTyped),
    };
  });
}

function convertJoiToJsonSchema(schema: Joi.Schema): SchemaObject {
  console.log(JSON.stringify(schema));

  if (schema.type === "object") {
    const description = schema.describe();

    return {
      type: "object",
      properties: Object.fromEntries(
        Object.entries(description.keys).map(([key, value]) => [
          key,
          convertJoiToJsonSchema(value as Joi.Schema),
        ]),
      ),
      required: description.keys.required,
    };
  }

  if (schema.type === "array") {
    const description = schema.describe();

    return {
      type: "array",
      items: convertJoiToJsonSchema(description.items),
    };
  }

  return {
    type: schema.type as DataType,
  };
}
