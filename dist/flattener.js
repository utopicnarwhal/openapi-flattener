#!/usr/bin/env node
"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a, _b, _c;
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = __importDefault(require("path"));
var json_schema_merge_allof_1 = __importDefault(require("json-schema-merge-allof"));
var fs_2 = require("fs");
var minimist_1 = __importDefault(require("minimist"));
var defaultOptions = {
    ignoreAdditionalProperties: true,
    resolvers: {
        defaultResolver: json_schema_merge_allof_1.default.options.resolvers.title
    }
};
/**
 * Resolve a $ref to its actual schema definition
 * @param ref - The $ref string (e.g., "#/components/schemas/OccupationModel")
 * @param openApiSchema - The full OpenAPI schema to resolve references from
 * @returns The resolved schema object
 */
function resolveRef(ref, openApiSchema) {
    if (!ref.startsWith('#/')) {
        console.warn("External references not supported: " + ref);
        return null;
    }
    var pathParts = ref.substring(2).split('/'); // Remove '#/' and split by '/'
    var current = openApiSchema;
    for (var _i = 0, pathParts_1 = pathParts; _i < pathParts_1.length; _i++) {
        var part = pathParts_1[_i];
        if (current && typeof current === 'object' && part in current) {
            current = current[part];
        }
        else {
            console.warn("Could not resolve reference: " + ref);
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
function mergeAllOfRecursively(obj, openApiSchema, path) {
    if (path === void 0) { path = ''; }
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    // Don't process standalone $ref objects (preserve them if they're not in allOf)
    if (obj.$ref && !obj.allOf) {
        return obj;
    }
    // If this object has an allOf property, resolve refs and merge
    if (obj.allOf && Array.isArray(obj.allOf)) {
        console.log("Merging allOf at " + (path || 'root') + " with " + obj.allOf.length + " schemas");
        // Create a new object with resolved allOf schemas
        var resolvedAllOf = obj.allOf.map(function (schema) {
            if (schema.$ref) {
                var resolved = resolveRef(schema.$ref, openApiSchema);
                if (resolved) {
                    // Recursively process the resolved schema to handle nested allOf
                    return mergeAllOfRecursively(resolved, openApiSchema, path + ".resolved(" + schema.$ref + ")");
                }
                return schema; // Keep original if resolution failed
            }
            // Recursively process non-ref schemas
            return mergeAllOfRecursively(schema, openApiSchema, path + ".allOf[" + obj.allOf.indexOf(schema) + "]");
        });
        // Create object for mergeAllOf with resolved schemas
        var objectToMerge = __assign(__assign({}, obj), { allOf: resolvedAllOf });
        var mergedSchema = json_schema_merge_allof_1.default(objectToMerge, defaultOptions);
        if (mergedSchema) {
            obj = mergedSchema;
        }
    }
    // Recursively process all properties
    if (Array.isArray(obj)) {
        return obj.map(function (item, index) { return mergeAllOfRecursively(item, openApiSchema, path + "[" + index + "]"); });
    }
    var result = {};
    for (var _i = 0, _a = Object.entries(obj); _i < _a.length; _i++) {
        var _b = _a[_i], key = _b[0], value = _b[1];
        var currentPath = path ? path + "." + key : key;
        result[key] = mergeAllOfRecursively(value, openApiSchema, currentPath);
    }
    return result;
}
var argv = minimist_1.default(process.argv.slice(2));
if (!argv.s || !argv.o) {
    console.log('USAGE: ' + process.argv[1] + ' -s <schema> -o <output> [...]');
    process.exit(1);
}
var input = path_1.default.resolve(argv.s);
function mergeResponse(key, response, openApiSchema) {
    if (!(response === null || response === void 0 ? void 0 : response.content) || !('application/json' in response.content))
        return;
    var responseSchema = response.content['application/json'].schema;
    if (!responseSchema)
        return;
    response.content['application/json'].schema = mergeAllOfRecursively(responseSchema, openApiSchema, "response." + key);
}
function mergeRequestBody(requestBody, openApiSchema) {
    var _a;
    var bodySchema = (_a = requestBody.content['application/json']) === null || _a === void 0 ? void 0 : _a.schema;
    if (!bodySchema)
        return;
    requestBody.content['application/json'].schema = mergeAllOfRecursively(bodySchema, openApiSchema, 'requestBody');
}
try {
    var fileContent = fs_2.readFileSync(input, 'utf8');
    var inputExt = path_1.default.parse(input).ext;
    var openApiSchema_1;
    if (inputExt.match(/^\.?(yaml|yml)$/)) {
        var yaml = require('node-yaml');
        openApiSchema_1 = yaml.readSync(input);
    }
    else {
        openApiSchema_1 = JSON.parse(fileContent);
    }
    var output = path_1.default.resolve(argv.o);
    var ext = path_1.default.parse(output).ext;
    Object.entries(openApiSchema_1.paths).forEach(function (_a) {
        var _ = _a[0], path = _a[1];
        if (path.get) {
            console.log('GET');
            Object.entries(path.get.responses).forEach(function (_a) {
                var key = _a[0], response = _a[1];
                mergeResponse(key, response, openApiSchema_1);
            });
        }
        if (path.post) {
            console.log('POST');
            Object.entries(path.post.responses).forEach(function (_a) {
                var key = _a[0], response = _a[1];
                mergeResponse(key, response, openApiSchema_1);
            });
            if (typeof path.post.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.post.requestBody, openApiSchema_1);
        }
        if (path.patch) {
            console.log('PATCH');
            Object.entries(path.patch.responses).forEach(function (_a) {
                var key = _a[0], response = _a[1];
                mergeResponse(key, response, openApiSchema_1);
            });
            if (typeof path.patch.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.patch.requestBody, openApiSchema_1);
        }
        if (path.put) {
            console.log('PUT');
            Object.entries(path.put.responses).forEach(function (_a) {
                var key = _a[0], response = _a[1];
                mergeResponse(key, response, openApiSchema_1);
            });
            if (typeof path.put.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.put.requestBody, openApiSchema_1);
        }
        if (path.delete) {
            console.log('DELETE');
            Object.entries(path.delete.responses).forEach(function (_a) {
                var key = _a[0], response = _a[1];
                mergeResponse(key, response, openApiSchema_1);
            });
            if (typeof path.delete.requestBody === 'undefined') {
                return;
            }
            mergeRequestBody(path.delete.requestBody, openApiSchema_1);
        }
    });
    // Process components schemas - this is where most allOf references are found
    if ((_a = openApiSchema_1.components) === null || _a === void 0 ? void 0 : _a.schemas) {
        Object.entries(openApiSchema_1.components.schemas).forEach(function (_a) {
            var key = _a[0], schema = _a[1];
            openApiSchema_1.components.schemas[key] = mergeAllOfRecursively(schema, openApiSchema_1, "components.schemas." + key);
        });
    }
    // Process components examples
    if ((_b = openApiSchema_1.components) === null || _b === void 0 ? void 0 : _b.examples) {
        Object.entries(openApiSchema_1.components.examples).forEach(function (_a) {
            var key = _a[0], example = _a[1];
            openApiSchema_1.components.examples[key] = mergeAllOfRecursively(example, openApiSchema_1, "components.examples." + key);
        });
    }
    // Process components responses
    if ((_c = openApiSchema_1.components) === null || _c === void 0 ? void 0 : _c.responses) {
        Object.entries(openApiSchema_1.components.responses).forEach(function (_a) {
            var key = _a[0], response = _a[1];
            openApiSchema_1.components.responses[key] = mergeAllOfRecursively(response, openApiSchema_1, "components.responses." + key);
        });
    }
    // Process any remaining allOf references in the entire schema
    console.log('Processing remaining allOf references in the entire schema...');
    openApiSchema_1 = mergeAllOfRecursively(openApiSchema_1, openApiSchema_1, 'root');
    if (ext === '.json') {
        var data = JSON.stringify(openApiSchema_1);
        fs_1.writeFileSync(output, data, { encoding: 'utf8', flag: 'w' });
    }
    else if (ext.match(/^\.?(yaml|yml)$/)) {
        var yaml = require('node-yaml');
        yaml.writeSync(output, openApiSchema_1, { encoding: 'utf8' });
    }
    else {
        console.error("Unrecognised output file type: " + output);
        process.exit(1);
    }
    console.log("Wrote file: " + output);
}
catch (err) {
    console.error('Error processing OpenAPI schema:', err);
    process.exit(1);
}
//# sourceMappingURL=flattener.js.map