import assert from "node:assert/strict";
import { describe, it } from "node:test";
import yaml from "js-yaml";
import { generateOpenAPI } from "./generator";
import {
  createRegressionEndpointsCollection,
  regressionOpenAPIMeta,
} from "./generator-regression.fixtures";

/**
 * Baseline OpenAPI document for regression routes, expressed as YAML so future
 * generator changes produce a clear diff when parsed and compared to `asJson` output.
 */
const EXPECTED_OPENAPI_YAML = `
openapi: 3.0.0
info:
  title: Regression Test API
  version: 1.0.0
servers:
  - url: https://api.example.com
components:
  schemas: {}
  parameters: {}
paths:
  /users:
    post:
      summary: Register a new user
      operationId: registerUser
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                username:
                  type: string
                  minLength: 3
                  maxLength: 20
                email:
                  type: string
                  format: email
                password:
                  type: string
                  minLength: 8
              required:
                - username
                - email
                - password
      responses:
        '201':
          description: Response for status code 201
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: number
                  username:
                    type: string
                  email:
                    type: string
                    format: email
                required:
                  - id
                  - username
                  - email
        '400':
          description: Response for status code 400
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                required:
                  - error
        '500':
          description: Response for status code 500
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                required:
                  - message
  /users/{id}:
    get:
      summary: Get user profile
      parameters:
        - schema:
            type: string
          required: true
          name: id
          in: path
        - schema:
            type: string
          required: true
          name: authorization
          in: header
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: number
                  username:
                    type: string
                  email:
                    type: string
                    format: email
                required:
                  - id
                  - username
                  - email
        '404':
          description: Response for status code 404
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                required:
                  - error
        '500':
          description: Response for status code 500
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                required:
                  - message
    put:
      summary: Update user profile
      parameters:
        - schema:
            type: string
          required: true
          name: id
          in: path
        - schema:
            type: string
          required: true
          name: authorization
          in: header
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                username:
                  type: string
                  minLength: 3
                  maxLength: 20
                email:
                  type: string
                  format: email
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: number
                  username:
                    type: string
                  email:
                    type: string
                    format: email
                required:
                  - id
                  - username
                  - email
        '404':
          description: Response for status code 404
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                required:
                  - error
        '500':
          description: Response for status code 500
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                required:
                  - message
  /products/search:
    get:
      summary: Product search
      parameters:
        - schema:
            type: string
          required: false
          name: q
          in: query
        - schema:
            type: array
            items:
              type: string
          required: false
          name: category
          in: query
        - schema:
            type: number
          required: false
          name: minPrice
          in: query
        - schema:
            type: number
          required: false
          name: maxPrice
          in: query
        - schema:
            type: boolean
          required: false
          name: inStock
          in: query
        - schema:
            type: string
            enum:
              - price
              - name
              - popularity
          required: false
          name: sortBy
          in: query
        - schema:
            type: integer
            minimum: 0
            exclusiveMinimum: true
          required: false
          name: page
          in: query
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  products:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: number
                        name:
                          type: string
                        price:
                          type: number
                      required:
                        - id
                        - name
                        - price
                  totalCount:
                    type: number
                required:
                  - products
                  - totalCount
        '500':
          description: Response for status code 500
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                required:
                  - message
  /webhooks/payment:
    post:
      summary: Receive payment webhook
      parameters:
        - schema:
            type: string
          required: true
          name: x-webhook-signature
          in: header
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                event:
                  type: string
                  enum:
                    - payment.success
                    - payment.failure
                paymentId:
                  type: string
                amount:
                  type: number
                currency:
                  type: string
                  minLength: 3
                  maxLength: 3
                timestamp:
                  type: string
                  format: date-time
              required:
                - event
                - paymentId
                - amount
                - currency
                - timestamp
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  received:
                    type: boolean
                  message:
                    type: string
                required:
                  - received
                  - message
        '401':
          description: Response for status code 401
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                required:
                  - error
        '500':
          description: Response for status code 500
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                required:
                  - message
  /validate:
    post:
      summary: Merged same-status responses
      responses:
        '200':
          description: Shape A OR Shape B
          content:
            application/json:
              schema:
                anyOf:
                  - type: object
                    properties:
                      a:
                        type: number
                    required:
                      - a
                  - type: object
                    properties:
                      b:
                        type: string
                    required:
                      - b
        '500':
          description: Response for status code 500
          content:
            application/json:
              schema:
                type: object
                properties:
                  message:
                    type: string
                required:
                  - message
`.trimStart();

/**
 * Removes keys whose value is undefined so the OpenAPI object matches YAML
 * round-tripping (js-yaml omits undefined; @asteasolutions/zod-to-openapi may
 * still attach operationId: undefined when unset).
 */
function stripUndefinedDeep(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item));
  }
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val === undefined) {
      continue;
    }
    out[key] = stripUndefinedDeep(val);
  }
  return out;
}

describe("generateOpenAPI regression snapshot", () => {
  it("matches expected YAML literal when both are parsed to objects", () => {
    const collection = createRegressionEndpointsCollection();
    const generated = generateOpenAPI({
      title: regressionOpenAPIMeta.title,
      version: regressionOpenAPIMeta.version,
      servers: [...regressionOpenAPIMeta.servers],
      endpoints: collection.getEndpoints(),
      commonResponses: [...regressionOpenAPIMeta.commonResponses],
      asJson: true,
    }) as unknown as Record<string, unknown>;

    const expected = yaml.load(EXPECTED_OPENAPI_YAML) as unknown as Record<
      string,
      unknown
    >;

    assert.deepEqual(stripUndefinedDeep(generated), expected);
  });
});
