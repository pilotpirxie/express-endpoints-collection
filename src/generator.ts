import { EndpointInfo, EndpointOutputSchema } from "./types/EndpointInfo";
import {
  OpenAPIRegistry,
  ResponseConfig,
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z, ZodTypeAny } from "zod";
import yaml from "js-yaml";

extendZodWithOpenApi(z);

export function generateOpenAPI({
  title,
  version,
  endpoints,
  servers,
  asJson,
  commonResponses,
}: {
  title: string;
  version: string;
  endpoints: EndpointInfo[];
  servers: string[];
  asJson?: boolean;
  commonResponses?: EndpointOutputSchema;
}) {
  const registry = new OpenAPIRegistry();

  endpoints.forEach((endpoint) => {
    const openapiPath = endpoint.path.replace(/:(\w+)/g, "{$1}");

    const combinedSchemas: Record<
      number,
      {
        combinedBody: ZodTypeAny[];
        descriptions: string[];
      }
    > = {};

    const allOutputSchemas: EndpointOutputSchema = [
      ...endpoint.outputSchema,
      ...(commonResponses ? commonResponses : []),
    ];

    for (const schema of allOutputSchemas) {
      const schemaDescription =
        schema.description || `Response for status code ${schema.status}`;

      const existingSchema = combinedSchemas[schema.status];
      const bodyToCombine = schema.body ? schema.body : z.object({});
      if (existingSchema) {
        combinedSchemas[schema.status].combinedBody = [
          ...existingSchema.combinedBody,
          bodyToCombine,
        ];

        const existingDescription = existingSchema.descriptions.find(
          (description) => description === schemaDescription,
        );

        if (!existingDescription) {
          combinedSchemas[schema.status].descriptions = [
            ...existingSchema.descriptions,
            schemaDescription,
          ];
        }
      } else {
        combinedSchemas[schema.status] = {
          combinedBody: [bodyToCombine],
          descriptions: [schemaDescription],
        };
      }
    }

    const responses: Record<string, ResponseConfig> = {};
    for (const schemaStatusCode in combinedSchemas) {
      const schema = combinedSchemas[schemaStatusCode];
      let unionSchema: z.ZodType;
      if (schema.combinedBody.length > 1) {
        unionSchema = z.union([...schema.combinedBody] as [
          ZodTypeAny,
          ZodTypeAny,
          ...ZodTypeAny[],
        ]);
      } else if (schema.combinedBody.length === 1) {
        unionSchema = schema.combinedBody[0];
      } else {
        unionSchema = z.object({});
      }

      responses[schemaStatusCode] = {
        description: schema.descriptions.join(" OR "),
        content: {
          "application/json": {
            schema: unionSchema,
          },
        },
      };
    }

    registry.registerPath({
      method: endpoint.method,
      path: openapiPath,
      summary: endpoint.summary || "",
      operationId: endpoint.operationId,
      request: {
        params: endpoint.inputSchema?.params,
        query: endpoint.inputSchema?.query,
        body: endpoint.inputSchema?.body
          ? {
              content: {
                "application/json": { schema: endpoint.inputSchema.body },
              },
            }
          : undefined,
        headers: endpoint.inputSchema?.headers,
      },
      responses,
    });
  });

  const generator = new OpenApiGeneratorV3(registry.definitions);

  const jsonDocument = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title,
      version,
    },
    servers: servers.map((url) => ({ url })),
  });

  return asJson ? jsonDocument : yaml.dump(jsonDocument);
}
