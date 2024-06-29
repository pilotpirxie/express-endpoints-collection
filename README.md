# express-endpoints-collection

## Description

This package provides easy to use helper for creating API endpoints in Express with TypeScript inference, validation and OpenAPI 3 schema out of the box.

No need to duplicate OpenAPI definitions in your codebase. Just define your API endpoints and automatically generate OpenAPI 3 schema.

You can configure exposed endpoints, request and response schemas, and validation rules.

![output](./img/output1.png)

## Features

* Fully typed endpoints (TypeScript hints and checks)
  * Request body
  * Response body
  * Query parameters
  * Path parameters
  * Headers
* Automatic OpenAPI 3 schema generation
* Request and response validation using Zod
* Minimal setup

## Installation

```shell
npm install express-endpoints-collection

# or

yarn add express-endpoints-collection

# or

pnpm add express-endpoints-collection
```

## Usage

```typescript
import express, { Express } from "express";
import bodyParser from "body-parser";
import { z } from "zod";
import { EndpointsCollection } from "express-endpoints-collection";
import { generateOpenAPI } from "express-endpoints-collection/generator";

// Create express app
const app: Express = express();
app.use(bodyParser.json());

// Create endpoints collection, this will store all your endpoints
const endpointsCollection = new EndpointsCollection();

// Add new endpoint
endpointsCollection.post(
  "/add",
  {
    inputSchema: {
      body: z.object({
        a: z.number(),
        b: z.number(),
      }),
    },
    outputSchema: [
      {
        status: 200,
        body: z.object({
          result: z.number(),
        }),
      },
    ],
    summary: "Add two numbers",
  },
  (req, res) => {
    const { a, b } = req.body;
    res.json({ result: a + b });
  },
);

// Collection creates its own router, to use it just add it to your app
app.use(endpointsCollection.getRouter());

// Expose OpenAPI 3 schema
app.get("/openapi", (req, res) => {
  res.json(
    generateOpenAPI({
      title: "Minimal demo",
      version: "1.0.0",
      endpoints: endpointsCollection.getEndpoints(),
    }),
  );
});

// Start the server
app.listen(3000, () => {
  console.info(`Server is running on port http://localhost:3000`);
});
```

it will generate OpenAPI 3 definition as follow:

```shell
openapi: 3.0.0
info:
  title: Minimal demo
  version: 1.0.0
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
```

or as JSON

```shell
{
  "openapi": "3.0.0",
  "info": {
    "title": "Minimal demo",
    "version": "1.0.0"
  },
  "components": {
    "schemas": {},
    "parameters": {}
  },
  "paths": {
    "/add": {
      "post": {
        "summary": "Add two numbers",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "a": {
                    "type": "number"
                  },
                  "b": {
                    "type": "number"
                  }
                },
                "required": [
                  "a",
                  "b"
                ]
              }
            }
          }
        },
        "responses": {
          "200": {
            "description": "Response for status code 200",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "result": {
                      "type": "number"
                    }
                  },
                  "required": [
                    "result"
                  ]
                }
              }
            }
          }
        }
      }
    }
  }
}
```

## Example

![output](./img/output0.png)

Type inference and checks:

![infer0](./img/infer0.png)

![infer1](./img/infer1.png)

### License
MIT