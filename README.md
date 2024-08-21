# express-endpoints-collection

## Description

This package provides easy to use helper for creating API endpoints in Express with TypeScript inference, validation and OpenAPI 3 schema out of the box.

No need to duplicate OpenAPI definitions in your codebase. Just define your API endpoints and automatically generate OpenAPI 3 schema.

You can configure exposed endpoints, request and response schemas, and validation rules.

![output](./img/output1.png)

## Features

- Fully typed endpoints (TypeScript hints and checks)
  - Request body
  - Response body
  - Query parameters
  - Path parameters
  - Headers
- Automatic OpenAPI 3 schema generation
- Request and response validation using Zod
- Middleware support
- Minimal setup

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

// 1. Create express app
const app: Express = express();
app.use(bodyParser.json());

// 2. Create endpoints collection, this will store all your endpoints
const endpointsCollection = new EndpointsCollection();

// 3. Add new endpoint
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
  // 4. req and res are fully typed!
  (req, res) => {
    const { a, b } = req.body;
    res.json({ result: a + b });
  },
);

// 5. Collection creates its own router, to use it just add it to your app
app.use(endpointsCollection.getRouter());

// 6. Expose OpenAPI 3 schema
app.get("/openapi", (req, res) => {
  res.setHeader("Content-Type", "text/yaml");
  res.send(
    generateOpenAPI({
      title: "Minimal demo",
      version: "1.0.0",
      endpoints: endpointsCollection.getEndpoints(),
      servers: ["http://localhost:3000"],
    }),
  );
});

// 7. Start the server and done!
app.listen(3000, () => {
  console.info(`Server is running on port http://localhost:3000`);
});
```

it will generate OpenAPI 3 definition as follow:

```yaml
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
        "200":
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

```json
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
                "required": ["a", "b"]
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
                  "required": ["result"]
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
