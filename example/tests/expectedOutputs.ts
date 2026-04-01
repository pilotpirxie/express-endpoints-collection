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
