import assert from "node:assert/strict";
import { describe, it } from "node:test";
import yaml from "js-yaml";
import { z } from "zod";
import {
  endpointsCollection as appEndpointsCollection,
  openApiConfig as appOpenApiConfig,
} from "./app";
import {
  endpointsCollection as middlewaresEndpointsCollection,
  openApiConfig as middlewaresOpenApiConfig,
} from "./middlewares";
import {
  endpointsCollection as minimalEndpointsCollection,
  openApiConfig as minimalOpenApiConfig,
} from "./minimal";
import {
  endpointsCollection as multipleEndpointsCollection,
  openApiConfig as multipleOpenApiConfig,
} from "./multiple";
import { EndpointsCollection, generateOpenAPI } from "../src";

export const MINIMAL = `openapi: 3.0.0
info:
  title: Minimal demo
  version: 1.0.0
servers:
  - url: http://localhost:3000
components:
  schemas: {}
  parameters: {}
paths:
  /add:
    post:
      summary: Add two numbers
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                a:
                  type: number
                b:
                  type: number
              required:
                - a
                - b
      responses:
        '400':
          description: Response for status code 400
          content:
            application/json:
              schema:
                type: object
                properties:
                  result:
                    type: number
                required:
                  - result
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
`;

export const MULTIPLE = `openapi: 3.0.0
info:
  title: Multiple demo
  version: 1.0.0
servers:
  - url: http://localhost:3000
components:
  schemas: {}
  parameters: {}
paths:
  /add:
    post:
      summary: Add two numbers
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                a:
                  type: number
                b:
                  type: number
              required:
                - a
                - b
      responses:
        '400':
          description: Response for status code 400 OR Custom description
          content:
            application/json:
              schema:
                anyOf:
                  - type: object
                    properties:
                      result:
                        type: number
                    required:
                      - result
                  - type: object
                    properties: {}
                  - type: object
                    properties:
                      different400:
                        type: number
                    required:
                      - different400
                  - type: object
                    properties:
                      different400:
                        type: number
                    required:
                      - different400
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
`;

export const MIDDLEWARES = `openapi: 3.0.0
info:
  title: Middlewares demo
  version: 1.0.0
servers:
  - url: http://localhost:3000
components:
  schemas: {}
  parameters: {}
paths:
  /add:
    post:
      summary: Add two numbers
      parameters:
        - schema:
            type: string
          required: true
          name: id
          in: query
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                a:
                  type: number
                b:
                  type: number
              required:
                - a
                - b
      responses:
        '400':
          description: Response for status code 400
          content:
            application/json:
              schema:
                type: object
                properties:
                  result:
                    type: number
                required:
                  - result
`;

export const APP = `openapi: 3.0.0
info:
  title: Advanced API Documentation
  version: 1.0.0
servers:
  - url: http://localhost:3000
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
  /login:
    post:
      summary: User login
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                email:
                  type: string
                  format: email
                password:
                  type: string
              required:
                - email
                - password
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  token:
                    type: string
                required:
                  - token
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
  /posts:
    get:
      summary: Get posts with pagination
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  posts:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: number
                        title:
                          type: string
                        content:
                          type: string
                      required:
                        - id
                        - title
                        - content
                  totalPages:
                    type: number
                required:
                  - posts
                  - totalPages
  /users/register:
    post:
      summary: Register a new user with complex profile
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
                  pattern: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]{8,}$'
                profile:
                  type: object
                  properties:
                    firstName:
                      type: string
                    lastName:
                      type: string
                    age:
                      type: integer
                      minimum: 18
                      maximum: 120
                    interests:
                      type: array
                      items:
                        type: string
                      minItems: 1
                      maxItems: 5
                  required:
                    - firstName
                    - lastName
                    - age
                    - interests
                settings:
                  type: object
                  properties:
                    newsletter:
                      type: boolean
                    theme:
                      type: string
                      enum:
                        - light
                        - dark
                        - system
                    notifications:
                      type: object
                      properties:
                        email:
                          type: boolean
                        push:
                          type: boolean
                        sms:
                          type: boolean
                      required:
                        - email
                        - push
                        - sms
                  required:
                    - newsletter
                    - theme
                    - notifications
              required:
                - username
                - email
                - password
                - profile
                - settings
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
                  profile:
                    type: object
                    properties:
                      firstName:
                        type: string
                      lastName:
                        type: string
                      age:
                        type: number
                      interests:
                        type: array
                        items:
                          type: string
                    required:
                      - firstName
                      - lastName
                      - age
                      - interests
                required:
                  - id
                  - username
                  - email
                  - profile
        '400':
          description: Response for status code 400
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                  details:
                    type: array
                    items:
                      type: object
                      properties:
                        field:
                          type: string
                        message:
                          type: string
                      required:
                        - field
                        - message
                required:
                  - error
                  - details
  /add:
    post:
      summary: Add two numbers
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                a:
                  type: number
                b:
                  type: number
              required:
                - a
                - b
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  result:
                    type: number
                required:
                  - result
  /products/search:
    get:
      summary: Advanced product search
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
            type: array
            items:
              type: string
          required: false
          name: brand
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
            type: string
            enum:
              - asc
              - desc
          required: false
          name: sortOrder
          in: query
        - schema:
            type: integer
            minimum: 0
            exclusiveMinimum: true
          required: false
          name: page
          in: query
        - schema:
            type: integer
            minimum: 0
            exclusiveMinimum: true
            maximum: 100
          required: false
          name: limit
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
                        category:
                          type: string
                        brand:
                          type: string
                        inStock:
                          type: boolean
                      required:
                        - id
                        - name
                        - price
                        - category
                        - brand
                        - inStock
                  totalCount:
                    type: number
                  page:
                    type: number
                  totalPages:
                    type: number
                required:
                  - products
                  - totalCount
                  - page
                  - totalPages
  /upload:
    post:
      summary: Upload multiple files
      parameters:
        - schema:
            type: string
            enum:
              - multipart/form-data
          required: true
          name: content-type
          in: header
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                files:
                  type: array
                  items:
                    type: object
                    properties:
                      filename:
                        type: string
                      mimetype:
                        type: string
                      size:
                        type: number
                    required:
                      - filename
                      - mimetype
                      - size
                  minItems: 1
                  maxItems: 5
                description:
                  type: string
              required:
                - files
      responses:
        '200':
          description: Response for status code 200
          content:
            application/json:
              schema:
                type: object
                properties:
                  uploadedFiles:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                        filename:
                          type: string
                        url:
                          type: string
                      required:
                        - id
                        - filename
                        - url
                required:
                  - uploadedFiles
        '413':
          description: Response for status code 413
          content:
            application/json:
              schema:
                type: object
                properties:
                  error:
                    type: string
                required:
                  - error
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
`;

/**
 * Synthetic diverse routes (not tied to a single example) for inline YAML regression.
 */
function buildSyntheticRegressionEndpointsCollection(): EndpointsCollection {
  const collection = new EndpointsCollection();

  collection.post(
    "/users",
    {
      inputSchema: {
        body: z.object({
          username: z.string().min(3).max(20),
          email: z.string().email(),
          password: z.string().min(8),
        }),
      },
      outputSchema: [
        {
          status: 201,
          body: z.object({
            id: z.number(),
            username: z.string(),
            email: z.string().email(),
          }),
        },
        {
          status: 400,
          body: z.object({
            error: z.string(),
          }),
        },
      ],
      summary: "Register a new user",
      operationId: "registerUser",
    },
    (_req, res) => {
      res.status(201).end();
    },
  );

  collection.get(
    "/users/:id",
    {
      inputSchema: {
        params: z.object({
          id: z.string(),
        }),
        headers: z.object({
          authorization: z.string(),
        }),
      },
      outputSchema: [
        {
          status: 200,
          body: z.object({
            id: z.number(),
            username: z.string(),
            email: z.string().email(),
          }),
        },
        {
          status: 404,
          body: z.object({
            error: z.string(),
          }),
        },
      ],
      summary: "Get user profile",
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.put(
    "/users/:id",
    {
      inputSchema: {
        params: z.object({
          id: z.string(),
        }),
        body: z.object({
          username: z.string().min(3).max(20).optional(),
          email: z.string().email().optional(),
        }),
        headers: z.object({
          authorization: z.string(),
        }),
      },
      outputSchema: [
        {
          status: 200,
          body: z.object({
            id: z.number(),
            username: z.string(),
            email: z.string().email(),
          }),
        },
        {
          status: 404,
          body: z.object({
            error: z.string(),
          }),
        },
      ],
      summary: "Update user profile",
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.get(
    "/products/search",
    {
      inputSchema: {
        query: z.object({
          q: z.string().optional(),
          category: z.array(z.string()).optional(),
          minPrice: z.number().optional(),
          maxPrice: z.number().optional(),
          inStock: z.boolean().optional(),
          sortBy: z.enum(["price", "name", "popularity"]).optional(),
          page: z.number().int().positive().optional(),
        }),
      },
      outputSchema: [
        {
          status: 200,
          body: z.object({
            products: z.array(
              z.object({
                id: z.number(),
                name: z.string(),
                price: z.number(),
              }),
            ),
            totalCount: z.number(),
          }),
        },
      ],
      summary: "Product search",
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.post(
    "/webhooks/payment",
    {
      inputSchema: {
        body: z.object({
          event: z.enum(["payment.success", "payment.failure"]),
          paymentId: z.string(),
          amount: z.number(),
          currency: z.string().length(3),
          timestamp: z.string().datetime(),
        }),
        headers: z.object({
          "x-webhook-signature": z.string(),
        }),
      },
      outputSchema: [
        {
          status: 200,
          body: z.object({
            received: z.boolean(),
            message: z.string(),
          }),
        },
        {
          status: 401,
          body: z.object({
            error: z.string(),
          }),
        },
      ],
      summary: "Receive payment webhook",
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  collection.post(
    "/validate",
    {
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
      summary: "Merged same-status responses",
    },
    (_req, res) => {
      res.status(200).end();
    },
  );

  return collection;
}

const syntheticRegressionOpenAPIMeta = {
  title: "Regression Test API",
  version: "1.0.0",
  servers: ["https://api.example.com"] as const,
  commonResponses: [
    {
      status: 500,
      body: z.object({
        message: z.string(),
      }),
    },
  ] as const,
};

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
    const collection = buildSyntheticRegressionEndpointsCollection();
    const generated = generateOpenAPI({
      title: syntheticRegressionOpenAPIMeta.title,
      version: syntheticRegressionOpenAPIMeta.version,
      servers: [...syntheticRegressionOpenAPIMeta.servers],
      endpoints: collection.getEndpoints(),
      commonResponses: [...syntheticRegressionOpenAPIMeta.commonResponses],
      asJson: true,
    }) as unknown as Record<string, unknown>;

    const expected = yaml.load(EXPECTED_OPENAPI_YAML) as unknown as Record<
      string,
      unknown
    >;

    assert.deepEqual(stripUndefinedDeep(generated), expected);
  });

  it("example/minimal.ts OpenAPI matches frozen expectedOutputs.MINIMAL", () => {
    const generated = generateOpenAPI({
      ...minimalOpenApiConfig,
      servers: [...minimalOpenApiConfig.servers],
      endpoints: minimalEndpointsCollection.getEndpoints(),
      asJson: true,
    }) as unknown as Record<string, unknown>;

    const expected = yaml.load(MINIMAL) as unknown as Record<string, unknown>;

    assert.deepEqual(stripUndefinedDeep(generated), expected);
  });

  it("example/multiple.ts OpenAPI matches frozen expectedOutputs.MULTIPLE", () => {
    const generated = generateOpenAPI({
      ...multipleOpenApiConfig,
      servers: [...multipleOpenApiConfig.servers],
      endpoints: multipleEndpointsCollection.getEndpoints(),
      asJson: true,
    }) as unknown as Record<string, unknown>;

    const expected = yaml.load(MULTIPLE) as unknown as Record<string, unknown>;

    assert.deepEqual(stripUndefinedDeep(generated), expected);
  });

  it("example/middlewares.ts OpenAPI matches frozen expectedOutputs.MIDDLEWARES", () => {
    const generated = generateOpenAPI({
      ...middlewaresOpenApiConfig,
      servers: [...middlewaresOpenApiConfig.servers],
      endpoints: middlewaresEndpointsCollection.getEndpoints(),
      asJson: true,
    }) as unknown as Record<string, unknown>;

    const expected = yaml.load(MIDDLEWARES) as unknown as Record<
      string,
      unknown
    >;

    assert.deepEqual(stripUndefinedDeep(generated), expected);
  });

  it("example/app.ts OpenAPI matches frozen expectedOutputs.APP", () => {
    const generated = generateOpenAPI({
      ...appOpenApiConfig,
      servers: [...appOpenApiConfig.servers],
      endpoints: appEndpointsCollection.getEndpoints(),
      asJson: true,
    }) as unknown as Record<string, unknown>;

    const expected = yaml.load(APP) as unknown as Record<string, unknown>;

    assert.deepEqual(stripUndefinedDeep(generated), expected);
  });
});
