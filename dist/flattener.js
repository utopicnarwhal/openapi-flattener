#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs_1 = require("fs");
var path_1 = __importDefault(require("path"));
var json_schema_merge_allof_1 = __importDefault(require("json-schema-merge-allof"));
var json_schema_ref_parser_1 = require("json-schema-ref-parser");
var minimist_1 = __importDefault(require("minimist"));
var defaultOptions = {
    ignoreAdditionalProperties: true,
    resolvers: {
        defaultResolver: json_schema_merge_allof_1.default.options.resolvers.title
    }
};
var argv = minimist_1.default(process.argv.slice(2));
if (!argv.s || !argv.o) {
    console.log('USAGE: ' + process.argv[1] + ' -s <schema> -o <output> [...]');
    process.exit(1);
}
var input = path_1.default.resolve(argv.s);
function mergeResponse(key, response) {
    if (!(response === null || response === void 0 ? void 0 : response.content) || !('application/json' in response.content))
        return;
    var responseSchema = response.content['application/json'].schema;
    if (!responseSchema)
        return;
    var mergedSchema = json_schema_merge_allof_1.default(responseSchema, defaultOptions);
    if (mergedSchema)
        response.content['application/json'].schema = mergedSchema;
}
function mergeRequestBody(requestBody) {
    var _a;
    var bodySchema = (_a = requestBody.content['application/json']) === null || _a === void 0 ? void 0 : _a.schema;
    if (!bodySchema)
        return;
    var mergedSchema = json_schema_merge_allof_1.default(bodySchema, defaultOptions);
    if (mergedSchema)
        requestBody.content['application/json'].schema = mergedSchema;
}
json_schema_ref_parser_1.dereference(input, {}, function (err, schema) {
    if (err) {
        console.error(err);
    }
    else {
        var openApiSchema_1 = schema; //we get an object which has OpenApi keys as properties, so we cast it here
        var output = path_1.default.resolve(argv.o);
        var ext = path_1.default.parse(output).ext;
        Object.entries(openApiSchema_1.paths).forEach(function (_a) {
            var _ = _a[0], path = _a[1];
            if (path.get) {
                console.log('GET');
                Object.entries(path.get.responses).forEach(function (_a) {
                    var key = _a[0], response = _a[1];
                    mergeResponse(key, response);
                });
            }
            if (path.post) {
                console.log('POST');
                Object.entries(path.post.responses).forEach(function (_a) {
                    var key = _a[0], response = _a[1];
                    mergeResponse(key, response);
                });
                if (typeof path.post.requestBody === 'undefined') {
                    return;
                }
                mergeRequestBody(path.post.requestBody);
            }
            if (path.patch) {
                console.log('PATCH');
                Object.entries(path.patch.responses).forEach(function (_a) {
                    var key = _a[0], response = _a[1];
                    mergeResponse(key, response);
                });
                if (typeof path.patch.requestBody === 'undefined') {
                    return;
                }
                mergeRequestBody(path.patch.requestBody);
            }
        });
        if (openApiSchema_1.components.schemas)
            Object.entries(openApiSchema_1.components.schemas).forEach(function (_a) {
                var key = _a[0], schema = _a[1];
                openApiSchema_1.components.schemas[key] = json_schema_merge_allof_1.default(schema, defaultOptions);
            });
        if (openApiSchema_1.components.examples)
            Object.entries(openApiSchema_1.components.examples).forEach(function (_a) {
                var key = _a[0], schema = _a[1];
                openApiSchema_1.components.examples[key] = json_schema_merge_allof_1.default(schema, defaultOptions);
            });
        if (openApiSchema_1.components.responses)
            Object.entries(openApiSchema_1.components.responses).forEach(function (_a) {
                var key = _a[0], schema = _a[1];
                openApiSchema_1.components.responses[key] = json_schema_merge_allof_1.default(schema, defaultOptions);
            });
        if (ext === '.json') {
            var data = JSON.stringify(openApiSchema_1);
            fs_1.writeFileSync(output, data, { encoding: 'utf8', flag: 'w' });
        }
        else if (ext.match(/^\.?(yaml|yml)$/)) {
            if (schema) {
                var yaml = require('node-yaml');
                yaml.writeSync(output, openApiSchema_1, { encoding: 'utf8' });
            }
        }
        else {
            console.error("Unrecognised output file type: " + output);
            process.exit(1);
        }
        console.log("Wrote file: " + output);
    }
});
//# sourceMappingURL=flattener.js.map