# MCP Server Specifications Guide

This document outlines all the specifications you can provide to configure your MCP (Model Context Protocol) server.

## 1. Server Metadata

### Server Configuration
```typescript
new Server(
    {
        name: "YourServerName",        // Server identifier
        version: "1.0.0",              // Server version
    },
    {
        capabilities: {
            tools: {},                  // Tool capabilities
            resources: {},             // Resource capabilities (optional)
            prompts: {},               // Prompt capabilities (optional)
            sampling: {},              // Sampling capabilities (optional)
        },
    }
);
```

**Available Fields:**
- `name`: Unique identifier for your server
- `version`: Semantic version (e.g., "1.0.0")

## 2. Tool Definitions

### Basic Tool Structure
```typescript
{
    name: "toolName",                  // Required: Unique tool identifier
    description: "What this tool does", // Required: Human-readable description
    inputSchema: {                     // Required: JSON Schema for inputs
        type: "object",
        properties: { ... },
        required: [ ... ]
    }
}
```

### Tool Properties

#### Required Fields:
- **`name`**: String - Unique tool identifier (camelCase recommended)
- **`description`**: String - Clear description of what the tool does
- **`inputSchema`**: Object - JSON Schema defining input parameters

#### Optional Fields (if supported by MCP SDK):
- **`examples`**: Array - Example usage scenarios
- **`deprecated`**: Boolean - Mark tool as deprecated

## 3. Input Schema (JSON Schema)

### Schema Structure
```typescript
{
    type: "object",                    // Root type (usually "object")
    properties: {                      // Define all input parameters
        paramName: {
            type: "string" | "number" | "boolean" | "array" | "object",
            description: "Parameter description",
            enum: ["value1", "value2"], // Optional: Allowed values
            default: "defaultValue",   // Optional: Default value
            minimum: 0,                // For numbers: min value
            maximum: 100,              // For numbers: max value
            items: { ... },            // For arrays: item schema
            format: "date-time" | "email" | "uri", // Optional: Format validation
        }
    },
    required: ["paramName"],           // Required parameters
    additionalProperties: false       // Optional: Reject extra properties
}
```

### Schema Property Types

#### String Properties
```typescript
{
    type: "string",
    description: "Description of the string parameter",
    enum: ["option1", "option2"],      // Optional: Restrict to specific values
    pattern: "^[A-Z]+$",              // Optional: Regex validation
    minLength: 1,                     // Optional: Minimum length
    maxLength: 100,                   // Optional: Maximum length
    format: "date-time" | "email" | "uri" | "uuid"
}
```

#### Number Properties
```typescript
{
    type: "number" | "integer",
    description: "Description of the number parameter",
    minimum: 0,                       // Optional: Minimum value
    maximum: 100,                     // Optional: Maximum value
    exclusiveMinimum: true,           // Optional: Exclude minimum
    exclusiveMaximum: true,          // Optional: Exclude maximum
    multipleOf: 5                    // Optional: Must be multiple of
}
```

#### Boolean Properties
```typescript
{
    type: "boolean",
    description: "Description of the boolean parameter",
    default: false                    // Optional: Default value
}
```

#### Array Properties
```typescript
{
    type: "array",
    description: "Description of the array parameter",
    items: {                          // Schema for array items
        type: "string"
    },
    minItems: 1,                      // Optional: Minimum items
    maxItems: 10,                     // Optional: Maximum items
    uniqueItems: true                 // Optional: All items must be unique
}
```

#### Object Properties (Nested)
```typescript
{
    type: "object",
    description: "Description of the object parameter",
    properties: { ... },              // Nested properties
    required: ["nestedField"]         // Required nested fields
}
```

### Common Schema Patterns

#### Optional vs Required Parameters
```typescript
// Required parameter
{
    type: "string",
    description: "Required field"
}
// Then add to required array: required: ["fieldName"]

// Optional parameter
{
    type: "string",
    description: "Optional field",
    default: "defaultValue"           // Optional: Provide default
}
```

#### Enumerated Values
```typescript
{
    type: "string",
    description: "Status of the integration",
    enum: ["ACTIVE", "INACTIVE", "PENDING"],
    default: "ACTIVE"
}
```

#### Conditional/Complex Schemas
```typescript
{
    type: "object",
    properties: {
        type: { type: "string", enum: ["type1", "type2"] },
        // Conditional properties based on type
    },
    oneOf: [                          // Optional: One of these schemas
        { properties: { type: { const: "type1" }, required: ["field1"] } },
        { properties: { type: { const: "type2" }, required: ["field2"] } }
    ]
}
```

## 4. Enhanced Tool Descriptions

### Best Practices for Descriptions

1. **Tool Description**: Be clear and concise
   ```typescript
   description: "Retrieves a list of integration instances with optional filtering and pagination"
   ```

2. **Parameter Descriptions**: Explain purpose and usage
   ```typescript
   {
       type: "string",
       description: "Filter query string. Format: {timewindow:'1h', status:'IN_PROGRESS'}. Valid statuses: IN_PROGRESS, SUCCESS, ERROR"
   }
   ```

3. **Include Examples in Descriptions**:
   ```typescript
   description: "The ID of the integration instance. Example: '12345-abcde-67890'"
   ```

## 5. Complete Example

```typescript
// Server Configuration
const server = new Server(
    {
        name: "OICMonitorServer",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// Tool Definition
const toolSchema = {
    type: "object",
    properties: {
        limit: {
            type: "number",
            description: "Maximum number of items to return",
            minimum: 1,
            maximum: 100,
            default: 50
        },
        offset: {
            type: "number",
            description: "Starting point for pagination",
            minimum: 0,
            default: 0
        },
        status: {
            type: "string",
            description: "Filter by status",
            enum: ["IN_PROGRESS", "SUCCESS", "ERROR", "CANCELLED"],
            default: "IN_PROGRESS"
        },
        timeWindow: {
            type: "string",
            description: "Time window for filtering. Format: '1h', '24h', '7d'",
            pattern: "^(\\d+)(h|d|m)$",
            default: "1h"
        },
        includeDetails: {
            type: "boolean",
            description: "Include detailed information in response",
            default: false
        }
    },
    required: ["limit"]
};

// Register Tool
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "monitoringInstances",
            description: "Retrieves integration instances with filtering, pagination, and optional details. Supports filtering by status and time window.",
            inputSchema: toolSchema
        }
    ]
}));
```

## 6. Additional MCP Capabilities

### Resources (Optional)
```typescript
capabilities: {
    resources: {
        subscribe: true,              // Support resource subscriptions
        listChanged: true             // Notify on resource changes
    }
}
```

### Prompts (Optional)
```typescript
capabilities: {
    prompts: {}                       // Define reusable prompts
}
```

### Sampling (Optional)
```typescript
capabilities: {
    sampling: {}                      // Define sampling strategies
}
```

## 7. Schema Validation Tips

1. **Be Specific**: Use `enum` for known values
2. **Provide Defaults**: Help users with sensible defaults
3. **Document Format**: Use `description` to explain format requirements
4. **Use Patterns**: Regex patterns for string validation
5. **Nested Objects**: Use nested schemas for complex data structures
6. **Required Fields**: Always specify `required` array
7. **Type Safety**: Use appropriate types (string, number, boolean, array, object)

## 8. Error Handling in Tool Responses

Your tool handler should return:
```typescript
{
    content: [
        {
            type: "text",
            text: JSON.stringify(results, null, 2)
        }
    ],
    isError: false                    // Set to true for errors
}
```

## Summary

**What You Can Provide:**
1. ✅ **Schemas** - JSON Schema for input validation
2. ✅ **Descriptions** - Tool and parameter descriptions
3. ✅ **Server Metadata** - Name, version
4. ✅ **Capabilities** - Tools, resources, prompts, sampling
5. ✅ **Type Definitions** - String, number, boolean, array, object
6. ✅ **Validation Rules** - Enum, pattern, min/max, required fields
7. ✅ **Default Values** - For optional parameters
8. ✅ **Examples** - In descriptions or as separate examples

**Best Practices:**
- Use clear, descriptive names
- Provide detailed descriptions
- Include examples in descriptions
- Use appropriate validation (enum, pattern, min/max)
- Set sensible defaults
- Document all parameters

