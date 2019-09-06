# Swagger 2 to Postman converter
Converter for swagger 2.0 JSON to Postman Collection v1

# Install dependencies
run `$ npm install` to install the dependencies

# Run NPM test
run `$ npm test` to see the converter in action

# Want to convert your own files?
convert.js provides a jsFace class - Swagger2Postman. 
Check test/converter.spec.js for basic usage.

**Initialise class:**

```js
var swaggerConverter = new Swagger2Postman();
```

**Optionally, set a logger:**

```js
swaggerConverter.setLogger(console.log);
```

**Convert your Swagger 2.0 JSON:**

```js
var convertResult = swaggerConverter.convert(swaggerJson);
```

**Check the result:**

```js
convertResult.status === "failed"
```

for unsuccessful conversions. Check convertResult.message

```js
convertResult.status === "passed"
```

for successful conversions. Check convertResult.collection for the Postman collection JSON


**Optional Configuration Parameters:**
The constructor can also take in a map of configuration options

```js
var options = {
  includeQueryParams: false
};

var swaggerConverter = new Swagger2Postman(options);
```

**Valid options are:**

* includeQueryParams - (default true) Include query string parameters in the request url.
* transforms - (default empty) Map used to transform Swagger variables to differently named Postman variables. See [Transforms](#transforms) section below for details.

**Transforms**

```js
this.options = {
   transforms: {
        header: {
            '<SWAGGER HEADER NAME>': '<POSTMAN REPLACEMENT>',
       }, path: {
            '<SWAGGER PATH VARIABLE NAME>': '<POSTMAN REPLACEMENT>',
      }, formData: {
            '<SWAGGER FORMDATA VARIABLE NAME>': '<POSTMAN REPLACEMENT>',
      }, body: {
            '<SWAGGER BODY VARIABLE NAME>': '<POSTMAN REPLACEMENT>',
      }
   }
}
```

The <POSTMAN REPLACEMENT> must contain the wrapping double-curly braces ({{...}}). The <POSTMAN REPLACEMENT> may contain any other hardcoded text/values as well. For instance, a common need for this is setting an Authorization HTTP header, that requires a Bearer prefix, for example:

```js
this.options = {
   transforms: {
        header: {
           'Authorization': 'Bearer {{ACCESS_TOKEN}}'
        }
   }
}
```

An example initializing the Swagger2Postman converter w/ transform parameters is as follows:

```js
converter = new Swagger2Postman({
    includeQueryParams: false,
    transforms: {
        header: {
            'api-key': '{{API_KEY}}',
            'Authorization': 'Bearer {{ACCESS_TOKEN}}',
        },
        path: {
            'ownerId': '{{OWNER_ID}}'
        }
    }
});
```
