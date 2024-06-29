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
  if (typeof schema.describe === "function") {
    const description = schema.describe();
    return convertDescriptionToJsonSchema(description);
  } else {
    return convertJoiSchemaToJsonSchema(schema);
  }
}

function convertDescriptionToJsonSchema(description: any): SchemaObject {
  switch (description.type) {
    case "object":
      return {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(description.keys).map(([key, value]) => [
            key,
            convertDescriptionToJsonSchema(value),
          ]),
        ),
        required: description.keys?.required || undefined,
      };
    case "array":
      return {
        type: "array",
        items: convertDescriptionToJsonSchema(description.items[0]),
      };
    default:
      return {
        type: description.type as DataType,
      };
  }
}

function convertJoiSchemaToJsonSchema(schema: Joi.Schema): SchemaObject {
  if (Joi.isSchema(schema)) {
    const schemaObj: SchemaObject = { type: schema.type as DataType };

    if (schema.type === "object") {
      schemaObj.properties = {};
      schemaObj.required = [];

      const children = (schema as any).$_terms.keys;
      children.forEach((child: any) => {
        schemaObj.properties![child.key] = convertJoiSchemaToJsonSchema(
          child.schema,
        );
        if (child.schema.$_getFlag("presence") === "required") {
          schemaObj.required!.push(child.key);
        }
      });
    } else if (schema.type === "array") {
      const itemsSchema = (schema as any).$_terms.items[0];
      schemaObj.items = convertJoiSchemaToJsonSchema(itemsSchema);
    }

    return schemaObj;
  }

  return { type: "object" };
}
