#!/usr/bin/env node

import {writeFileSync} from 'fs';
import path from 'path';
import mergeAllOf, {Options} from 'json-schema-merge-allof';
import {readFileSync} from 'fs';
import minimist from 'minimist';
import {OpenApi, RequestBody, Response} from './Interfaces/OpenApi'

const defaultOptions: Options = {
    ignoreAdditionalProperties: true,
    resolvers: {
        defaultResolver: mergeAllOf.options.resolvers.title
    }
}

/**
 * Resolve a $ref to its actual schema definition
 * @param ref - The $ref string (e.g., "#/components/schemas/OccupationModel")
 * @param openApiSchema - The full OpenAPI schema to resolve references from
 * @returns The resolved schema object
 */
function resolveRef(ref: string, openApiSchema: any): any {
    if (!ref.startsWith('#/')) {
        console.warn(`External references not supported: ${ref}`);
        return null;
    }

    const pathParts = ref.substring(2).split('/'); // Remove '#/' and split by '/'
    let current = openApiSchema;
    
    for (const part of pathParts) {
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        } else {
            console.warn(`Could not resolve reference: ${ref}`);
            return null;
        }
    }
    
    return current;
}

/**
 * Recursively merge allOf schemas throughout an object, resolving $ref within allOf
 * @param obj - The object to process
 * @param openApiSchema - The full OpenAPI schema for resolving $ref
 * @param path - Current path for logging (optional)
 * @returns The processed object with allOf schemas merged and resolved
 */
function mergeAllOfRecursively(obj: any, openApiSchema: any, path: string = ''): any {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    // Don't process standalone $ref objects (preserve them if they're not in allOf)
    if (obj.$ref && !obj.allOf) {
        return obj;
    }

    // If this object has an allOf property, resolve refs and merge
    if (obj.allOf && Array.isArray(obj.allOf)) {
        console.log(`Merging allOf at ${path || 'root'} with ${obj.allOf.length} schemas`);
        
        // Create a new object with resolved allOf schemas
        const resolvedAllOf = obj.allOf.map((schema: any) => {
            if (schema.$ref) {
                const resolved = resolveRef(schema.$ref, openApiSchema);
                if (resolved) {
                    // Recursively process the resolved schema to handle nested allOf
                    return mergeAllOfRecursively(resolved, openApiSchema, `${path}.resolved(${schema.$ref})`);
                }
                return schema; // Keep original if resolution failed
            }
            // Recursively process non-ref schemas
            return mergeAllOfRecursively(schema, openApiSchema, `${path}.allOf[${obj.allOf.indexOf(schema)}]`);
        });

        // Create object for mergeAllOf with resolved schemas
        const objectToMerge = { ...obj, allOf: resolvedAllOf };
        const mergedSchema = mergeAllOf(objectToMerge, defaultOptions);
        
        if (mergedSchema) {
            obj = mergedSchema;
        }
    }

    // Recursively process all properties
    if (Array.isArray(obj)) {
        return obj.map((item, index) => mergeAllOfRecursively(item, openApiSchema, `${path}[${index}]`));
    }

    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        result[key] = mergeAllOfRecursively(value, openApiSchema, currentPath);
    }

    return result;
}
const argv = minimist(process.argv.slice(2));
if (!argv.s || !argv.o) {
    console.log('USAGE: ' + process.argv[1] + ' -s <schema> -o <output> [...]');
    process.exit(1);
}

const input = path.resolve(argv.s);

function mergeResponse(key: string, response: Response, openApiSchema: any) {
    if (!response?.content || !('application/json' in response.content)) return

    let responseSchema = response.content['application/json'].schema
    if (!responseSchema) return

    response.content['application/json'].schema = mergeAllOfRecursively(responseSchema, openApiSchema, `response.${key}`);
}

function mergeRequestBody(requestBody: RequestBody, openApiSchema: any) {
    let bodySchema = requestBody.content['application/json']?.schema
    if (!bodySchema) return

    requestBody.content['application/json'].schema = mergeAllOfRecursively(bodySchema, openApiSchema, 'requestBody');
}

try {
    const fileContent = readFileSync(input, 'utf8');
    const inputExt = path.parse(input).ext;
    
    let openApiSchema: OpenApi;
    if (inputExt.match(/^\.?(yaml|yml)$/)) {
        const yaml = require('node-yaml');
        openApiSchema = yaml.readSync(input);
    } else {
        openApiSchema = JSON.parse(fileContent);
    }
    let output = path.resolve(argv.o);
    let ext = path.parse(output).ext;

    Object.entries(openApiSchema.paths).forEach(([_, path]) => {
        if (path.get) {
            console.log('GET')
            Object.entries(path.get.responses).forEach(([key, response]) => {
                mergeResponse(key, response, openApiSchema)
            })
        }

        if (path.post) {
            console.log('POST')
            Object.entries(path.post.responses).forEach(([key, response]) => {
                mergeResponse(key, response, openApiSchema);
            })
            if (typeof path.post.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.post.requestBody, openApiSchema)
        }

        if (path.patch) {
            console.log('PATCH')
            Object.entries(path.patch.responses).forEach(([key, response]) => {
                mergeResponse(key, response, openApiSchema);
            })
            if (typeof path.patch.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.patch.requestBody, openApiSchema)
        }

        if (path.put) {
            console.log('PUT')
            Object.entries(path.put.responses).forEach(([key, response]) => {
                mergeResponse(key, response, openApiSchema);
            })
            if (typeof path.put.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.put.requestBody, openApiSchema)
        }

        if (path.delete) {
            console.log('DELETE')
            Object.entries(path.delete.responses).forEach(([key, response]) => {
                mergeResponse(key, response, openApiSchema);
            })
            if (typeof path.delete.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.delete.requestBody, openApiSchema)
        }
    })
    
    // Process components schemas - this is where most allOf references are found
    if (openApiSchema.components?.schemas) {
        Object.entries(openApiSchema.components.schemas).forEach(([key, schema]) => {
            openApiSchema.components.schemas[key] = mergeAllOfRecursively(schema, openApiSchema, `components.schemas.${key}`);
        });
    }

    // Process components examples
    if (openApiSchema.components?.examples) {
        Object.entries(openApiSchema.components.examples).forEach(([key, example]) => {
            openApiSchema.components.examples[key] = mergeAllOfRecursively(example, openApiSchema, `components.examples.${key}`);
        });
    }

    // Process components responses
    if (openApiSchema.components?.responses) {
        Object.entries(openApiSchema.components.responses).forEach(([key, response]) => {
            openApiSchema.components.responses[key] = mergeAllOfRecursively(response, openApiSchema, `components.responses.${key}`);
        });
    }

    // Process any remaining allOf references in the entire schema
    console.log('Processing remaining allOf references in the entire schema...');
    openApiSchema = mergeAllOfRecursively(openApiSchema, openApiSchema, 'root');
    
    if (ext === '.json') {
        let data = JSON.stringify(openApiSchema);
        writeFileSync(output, data, {encoding: 'utf8', flag: 'w'});
    } else if (ext.match(/^\.?(yaml|yml)$/)) {
        let yaml = require('node-yaml');
        yaml.writeSync(output, openApiSchema, {encoding: 'utf8'})
    } else {
        console.error(`Unrecognised output file type: ${output}`);
        process.exit(1);
    }
    console.log(`Wrote file: ${output}`);
} catch (err) {
    console.error('Error processing OpenAPI schema:', err);
    process.exit(1);
}
