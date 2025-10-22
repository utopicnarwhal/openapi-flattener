# openapi-flattener

Install: `npm install openapi-flattener --save -g`

Usage:

- `openapi-flattener -s input.yaml -o output.yaml`
- `openapi-flattener -s input.json -o output.json`
- `openapi-flattener -s input.yaml -o output.json` (cross-format)

## Description

This package takes an OpenAPI file (`.yaml`, `.yml`, or `.json`) and flattens `allOf` schema compositions while preserving `$ref` references.

**Supported formats:**

- **Input**: JSON (`.json`), YAML (`.yaml`, `.yml`)
- **Output**: JSON (`.json`), YAML (`.yaml`, `.yml`)

The flattener specifically targets `allOf` constructs throughout the OpenAPI document and merges them into their parent schemas. This creates cleaner, more direct schema definitions while maintaining the integrity of `$ref` references for proper schema reusability.

**Key Features:**

- ✅ **Merges `allOf` constructs** - Combines multiple schemas in `allOf` arrays into single, flattened schemas
- ✅ **Preserves `$ref` references** - Keeps all `$ref` pointers intact for schema reusability
- ✅ **Recursive processing** - Handles nested `allOf` constructs at any depth
- ✅ **Comprehensive coverage** - Processes schemas in paths, components, request/response bodies

**What gets processed:**

- Component schemas with `allOf`
- Request/response body schemas with `allOf`
- Nested `allOf` constructs within schema properties
- Mixed `allOf` that contain both `$ref` and inline schemas

**What gets preserved:**

- All `$ref` references remain unchanged
- Schema structure and validation rules
- OpenAPI document structure and metadata

## Examples

### allOf Merging (JSON)

**Input (with allOf):**

```json
{
  "components": {
    "schemas": {
      "User": {
        "allOf": [
          {
            "type": "object",
            "properties": {
              "id": {"type": "string"}
            }
          },
          {
            "type": "object", 
            "properties": {
              "name": {"type": "string"}
            }
          }
        ]
      }
    }
  }
}
```

**Output (flattened):**

```json
{
  "components": {
    "schemas": {
      "User": {
        "type": "object",
        "properties": {
          "id": {"type": "string"},
          "name": {"type": "string"}
        }
      }
    }
  }
}
```

### allOf Merging (YAML)

**Input (with allOf):**

```yaml
components:
  schemas:
    User:
      allOf:
        - type: object
          properties:
            id:
              type: string
        - type: object
          properties:
            name:
              type: string
```

**Output (flattened):**

```yaml
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: string
        name:
          type: string
```

### $ref Preservation

**Input (with $ref and allOf):**

```json
{
  "components": {
    "schemas": {
      "ExtendedUser": {
        "allOf": [
          {"$ref": "#/components/schemas/BaseUser"},
          {
            "type": "object",
            "properties": {
              "role": {"type": "string"}
            }
          }
        ]
      }
    }
  }
}
```

**Output ($ref preserved, allOf merged):**

```json
{
  "components": {
    "schemas": {
      "ExtendedUser": {
        "$ref": "#/components/schemas/BaseUser",
        "type": "object", 
        "properties": {
          "role": {"type": "string"}
        }
      }
    }
  }
}
```

## Use Cases

This flattener is particularly useful when:

- You need to simplify complex `allOf` inheritance chains
- Working with tools that handle `$ref` but struggle with `allOf`
- Generating documentation from OpenAPI specs with complex schema compositions
- Preparing schemas for code generation tools
- Creating more readable and maintainable API documentation

## Dependencies

This package uses `json-schema-merge-allof` to handle the actual merging logic while providing OpenAPI-specific traversal and `$ref` preservation.
