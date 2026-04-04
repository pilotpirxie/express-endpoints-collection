import assert from "node:assert/strict";
import { describe, it } from "node:test";
import yaml from "js-yaml";
import { z } from "zod";
import { generateOpenAPI } from "./generator";
import type { EndpointInfo } from "./types/EndpointInfo";

const defaultMeta: {
  title: string;
  version: string;
  servers: string[];
} = {
  title: "Test API",
  version: "1.0.0",
  servers: ["https://api.example.com"],
};

/**
 * Runs generateOpenAPI with JSON output and returns a plain object for deep structural assertions
 * without fighting the string | OpenAPIObject union on the return type.
 */
function openApiJsonDoc(
  endpoints: EndpointInfo[],
  extra?: { commonResponses?: EndpointInfo["outputSchema"] },
): Record<string, unknown> {
  return generateOpenAPI({
    ...defaultMeta,
    endpoints,
    asJson: true,
    ...extra,
  }) as unknown as Record<string, unknown>;
}

describe("generateOpenAPI", () => {
  it("produces scaffold with empty paths when endpoints array is empty", () => {
    const doc = openApiJsonDoc([]);

    assert.equal(doc.openapi, "3.0.0");
    assert.equal((doc.info as { title: string }).title, "Test API");
    assert.equal((doc.info as { version: string }).version, "1.0.0");
    assert.deepEqual(doc.paths, {});
    assert.ok(Array.isArray(doc.servers));
    assert.equal(
      (doc.servers as { url: string }[])[0].url,
      "https://api.example.com",
    );
  });

  it("returns a parseable YAML string by default and valid JSON when asJson is true", () => {
    const endpoint: EndpointInfo = {
      path: "/health",
      method: "get",
      outputSchema: [
        { status: 200, body: z.object({ status: z.literal("ok") }) },
      ],
    };

    const yamlString = generateOpenAPI({
      ...defaultMeta,
      endpoints: [endpoint],
    });
    assert.equal(typeof yamlString, "string");
    assert.match(yamlString as string, /^openapi:\s*3\.0\.0/m);
    const fromYaml = yaml.load(yamlString as string) as Record<string, unknown>;
    assert.equal(fromYaml.openapi, "3.0.0");
    assert.ok((fromYaml.paths as Record<string, unknown>)["/health"]);

    const jsonDoc = openApiJsonDoc([endpoint]);
    assert.equal(jsonDoc.openapi, "3.0.0");
    assert.ok((jsonDoc.paths as Record<string, unknown>)["/health"]);
  });

  it("registers a GET path with summary and 200 response body schema", () => {
    const endpoint: EndpointInfo = {
      path: "/items",
      method: "get",
      summary: "List items",
      outputSchema: [
        {
          status: 200,
          body: z.object({ items: z.array(z.string()) }),
        },
      ],
    };

    const doc = openApiJsonDoc([endpoint]);

    const getOp = (
      doc.paths as Record<string, { get: Record<string, unknown> }>
    )["/items"].get;
    assert.equal(getOp.summary, "List items");
    const schema = (getOp.responses as Record<string, { content: unknown }>)[
      "200"
    ].content as Record<string, { schema: Record<string, unknown> }>;
    assert.equal(schema["application/json"].schema.type, "object");
    assert.deepEqual(
      (schema["application/json"].schema.properties as Record<string, unknown>)
        .items,
      { type: "array", items: { type: "string" } },
    );
  });

  it("converts Express :param segments to OpenAPI {param} path keys", () => {
    const endpoint: EndpointInfo = {
      path: "/users/:userId/posts/:postId",
      method: "get",
      inputSchema: {
        params: z.object({
          userId: z.string(),
          postId: z.string(),
        }),
      },
      outputSchema: [{ status: 200, body: z.object({ title: z.string() }) }],
    };

    const doc = openApiJsonDoc([endpoint]);

    const paths = doc.paths as Record<string, unknown>;
    assert.ok(paths["/users/{userId}/posts/{postId}"]);
    assert.equal(paths["/users/:userId/posts/:postId"], undefined);
  });

  it("emits query parameters from inputSchema.query", () => {
    const endpoint: EndpointInfo = {
      path: "/search",
      method: "get",
      inputSchema: {
        query: z.object({
          q: z.string(),
          limit: z.coerce.number().optional(),
        }),
      },
      outputSchema: [{ status: 200, body: z.object({ hits: z.number() }) }],
    };

    const doc = openApiJsonDoc([endpoint]);

    const parameters = ((
      doc.paths as Record<string, { get: { parameters: unknown[] } }>
    )["/search"].get.parameters ?? []) as Array<{ name: string; in: string }>;
    const queryNames = parameters
      .filter((p) => p.in === "query")
      .map((p) => p.name)
      .sort();
    assert.deepEqual(queryNames, ["limit", "q"]);
  });

  it("maps JSON request body from inputSchema.body for POST", () => {
    const endpoint: EndpointInfo = {
      path: "/create",
      method: "post",
      inputSchema: {
        body: z.object({
          name: z.string(),
          count: z.number(),
        }),
      },
      outputSchema: [{ status: 201, body: z.object({ id: z.string() }) }],
    };

    const doc = openApiJsonDoc([endpoint]);

    const post = (
      doc.paths as Record<string, { post: { requestBody: unknown } }>
    )["/create"].post;
    const bodyContent = (
      post.requestBody as { content: Record<string, { schema: unknown }> }
    ).content;
    const jsonSchema = bodyContent["application/json"].schema as {
      type: string;
      required: string[];
      properties: Record<string, unknown>;
    };
    assert.equal(jsonSchema.type, "object");
    assert.deepEqual(jsonSchema.required.sort(), ["count", "name"]);
    assert.deepEqual(jsonSchema.properties.name, { type: "string" });
    assert.deepEqual(jsonSchema.properties.count, { type: "number" });
  });

  it("emits header parameters from inputSchema.headers", () => {
    const endpoint: EndpointInfo = {
      path: "/protected",
      method: "get",
      inputSchema: {
        headers: z.object({
          authorization: z.string(),
        }),
      },
      outputSchema: [{ status: 200, body: z.object({ data: z.string() }) }],
    };

    const doc = openApiJsonDoc([endpoint]);

    const parameters = ((
      doc.paths as Record<string, { get: { parameters: unknown[] } }>
    )["/protected"].get.parameters ?? []) as Array<{
      name: string;
      in: string;
      required: boolean;
    }>;
    const authParam = parameters.find(
      (p) => p.in === "header" && p.name === "authorization",
    );
    assert.ok(authParam);
    assert.equal(authParam!.required, true);
  });

  it("includes distinct response status codes with matching body shapes", () => {
    const endpoint: EndpointInfo = {
      path: "/validate",
      method: "post",
      outputSchema: [
        { status: 200, body: z.object({ ok: z.literal(true) }) },
        { status: 400, body: z.object({ error: z.string() }) },
      ],
    };

    const doc = openApiJsonDoc([endpoint]);

    const responses = (
      doc.paths as Record<
        string,
        { post: { responses: Record<string, unknown> } }
      >
    )["/validate"].post.responses;
    assert.ok(responses["200"]);
    assert.ok(responses["400"]);
    const okSchema = (
      responses["200"] as { content: Record<string, { schema: unknown }> }
    ).content["application/json"].schema as { properties: { ok: unknown } };
    assert.deepEqual(okSchema.properties.ok, {
      type: "boolean",
      enum: [true],
    });
    const badSchema = (
      responses["400"] as { content: Record<string, { schema: unknown }> }
    ).content["application/json"].schema as {
      properties: Record<string, unknown>;
    };
    assert.deepEqual(badSchema.properties.error, { type: "string" });
  });

  it("merges multiple output schemas for the same status into one composite schema and joins descriptions", () => {
    const endpoint: EndpointInfo = {
      path: "/union",
      method: "get",
      outputSchema: [
        {
          status: 200,
          description: "Shape A",
          body: z.object({ a: z.number() }),
        },
        {
          status: 200,
          description: "Shape B",
          body: z.object({ b: z.string() }),
        },
      ],
    };

    const doc = openApiJsonDoc([endpoint]);

    const res200 = (
      doc.paths as Record<
        string,
        { get: { responses: Record<string, unknown> } }
      >
    )["/union"].get.responses["200"] as {
      description: string;
      content: Record<string, { schema: unknown }>;
    };
    assert.equal(res200.description, "Shape A OR Shape B");
    const schema = res200.content["application/json"].schema as {
      anyOf: Array<{ properties?: Record<string, unknown> }>;
    };
    assert.ok(Array.isArray(schema.anyOf));
    assert.equal(schema.anyOf.length, 2);
    const propKeys = schema.anyOf
      .map((s) => Object.keys(s.properties ?? {}))
      .flat()
      .sort();
    assert.deepEqual(propKeys, ["a", "b"]);
  });

  it("appends commonResponses to every endpoint", () => {
    const endpoints: EndpointInfo[] = [
      {
        path: "/a",
        method: "get",
        outputSchema: [{ status: 200, body: z.object({ a: z.number() }) }],
      },
      {
        path: "/b",
        method: "post",
        outputSchema: [{ status: 200, body: z.object({ b: z.boolean() }) }],
      },
    ];
    const commonResponses: EndpointInfo["outputSchema"] = [
      { status: 500, body: z.object({ message: z.string() }) },
    ];

    const doc = openApiJsonDoc(endpoints, { commonResponses });

    const pathA = (
      doc.paths as Record<
        string,
        { get: { responses: Record<string, unknown> } }
      >
    )["/a"].get.responses;
    const pathB = (
      doc.paths as Record<
        string,
        { post: { responses: Record<string, unknown> } }
      >
    )["/b"].post.responses;
    assert.ok(pathA["200"]);
    assert.ok(pathA["500"]);
    assert.ok(pathB["200"]);
    assert.ok(pathB["500"]);
    const msg = (
      (pathA["500"] as { content: Record<string, { schema: unknown }> })
        .content["application/json"].schema as {
        properties: Record<string, unknown>;
      }
    ).properties.message;
    assert.deepEqual(msg, { type: "string" });
  });
});
