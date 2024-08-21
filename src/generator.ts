import { EndpointInfo } from "./types/EndpointInfo";
import {
  OpenAPIRegistry,
  ResponseConfig,
  extendZodWithOpenApi,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export function generateOpenAPI({
  title,
  version,
  endpoints,
  servers,
}: {
  title: string;
  version: string;
  endpoints: EndpointInfo[];
  servers: string[];
}) {
  const registry = new OpenAPIRegistry();

  endpoints.forEach((endpoint) => {
    const openapiPath = endpoint.path.replace(/:(\w+)/g, "{$1}");
    const responses: Record<string, ResponseConfig> = {};

    for (const outputSchema of endpoint.outputSchema) {
      responses[outputSchema.status.toString()] = {
        description:
          outputSchema.description ||
          `Response for status code ${outputSchema.status}`,
        content: outputSchema.body
          ? {
              "application/json": {
                schema: outputSchema.body,
              },
            }
          : undefined,
      };
    }

    registry.registerPath({
      method: endpoint.method,
      path: openapiPath,
      summary: endpoint.summary || "",
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

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title,
      version,
    },
    servers: servers.map((url) => ({ url })),
  });
}
